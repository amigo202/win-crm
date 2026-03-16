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

// ── Decode userId from Supabase JWT ───────────────────────────────
function decodeUserId(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '')
    if (!token || !token.includes('.')) return null
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.role !== 'authenticated') return null
    return payload.sub || null
  } catch { return null }
}

// ── Get/refresh valid Google access token ─────────────────────────
async function getValidToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) return null

  // Refresh if expires within 5 minutes (or already expired)
  if (!data.expires_at || new Date(data.expires_at) < new Date(Date.now() + 5 * 60000)) {
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
    if (!res.ok) {
      console.error('[getValidToken] refresh failed:', tokens)
      return null
    }
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
  if (!res.ok) {
    const err = await res.text()
    console.error('[gmailSearch] error', res.status, err)
    return []
  }
  const data = await res.json()
  return (data.messages || []) as Array<{ id: string }>
}

async function gmailGetMessage(accessToken: string, messageId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  return res.json()
}

// ── Extract attachments (PDF + images) ───────────────────────────
const VALID_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MIN_ATTACHMENT_SIZE = 20 * 1024  // 20KB — avoids tiny logos

function extractAttachments(payload: Record<string, unknown>) {
  const results: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = []

  function walk(part: Record<string, unknown>, depth = 0) {
    const body     = part.body as Record<string, unknown>
    const mimeType = (part.mimeType as string || '').toLowerCase()

    if (body?.attachmentId && VALID_MIME.includes(mimeType)) {
      const size = Number(body.size || 0)
      let filename = (part.filename as string) || ''
      if (!filename) {
        const ext = mimeType.split('/')[1] || 'pdf'
        filename = `invoice_${Date.now()}_${results.length}.${ext}`
      }
      results.push({ filename, mimeType, attachmentId: body.attachmentId as string, size })
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) walk(child as Record<string, unknown>, depth + 1)
    }
  }

  walk(payload)
  return results
}

// ── Extract email headers ─────────────────────────────────────────
function extractHeaders(message: Record<string, unknown>) {
  const payload = message.payload as Record<string, unknown>
  const headers = (payload?.headers as Array<Record<string, string>>) || []
  const get = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
  return {
    subject: get('Subject'),
    from:    get('From'),
    to:      get('To'),
    date:    get('Date'),
  }
}

