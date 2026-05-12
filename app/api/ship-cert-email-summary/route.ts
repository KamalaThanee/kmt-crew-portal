import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const TRIGGERS = [180, 90, 60, 30, 14, 7, 0] as const
const DAY_MS = 24 * 60 * 60 * 1000
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const cronSecret = process.env.CERT_EMAIL_CRON_SECRET || process.env.CRON_SECRET || ''

type ShipCert = {
  id: string
  code?: string | null
  cert_name?: string | null
  expiry_date?: string | null
  has_expiry?: boolean | null
}

type EmailSettings = {
  ship_alert_enabled?: boolean | null
  ship_to_emails?: string[] | null
  ship_cc_emails?: string[] | null
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function todayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function daysUntil(value?: string | null) {
  if (!value || value === '2099-12-31') return null
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  return Math.ceil((target.getTime() - todayStart().getTime()) / DAY_MS)
}

function getTrigger(days: number | null) {
  if (days === null) return null
  if (days < 0) return 0
  return TRIGGERS.find((trigger) => days === trigger) ?? null
}

function isInWarningRange(days: number | null) {
  return days !== null && days <= 180
}

function normalizeEmailList(values?: string[] | null) {
  return Array.from(new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean)))
}

function escapeHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function certRowsHtml(rows: Array<{ label: string; expiry: string; days: number | null }>) {
  const body = rows
    .map((row) => {
      const daysText = row.days === null ? '-' : row.days < 0 ? `Expired ${Math.abs(row.days)} day(s)` : `${row.days} day(s)`
      return `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd">${escapeHtml(row.label)}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd">${escapeHtml(row.expiry || '-')}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd">${escapeHtml(daysText)}</td></tr>`
    })
    .join('')
  return `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">
    <thead><tr><th align="left" style="border-bottom:2px solid #ccc;padding:8px">Certificate</th><th align="left" style="border-bottom:2px solid #ccc;padding:8px">Expiry</th><th align="left" style="border-bottom:2px solid #ccc;padding:8px">Days left</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`
}

async function insertPendingLog(supabaseAdmin: any, payload: Record<string, unknown>) {
  if (payload.unique_key) {
    const { data: existing } = await supabaseAdmin
      .from('cert_email_logs')
      .select('id, status')
      .eq('unique_key', payload.unique_key)
      .maybeSingle()

    if (existing?.status === 'sent' || existing?.status === 'pending') return false
    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from('cert_email_logs')
        .update({ ...payload, status: 'pending', error_message: null, sent_at: null })
        .eq('id', existing.id)
      if (updateError) throw updateError
      return true
    }
  }

  const { error } = await supabaseAdmin.from('cert_email_logs').insert({ ...payload, status: 'pending' })
  if (error && error.code !== '23505') throw error
  return !error
}

function isAuthorized(request: Request) {
  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
  const secret = new URL(request.url).searchParams.get('secret')
  return !cronSecret || request.headers.get('x-cert-email-secret') === cronSecret || bearerToken === cronSecret || secret === cronSecret
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return NextResponse.json({ error: 'Missing Supabase service role configuration' }, { status: 500 })

    const { data: settingsRow } = await supabaseAdmin
      .from('cert_email_settings')
      .select('ship_alert_enabled, ship_to_emails, ship_cc_emails')
      .eq('id', 'default')
      .maybeSingle()
    const settings = (settingsRow || {}) as EmailSettings
    if (settings.ship_alert_enabled === false) return NextResponse.json({ shouldSend: false, reason: 'ship_alert_disabled' })

    const to = normalizeEmailList(settings.ship_to_emails)
    const cc = normalizeEmailList(settings.ship_cc_emails)
    if (to.length === 0) return NextResponse.json({ shouldSend: false, reason: 'no_ship_recipients' })

    const { data } = await supabaseAdmin
      .from('ship_certificates')
      .select('id, code, cert_name, expiry_date, has_expiry')
      .eq('has_expiry', true)

    const rows = ((data || []) as ShipCert[])
      .map((cert) => ({ cert, days: daysUntil(cert.expiry_date) }))
      .filter((item) => isInWarningRange(item.days))
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
    if (rows.length === 0) return NextResponse.json({ shouldSend: false, reason: 'no_warning_range' })

    const expiredRows = rows.filter((item) => (item.days ?? 9999) < 0)
    const triggerRows = rows.filter((item) => getTrigger(item.days) !== null)
    if (expiredRows.length === 0 && triggerRows.length === 0) {
      return NextResponse.json({ shouldSend: false, reason: 'no_due_alert' })
    }

    const dateKey = isoDate()
    const triggerKeys = expiredRows.length > 0
      ? [`ship_cert_daily_expired:${dateKey}`]
      : triggerRows.map((item) => `ship_cert:${item.cert.id}:${getTrigger(item.days)}`)
    const pendingKeys: string[] = []

    for (const uniqueKey of triggerKeys) {
      const inserted = await insertPendingLog(supabaseAdmin, {
        unique_key: uniqueKey,
        alert_type: expiredRows.length > 0 ? 'ship_cert_daily_expired' : 'ship_cert_trigger',
        scope: 'ship',
        trigger_label: expiredRows.length > 0 ? 'expired_daily' : 'milestone',
        recipient: to.join(', '),
        cc,
        subject: 'KMT Ship Certificate Alert',
        related_cert_count: rows.length,
        payload: { expiredCount: expiredRows.length, summaryCount: rows.length },
      })
      if (inserted) pendingKeys.push(uniqueKey)
    }

    if (pendingKeys.length === 0) return NextResponse.json({ shouldSend: false, reason: 'already_sent_or_pending' })

    const subject = expiredRows.length > 0
      ? `KMT Ship Certificate Daily Alert - ${expiredRows.length} expired`
      : 'KMT Ship Certificate Reminder'
    const html = `<p>Dear Team,</p>
      <p>${expiredRows.length > 0 ? 'At least one ship certificate is expired. This daily summary will continue until the expired item is corrected.' : 'One or more ship certificates reached a reminder trigger. The summary below includes all ship certificates currently in the reminder range.'}</p>
      ${certRowsHtml(rows.map((item) => ({ label: [item.cert.code, item.cert.cert_name].filter(Boolean).join(' | '), expiry: item.cert.expiry_date || '', days: item.days })))}
      <p>Please update the ship certificate record in KMT Crew Portal after renewal.</p>`

    return NextResponse.json({
      shouldSend: true,
      reason: expiredRows.length > 0 ? 'expired_daily' : 'new_trigger',
      subject,
      html,
      text: 'Please view this email in HTML format.',
      to,
      cc,
      pendingKeys,
      expiredCount: expiredRows.length,
      summaryCount: rows.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Ship certificate email summary failed' }, { status: 500 })
  }
}
