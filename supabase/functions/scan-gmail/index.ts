import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_CLIENT_ID     = () => Deno.env.get('GOOGLE_CLIENT_ID') || ''
const GOOGLE_CLIENT_SECRET = () => Deno.env.get('GOOGLE_CLIENT_SECRET') || ''
const SUPABASE_URL         = () => Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY     = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Decode userId from Supabase JWT without extra API call ────────
function decodeUserId(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '')
    if (!token || !token.includes('.')) return null
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    // Supabase user JWTs have role='authenticated'; anon key has role='anon'
    if (payload.role !== 'authenticated') return null
    return payload.sub || null
  } catch { return null }
}

// ── Refresh / get valid Google token ─────────────────────────────
async function getValidToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) return null

  if (new Date(data.expires_at) < new Date(Date.now() + 5 * 60000)) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: data.refresh_token,
        client_id:     GOOGLE_CLIENT_ID(),
        client_secret: GOOGLE_CLIENT_SECRET(),
        grant_type:    'refresh_token',
      }),
    })
    const tokens = await res.json()
    if (!res.ok) return null
    await supabase.from('google_tokens').update({
      access_token: tokens.access_token,
      expires_at:   new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    }).eq('user_id', userId)
    return tokens.access_token
  }
  return data.access_token
}

// ── Gmail API helpers ─────────────────────────────────────────────
async function gmailSearch(accessToken: string, query: string, maxResults = 50) {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) })
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  return (data.messages || []) as Array<{ id: string }>
}

async function gmailGetMessage(accessToken: string, messageId: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.json()
}

// ── Extract PDF/image attachments ─────────────────────────────────
// Minimum 40KB to filter out logos, icons, and decorative images
const MIN_ATTACHMENT_SIZE = 40 * 1024

function extractAttachments(message: Record<string, unknown>) {
  const attachments: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = []

  function walkParts(parts: Array<Record<string, unknown>>) {
    for (const part of (parts || [])) {
      const body = part.body as Record<string, unknown>
      const mimeType = part.mimeType as string
      const size = Number(body?.size || 0)
      if (
        body?.attachmentId &&
        (mimeType?.startsWith('image/') || mimeType === 'application/pdf')
      ) {
        let filename = (part.filename as string) || ''
        if (!filename) {
          const ext = mimeType.split('/')[1] || 'pdf'
          filename = `invoice_${Date.now()}.${ext}`
        }
        attachments.push({
          filename,
          mimeType:     mimeType || 'application/octet-stream',
          attachmentId: body.attachmentId as string,
          size,
        })
      }
      if (Array.isArray(part.parts)) walkParts(part.parts as Array<Record<string, unknown>>)
    }
  }

  const payload = message.payload as Record<string, unknown>
  if (Array.isArray(payload?.parts)) walkParts(payload.parts as Array<Record<string, unknown>>)

  // Filter out tiny files (logos, icons) — keep only >= 40KB
  return attachments.filter(a => a.size === 0 || a.size >= MIN_ATTACHMENT_SIZE)
}

// ── Extract readable text from email body ─────────────────────────
function extractEmailText(message: Record<string, unknown>): { subject: string; from: string; body: string } {
  const payload  = message.payload as Record<string, unknown>
  const headers  = (payload?.headers as Array<Record<string, string>>) || []
  const subject  = headers.find(h => h.name === 'Subject')?.value || ''
  const from     = headers.find(h => h.name === 'From')?.value || ''

  let body = ''

  function decodeBase64(data: string): string {
    try {
      // Gmail uses base64url encoding
      const std = data.replace(/-/g, '+').replace(/_/g, '/')
      return decodeURIComponent(
        atob(std).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      )
    } catch { return '' }
  }

  function stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  function walkForBody(parts: Array<Record<string, unknown>>) {
    for (const part of (parts || [])) {
      const partBody = part.body as Record<string, unknown>
      const data     = (partBody?.data as string) || ''

      if (part.mimeType === 'text/plain' && data && !body) {
        body = decodeBase64(data)
      } else if (part.mimeType === 'text/html' && data) {
        const html = decodeBase64(data)
        if (!body) body = stripHtml(html)
      }

      if (Array.isArray(part.parts)) walkForBody(part.parts as Array<Record<string, unknown>>)
    }
  }

  // Handle simple (non-multipart) messages
  const directBody = payload?.body as Record<string, unknown>
  if (directBody?.data) {
    const data = directBody.data as string
    const mimeType = payload?.mimeType as string
    if (mimeType === 'text/html') {
      body = stripHtml(decodeBase64(data))
    } else {
      body = decodeBase64(data)
    }
  }

  if (Array.isArray(payload?.parts)) walkForBody(payload.parts as Array<Record<string, unknown>>)

  // Fallback: use Gmail snippet
  if (!body) body = (message.snippet as string) || ''

  return { subject, from, body: body.slice(0, 6000) }
}

// ── Download attachment ───────────────────────────────────────────
async function downloadAttachment(accessToken: string, messageId: string, attachmentId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  return (data.data as string || '').replace(/-/g, '+').replace(/_/g, '/')
}