// ── Extract readable body text ────────────────────────────────────
function extractBody(message: Record<string, unknown>): string {
  const payload = message.payload as Record<string, unknown>

  function decodeB64(data: string): string {
    try {
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
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  }

  let body = ''
  function walk(part: Record<string, unknown>) {
    const partBody = part.body as Record<string, unknown>
    const data = (partBody?.data as string) || ''
    if (part.mimeType === 'text/plain' && data && !body) body = decodeB64(data)
    else if (part.mimeType === 'text/html' && data && !body) body = stripHtml(decodeB64(data))
    if (Array.isArray(part.parts)) for (const p of part.parts) walk(p as Record<string, unknown>)
  }

  const directBody = payload?.body as Record<string, unknown>
  if (directBody?.data) {
    const raw = directBody.data as string
    body = payload?.mimeType === 'text/html' ? stripHtml(decodeB64(raw)) : decodeB64(raw)
  }
  if (Array.isArray(payload?.parts)) for (const p of payload.parts as Record<string, unknown>[]) walk(p)
  if (!body) body = (message.snippet as string) || ''
  return body.slice(0, 6000)
}

// ── Download attachment ───────────────────────────────────────────
async function downloadAttachment(accessToken: string, messageId: string, attachmentId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return ((data.data as string) || '').replace(/-/g, '+').replace(/_/g, '/')
}

// ── Call process-invoice ──────────────────────────────────────────
async function processInvoice(payload: Record<string, unknown>, authToken: string) {
  const res = await fetch(`${SUPABASE_URL()}/functions/v1/process-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey':        SERVICE_ROLE_KEY(),
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return null
  return res.json()
}

// ── Build Gmail search query ──────────────────────────────────────
function buildQuery(): string {
  // Date: last 12 months
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  const after = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`

  const exclusions = [
    '-in:trash', '-in:spam', '-is:draft',
    '-subject:newsletter', '-subject:"password reset"', '-subject:tracking',
    '-subject:unsubscribe', '-subject:"verify your"', '-subject:verification',
    '-from:noreply@accounts.google.com', '-from:mailer-daemon', '-from:postmaster',
    '-from:no-reply@github.com', '-from:noreply@github.com',
  ].join(' ')

  // Subject keywords — NO has:attachment (Israeli providers send HTML-only)
  const subjectMatch = '(subject:invoice OR subject:receipt OR subject:bill OR subject:חשבונית OR subject:חשבון OR subject:קבלה OR subject:תשלום OR subject:חיוב OR subject:אישור OR subject:"מסמך מס" OR subject:פירוט OR subject:"דוח חיוב")'

  // Known senders — require has:attachment
  const senderMatch = '(from:golan-telecom.co.il OR from:golantelecom.co.il OR from:partner.net.il OR from:cellcom.co.il OR from:hot.net.il OR from:bezeq.co.il OR from:pelephone.co.il OR from:yes.co.il OR from:012mobile.co.il OR from:isracard.co.il OR from:cal-online.co.il OR from:max.co.il OR from:stripe.com OR from:paypal.com OR from:amazon.com OR from:google.com OR from:microsoft.com OR from:apple.com OR from:aws.amazon.com OR from:wix.com OR from:fiverr.com OR from:upwork.com) has:attachment'

  return `${exclusions} (${subjectMatch} OR (${senderMatch})) after:${after}`
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader  = req.headers.get('Authorization') || ''
    const bearerToken = authHeader.replace('Bearer ', '')
    const supabase    = createClient(SUPABASE_URL(), SERVICE_ROLE_KEY())

    const userId = decodeUserId(authHeader)
    if (!userId) return jsonRes({ error: 'Unauthorized' }, 401)

    const accessToken = await getValidToken(supabase, userId)
    if (!accessToken) {
      return jsonRes({ error: 'Gmail not connected. Please connect Google account first.', needs_auth: true }, 401)
    }

    const body = await req.json().catch(() => ({}))

    // ══════════════════════════════════════════════════════════════
    // MODE 1: scan_only — fast metadata scan, no AI
    // ══════════════════════════════════════════════════════════════
    if (body.scan_only === true || !body.message_ids) {
      const query = buildQuery()
      console.log('[scan-gmail] scan_only query:', query)

      const messages = await gmailSearch(accessToken, query, 50)
      console.log(`[scan-gmail] Gmail returned ${messages.length} messages`)

      const emails = []

      for (const msg of messages) {
        try {
          // Skip already-imported
          const { data: existing } = await supabase
            .from('invoices').select('id').eq('email_message_id', msg.id).maybeSingle()
          if (existing) continue

          const fullMsg = await gmailGetMessage(accessToken, msg.id)
          if (!fullMsg) continue

          const { subject, from, date } = extractHeaders(fullMsg)
          const payload = fullMsg.payload as Record<string, unknown>
          const allAtts = extractAttachments(payload)
          const validAtts = allAtts.filter(a => a.size === 0 || a.size >= MIN_ATTACHMENT_SIZE)

          // Extract sender email for display
          const fromEmail = (from.match(/<(.+?)>/) || [, from])[1] || from

          emails.push({
            messageId:     msg.id,
            subject:       subject || '(ללא נושא)',
            from:          fromEmail,
            fromFull:      from,
            date:          date ? new Date(date).toISOString() : new Date().toISOString(),
            snippet:       (fullMsg.snippet as string || '').slice(0, 120),
            hasAttachment: validAtts.length > 0,
            attachments:   validAtts.map(a => ({
              filename:     a.filename,
              mimeType:     a.mimeType,
              attachmentId: a.attachmentId,
              size:         a.size,
            })),
          })
        } catch (e) {
          console.error(`[scan-gmail] error reading msg ${msg.id}:`, (e as Error).message)
        }
      }

      console.log(`[scan-gmail] returning ${emails.length} email candidates`)
      return jsonRes({ emails, total: emails.length, found: messages.length })
    }

    // ══════════════════════════════════════════════════════════════
    // MODE 2: message_ids — AI processing of selected emails
    // ══════════════════════════════════════════════════════════════
    const messageIds: string[] = (body.message_ids || []).slice(0, 20)  // max 20 to avoid timeout

    let processed = 0
    let skipped   = 0
    const errors: string[] = []

    for (const messageId of messageIds) {
      // Skip if already imported
      const { data: existing } = await supabase
        .from('invoices').select('id').eq('email_message_id', messageId).maybeSingle()
      if (existing) { skipped++; continue }

      try {
        const fullMsg = await gmailGetMessage(accessToken, messageId)
        if (!fullMsg) { skipped++; continue }

        const { subject, from } = extractHeaders(fullMsg)
        const payload = fullMsg.payload as Record<string, unknown>
        const allAtts = extractAttachments(payload)
        const validAtts = allAtts.filter(a => a.size === 0 || a.size >= MIN_ATTACHMENT_SIZE)
        const body2 = extractBody(fullMsg)

        let extracted: Record<string, unknown> | null = null

        if (validAtts.length > 0) {
          // Path A: process PDF/image attachment
          for (const att of validAtts) {
            const base64Data = await downloadAttachment(accessToken, messageId, att.attachmentId)
            if (!base64Data) continue
            const result = await processInvoice({ imageBase64: base64Data, mimeType: att.mimeType }, bearerToken)
            if (result && result.is_valid_invoice !== false) {
              extracted = result
              break
            }
          }
        }

        // Path B: no valid attachment → use email body text
        if (!extracted && body2.length > 80) {
          const result = await processInvoice({ text: body2, subject, from }, bearerToken)
          if (result && result.is_valid_invoice !== false) {
            extracted = result
          }
        }

        if (!extracted) { skipped++; continue }

        // Get email date
        const internalDate = fullMsg.internalDate
          ? new Date(Number(fullMsg.internalDate))
          : new Date()

        const month = (extracted.month as number) || (internalDate.getMonth() + 1)
        const year  = (extracted.year as number)  || internalDate.getFullYear()

        await supabase.from('invoices').insert({
          owner_id:         userId,
          vendor:           extracted.vendor         || null,
          invoice_number:   extracted.invoice_number || null,
          invoice_date:     extracted.invoice_date   || internalDate.toISOString().split('T')[0],
          amount:           extracted.amount         || null,
          vat_amount:       extracted.vat_amount     || null,
          total_amount:     extracted.total_amount   || null,
          category:         extracted.category       || 'other',
          month,
          year,
          description:      extracted.description   || subject || null,
          source:           'email',
          email_message_id: messageId,
          status:           'pending',
        })

        processed++
      } catch (e) {
        errors.push(`${messageId}: ${(e as Error).message}`)
        console.error(`[scan-gmail] error processing ${messageId}:`, (e as Error).message)
      }
    }

    return jsonRes({
      success:   true,
      processed,
      skipped,
      total:     messageIds.length,
      errors:    errors.length > 0 ? errors : undefined,
    })

  } catch (err) {
    console.error('[scan-gmail] fatal error:', (err as Error).message)
    return jsonRes({ error: (err as Error).message }, 500)
  }
})
