import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_CLIENT_ID     = () => Deno.env.get('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = () => Deno.env.get('GOOGLE_CLIENT_SECRET')
// Use server-side redirect URI (must match Google Cloud Console + secret)
const GOOGLE_REDIRECT_URI  = () => Deno.env.get('GOOGLE_REDIRECT_URI')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Get user from JWT
    let userId: string | null = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'exchange_code': {
        const { code, redirectUri: clientRedirectUri } = body
        // Use same redirect URI that was used in get_auth_url (must match exactly)
        const redirectUri = GOOGLE_REDIRECT_URI() || clientRedirectUri
        if (!GOOGLE_CLIENT_ID() || !GOOGLE_CLIENT_SECRET()) {
          return jsonRes({ error: 'Google OAuth credentials not configured' }, 500)
        }

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id:     GOOGLE_CLIENT_ID()!,
            client_secret: GOOGLE_CLIENT_SECRET()!,
            redirect_uri:  redirectUri,
            grant_type:    'authorization_code',
          }),
        })
        const tokens = await tokenRes.json()

        if (!tokenRes.ok) return jsonRes({ error: tokens.error_description || 'Token exchange failed' }, 400)

        const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

        await supabase.from('google_tokens').upsert({
          user_id:       userId,
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at:    expiresAt,
        }, { onConflict: 'user_id' })

        return jsonRes({ success: true })
      }

      case 'refresh_token': {
        const { data: tokenRow } = await supabase
          .from('google_tokens').select('*').eq('user_id', userId).single()
        if (!tokenRow) return jsonRes({ error: 'No Google token found' }, 404)

        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            refresh_token: tokenRow.refresh_token,
            client_id:     GOOGLE_CLIENT_ID()!,
            client_secret: GOOGLE_CLIENT_SECRET()!,
            grant_type:    'refresh_token',
          }),
        })
        const newTokens = await refreshRes.json()
        if (!refreshRes.ok) return jsonRes({ error: 'Refresh failed' }, 400)

        const expiresAt = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString()
        await supabase.from('google_tokens').update({
          access_token: newTokens.access_token,
          expires_at:   expiresAt,
        }).eq('user_id', userId)

        return jsonRes({ success: true, access_token: newTokens.access_token })
      }

      case 'sync_tasks': {
        const accessToken = await getValidToken(supabase, userId!)
        if (!accessToken) return jsonRes({ error: 'Not connected to Google Calendar' }, 401)

        const { tasks } = body
        let synced = 0
        for (const task of (tasks || [])) {
          if (!task.dueDate || task.completed) continue

          // Check if already synced
          const { data: existing } = await supabase
            .from('calendar_events')
            .select('google_event_id')
            .eq('entity_type', 'task').eq('entity_id', task.id).eq('user_id', userId)
            .maybeSingle()

          const event = {
            summary:     `📋 ${task.title}`,
            description: `CRM Task | Priority: ${task.priority}`,
            start:       { date: task.dueDate },
            end:         { date: task.dueDate },
          }

          if (existing) {
            await updateCalendarEvent(accessToken, existing.google_event_id, event)
          } else {
            const created = await createCalendarEvent(accessToken, event)
            if (created?.id) {
              await supabase.from('calendar_events').insert({
                user_id: userId, google_event_id: created.id,
                entity_type: 'task', entity_id: task.id,
              })
            }
          }
          synced++
        }
        return jsonRes({ success: true, synced })
      }

      case 'sync_classes': {
        const accessToken = await getValidToken(supabase, userId!)
        if (!accessToken) return jsonRes({ error: 'Not connected to Google Calendar' }, 401)

        const { classes } = body
        let synced = 0
        for (const cls of (classes || [])) {
          const { data: existing } = await supabase
            .from('calendar_events')
            .select('google_event_id')
            .eq('entity_type', 'class').eq('entity_id', cls.id).eq('user_id', userId)
            .maybeSingle()

          const startDate = cls.year && cls.month && cls.day
            ? `${cls.year}-${String(cls.month).padStart(2,'0')}-${String(cls.day).padStart(2,'0')}`
            : null
          if (!startDate) continue

          const event = {
            summary:     `📚 ${cls.class_name || cls.className || 'חוג'}`,
            description: `${cls.location || ''} | ${cls.contact_name || cls.contactName || ''}`,
            start:       cls.time_start
              ? { dateTime: `${startDate}T${cls.time_start}:00`, timeZone: 'Asia/Jerusalem' }
              : { date: startDate },
            end:         cls.time_start
              ? { dateTime: `${startDate}T${cls.time_start.split(':').map((v: string, i: number) => i === 0 ? String(Number(v)+1).padStart(2,'0') : v).join(':')}:00`, timeZone: 'Asia/Jerusalem' }
              : { date: startDate },
          }

          if (existing) {
            await updateCalendarEvent(accessToken, existing.google_event_id, event)
          } else {
            const created = await createCalendarEvent(accessToken, event)
            if (created?.id) {
              await supabase.from('calendar_events').insert({
                user_id: userId, google_event_id: created.id,
                entity_type: 'class', entity_id: cls.id,
              })
            }
          }
          synced++
        }
        return jsonRes({ success: true, synced })
      }

      case 'get_auth_url': {
        if (!GOOGLE_CLIENT_ID()) {
          return jsonRes({ error: 'Google OAuth credentials not configured on server' }, 500)
        }
        const { redirectUri: clientRedirectUri, state: oauthState } = body
        // Prefer server-side GOOGLE_REDIRECT_URI secret; fallback to client-provided
        const redirectUri = GOOGLE_REDIRECT_URI() || clientRedirectUri
        const scopes = [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/gmail.readonly',
        ].join(' ')
        const params = new URLSearchParams({
          client_id:     GOOGLE_CLIENT_ID()!,
          redirect_uri:  redirectUri,
          response_type: 'code',
          scope:         scopes,
          access_type:   'offline',
          prompt:        'consent',
          state:         oauthState || 'google_calendar_connect',
        })
        return jsonRes({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
      }

      case 'check_connection': {
        const { data } = await supabase
          .from('google_tokens').select('id, expires_at').eq('user_id', userId).maybeSingle()
        return jsonRes({ connected: !!data, expiresAt: data?.expires_at })
      }

      case 'disconnect': {
        await supabase.from('google_tokens').delete().eq('user_id', userId)
        await supabase.from('calendar_events').delete().eq('user_id', userId)
        return jsonRes({ success: true })
      }

      default:
        return jsonRes({ error: 'Unknown action: ' + action }, 400)
    }
  } catch (err) {
    return jsonRes({ error: err.message }, 500)
  }
})

// ── Helpers ───────────────────────────────────────────────────────
function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getValidToken(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) return null

  // Check if token is expired (with 5 min buffer)
  if (new Date(data.expires_at) < new Date(Date.now() + 5 * 60000)) {
    // Refresh it
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: data.refresh_token,
        client_id:     GOOGLE_CLIENT_ID()!,
        client_secret: GOOGLE_CLIENT_SECRET()!,
        grant_type:    'refresh_token',
      }),
    })
    const newTokens = await refreshRes.json()
    if (!refreshRes.ok) return null

    await supabase.from('google_tokens').update({
      access_token: newTokens.access_token,
      expires_at:   new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
    }).eq('user_id', userId)

    return newTokens.access_token
  }
  return data.access_token
}

async function createCalendarEvent(accessToken: string, event: any) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  return res.json()
}

async function updateCalendarEvent(accessToken: string, eventId: string, event: any) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  return res.json()
}
