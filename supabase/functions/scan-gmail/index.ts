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
  return data.messages || []
}

async function gmailGetMessage(accessToken: string, messageId: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.json()
}

// ── Extract attachments from Gmail message ────────────────────────
function extractAttachments(message: Record<string, unknown>) {
  const attachments: Array<{ filename: string; mimeType: string; attachmentId: string }> = []

  function walkParts(parts: Array<Record<string, unknown>>) {
    for (const part of (parts || [])) {
      const body = part.body as Record<string, unknown>
      if (
        body?.attachmentId &&
        (
          (part.mimeType as string)?.startsWith('image/') ||
          part.mimeType === 'application/pdf'
        )
      ) {
        attachments.push({
          filename:     (part.filename as string) || 'attachment',
          mimeType:     (part.mimeType as string) || 'application/octet-stream',
          attachmentId: body.attachmentId as string,
        })
      }
      if (Array.isArray(part.parts)) walkParts(part.parts as Array<Record<string, unknown>>)
    }
  }

  const payload = message.payload as Record<string, unknown>
  if (Array.isArray(payload?.parts)) walkParts(payload.parts as Array<Record<string, unknown>>)
  return attachments
}

// ── Download attachment ───────────────────────────────────────────
async function downloadAttachment(accessToken: string, messageId: string, attachmentId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  // Gmail returns base64url — convert to standard base64
  return (data.data as string || '').replace(/-/g, '+').replace(/_/g, '/')
}

// ── Call process-invoice edge function ────────────────────────────
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

// ── Main handler ─────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const supabase   = createClient(SUPABASE_URL(), SERVICE_ROLE_KEY())

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return jsonRes({ error: 'Unauthorized' }, 401)
    const userId = user.id

    // Get valid Google token
    const accessToken = await getValidToken(supabase, userId)
    if (!accessToken) {
      return jsonRes({ error: 'Gmail not connected. Please connect Google account first.', needs_auth: true }, 401)
    }

    // Gmail search query — looks for invoices in Hebrew and English
    const searchQuery = 'חשבונית OR invoice OR receipt OR קבלה OR "tax invoice" newer_than:30d'
    const messages    = await gmailSearch(accessToken, searchQuery, 30)

    let processed = 0
    let skipped   = 0
    const errors: string[] = []

    for (const msg of messages) {
      const messageId = msg.id as string

      // Skip if already imported
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('email_message_id', messageId)
        .maybeSingle()

      if (existing) { skipped++; continue }

      try {
        // Get full message with attachments
        const fullMsg    = await gmailGetMessage(accessToken, messageId)
        const attachments = extractAttachments(fullMsg)

        if (attachments.length === 0) { skipped++; continue }

        // Process first valid attachment
        for (const att of attachments) {
          const base64Data  = await downloadAttachment(accessToken, messageId, att.attachmentId)
          if (!base64Data)  continue

          const extracted = await processInvoiceImage(base64Data, att.mimeType, token)
          if (!extracted)   continue

          // Get email date for fallback
          const internalDate = fullMsg.internalDate
            ? new Date(Number(fullMsg.internalDate))
            : new Date()

          const month = extracted.month || (internalDate.getMonth() + 1)
          const year  = extracted.year  || internalDate.getFullYear()

          await supabase.from('invoices').insert({
            owner_id:        userId,
            vendor:          extracted.vendor          || null,
            invoice_number:  extracted.invoice_number  || null,
            invoice_date:    extracted.invoice_date     || internalDate.toISOString().split('T')[0],
            amount:          extracted.amount           || null,
            vat_amount:      extracted.vat_amount       || null,
            total_amount:    extracted.total_amount     || null,
            category:        extracted.category         || 'אחר',
            month,
            year,
            description:     extracted.description      || null,
            source:          'email',
            email_message_id: messageId,
            status:          'pending',
          })

          processed++
          break // only first attachment per email
        }
      } catch (e) {
        errors.push(`${messageId}: ${(e as Error).message}`)
      }
    }

    return jsonRes({
      success:   true,
      processed,
      skipped,
      total:     messages.length,
      errors:    errors.length > 0 ? errors : undefined,
    })

  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500)
  }
})