// ── Call process-invoice (image) ──────────────────────────────────
async function processInvoiceImage(imageBase64: string, mimeType: string, authToken: string) {
  const res = await fetch(`${SUPABASE_URL()}/functions/v1/process-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey':        SERVICE_ROLE_KEY(),
    },
    body: JSON.stringify({ imageBase64, mimeType }),
  })
  if (!res.ok) return null
  return res.json()
}

// ── Call process-invoice (email body text) ────────────────────────
async function processInvoiceText(body: string, subject: string, from: string, authToken: string) {
  const res = await fetch(`${SUPABASE_URL()}/functions/v1/process-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey':        SERVICE_ROLE_KEY(),
    },
    body: JSON.stringify({ text: body, subject, from }),
  })
  if (!res.ok) return null
  return res.json()
}

// ── Main handler ─────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader  = req.headers.get('Authorization') || ''
    const bearerToken = authHeader.replace('Bearer ', '')
    const supabase    = createClient(SUPABASE_URL(), SERVICE_ROLE_KEY())

    // Get user ID directly from JWT (no API call needed)
    const userId = decodeUserId(authHeader)
    if (!userId) return jsonRes({ error: 'Unauthorized' }, 401)

    // Get valid Google token
    const accessToken = await getValidToken(supabase, userId)
    if (!accessToken) {
      return jsonRes({ error: 'Gmail not connected. Please connect Google account first.', needs_auth: true }, 401)
    }

    // ── Search Gmail — STRICT mode: require keywords + attachment ──
    // Modeled after invoice-auto-drive reference project for precision
    const STRICT_QUERY = [
      '-in:trash -in:spam -is:draft',
      '-subject:newsletter -subject:"password reset" -subject:tracking -subject:shipment',
      '-subject:unsubscribe -subject:welcome -subject:"ברוך הבא" -subject:"verify your"',
      // Core: invoice keywords AND has an attachment
      '((subject:invoice OR subject:receipt OR subject:bill',
      ' OR subject:חשבונית OR subject:החשבונית OR subject:קבלה OR subject:הקבלה',
      ' OR subject:תשלום OR subject:חיוב OR subject:החיוב OR subject:"מסמך מס") has:attachment)',
      // Known Israeli & global invoice senders
      'OR ((from:golan-telecom.co.il OR from:golan.co.il OR from:partner.net.il',
      ' OR from:cellcom.co.il OR from:hot.net.il OR from:bezeq.co.il OR from:012mobile.co.il',
      ' OR from:pelephone.co.il OR from:rami-levy.co.il OR from:yes.co.il',
      ' OR from:isracard.co.il OR from:cal-online.co.il OR from:max.co.il',
      ' OR from:stripe.com OR from:paypal.com OR from:amazon.com) has:attachment)',
      'newer_than:90d',
    ].join(' ')

    const allMessages = await gmailSearch(accessToken, STRICT_QUERY, 80)

    let processed = 0
    let skipped   = 0
    const errors: string[] = []

    for (const msg of allMessages) {
      const messageId = msg.id

      // Skip if already imported
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('email_message_id', messageId)
        .maybeSingle()

      if (existing) { skipped++; continue }

      try {
        const fullMsg    = await gmailGetMessage(accessToken, messageId)
        const attachments = extractAttachments(fullMsg)
        const { subject, from, body } = extractEmailText(fullMsg)

        let extracted: Record<string, unknown> | null = null

        if (attachments.length > 0) {
          // ── Path A: process attachment (PDF / image) ──
          for (const att of attachments) {
            const base64Data = await downloadAttachment(accessToken, messageId, att.attachmentId)
            if (!base64Data) continue
            const result = await processInvoiceImage(base64Data, att.mimeType, bearerToken)
            // Skip if AI says it's not a valid invoice (logo, screenshot, etc.)
            if (result && result.is_valid_invoice !== false) {
              extracted = result
              break   // first valid attachment wins
            }
          }
        }

        // ── Path B: no valid attachment → use email body text ──
        if (!extracted && body.length > 80) {
          const result = await processInvoiceText(body, subject, from, bearerToken)
          if (result && result.is_valid_invoice !== false) {
            extracted = result
          }
        }

        if (!extracted) { skipped++; continue }

        // Get email date for fallback
        const internalDate = fullMsg.internalDate
          ? new Date(Number(fullMsg.internalDate))
          : new Date()

        const month = extracted.month || (internalDate.getMonth() + 1)
        const year  = extracted.year  || internalDate.getFullYear()

        await supabase.from('invoices').insert({
          owner_id:         userId,
          vendor:           extracted.vendor          || null,
          invoice_number:   extracted.invoice_number  || null,
          invoice_date:     extracted.invoice_date     || internalDate.toISOString().split('T')[0],
          amount:           extracted.amount           || null,
          vat_amount:       extracted.vat_amount       || null,
          total_amount:     extracted.total_amount     || null,
          category:         extracted.category         || 'other',
          month,
          year,
          description:      extracted.description      || subject || null,
          source:           'email',
          email_message_id: messageId,
          status:           'pending',
        })

        processed++
      } catch (e) {
        errors.push(`${messageId}: ${(e as Error).message}`)
      }
    }

    return jsonRes({
      success:   true,
      processed,
      skipped,
      total:     allMessages.length,
      errors:    errors.length > 0 ? errors : undefined,
    })

  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500)
  }
})
