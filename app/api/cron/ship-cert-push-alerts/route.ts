import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const TRIGGERS = [180, 90, 60, 30, 14, 7, 0] as const
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY || ''
const cronSecret = process.env.CRON_SECRET || ''
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://kmt-crew-portal.vercel.app'
const appUrl = rawAppUrl.startsWith('http') ? rawAppUrl : `https://${rawAppUrl}`
const adminRoles = new Set(['safety officer', 'chief officer', 'barge master'])

function normalizeRole(value: unknown) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function bangkokDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
  return { year: pick('year'), month: pick('month'), day: pick('day') }
}

function daysUntil(expiryDate: string) {
  const [year, month, day] = expiryDate.slice(0, 10).split('-').map(Number)
  const today = bangkokDateParts()
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.year, today.month - 1, today.day)) / 86400000)
}

function isAuthorized(request: Request) {
  if (!cronSecret) return true
  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${cronSecret}` || request.headers.get('x-cron-secret') === cronSecret
}

async function sendPush(externalIds: string[], cert: any, triggerDay: number) {
  if (!oneSignalAppId || !oneSignalApiKey) throw new Error('Missing OneSignal environment variables')
  const status = triggerDay === 0 ? 'expires today' : `expires in ${triggerDay} days`
  const response = await fetch('https://api.onesignal.com/notifications?c=push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${oneSignalApiKey}` },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      target_channel: 'push',
      include_aliases: { external_id: externalIds },
      headings: { en: 'Ship certificate reminder' },
      contents: { en: `${[cert.code, cert.cert_name].filter(Boolean).join(' | ')} ${status}.` },
      web_url: `${appUrl}/admin/ship-certificates`,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(JSON.stringify(data.errors || data.error || data))
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    await supabaseAdmin.from('notification_events').delete().lt('created_at', new Date(Date.now() - 180 * 86400000).toISOString())
    const [{ data: certs, error: certError }, { data: crews, error: crewError }] = await Promise.all([
      supabaseAdmin.from('ship_certificates').select('id, code, cert_name, expiry_date').eq('has_expiry', true),
      supabaseAdmin.from('crews').select('id, position, is_active, resigned_at'),
    ])
    if (certError || crewError) throw certError || crewError
    const externalIds = (crews || [])
      .filter((crew: any) => crew.is_active !== false && !crew.resigned_at && adminRoles.has(normalizeRole(crew.position)))
      .map((crew: any) => String(crew.id))
    const due = (certs || [])
      .filter((cert: any) => cert.expiry_date && cert.expiry_date !== '2099-12-31')
      .map((cert: any) => ({ cert, triggerDay: daysUntil(cert.expiry_date) }))
      .filter((item: any) => TRIGGERS.includes(item.triggerDay))
    let sent = 0
    let skipped = 0
    const failures: string[] = []

    for (const item of due) {
      const uniqueKey = `ship-cert-push:${item.cert.id}:${item.cert.expiry_date}:${item.triggerDay}`
      const { data: existing } = await supabaseAdmin.from('ship_cert_push_logs').select('id, status').eq('unique_key', uniqueKey).maybeSingle()
      if (existing?.status === 'sent' || existing?.status === 'pending') {
        skipped += 1
        continue
      }
      const logPayload = {
        unique_key: uniqueKey,
        certificate_id: item.cert.id,
        trigger_day: item.triggerDay,
        expiry_date: item.cert.expiry_date,
        target_count: externalIds.length,
        status: 'pending',
        error_message: null,
        sent_at: null,
      }
      const { data: log, error: logError } = existing?.id
        ? await supabaseAdmin.from('ship_cert_push_logs').update(logPayload).eq('id', existing.id).select('id').single()
        : await supabaseAdmin.from('ship_cert_push_logs').insert(logPayload).select('id').single()
      if (logError || !log) throw logError || new Error('Unable to create push log')

      try {
        await sendPush(externalIds, item.cert, item.triggerDay)
        await supabaseAdmin.from('ship_cert_push_logs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', log.id)
        sent += 1
      } catch (error: any) {
        const message = error?.message || 'Push failed'
        failures.push(`${item.cert.code || item.cert.id}: ${message}`)
        await supabaseAdmin.from('ship_cert_push_logs').update({ status: 'failed', error_message: message }).eq('id', log.id)
      }
    }

    return NextResponse.json({ ok: failures.length === 0, due: due.length, sent, skipped, failures })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Ship certificate push alert failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
