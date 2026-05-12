import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'

const TRIGGERS = [180, 90, 60, 30, 14, 7, 0] as const
const DAY_MS = 24 * 60 * 60 * 1000
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const cronSecret = process.env.CERT_EMAIL_CRON_SECRET || process.env.CRON_SECRET || ''
const gmailUser = process.env.GMAIL_USER || ''
const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '')
const gmailFromName = process.env.GMAIL_FROM_NAME || 'KMT Crew Portal'
const shipCertToEmail = process.env.SHIP_CERT_TO_EMAIL || ''
const shipCertCcEmails = process.env.SHIP_CERT_CC_EMAILS || ''

type Crew = {
  id: string
  full_name?: string | null
  email?: string | null
}

type CrewCert = {
  id: string
  crew_id?: string | null
  cert_name?: string | null
  expiry_date?: string | null
}

type ShipCert = {
  id: string
  code?: string | null
  cert_name?: string | null
  expiry_date?: string | null
  has_expiry?: boolean | null
}

type EmailSettings = {
  ship_alert_enabled?: boolean | null
  my_cert_alert_enabled?: boolean | null
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

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7)
}

function isLastDayOfMonth(date = new Date()) {
  const tomorrow = new Date(date)
  tomorrow.setDate(date.getDate() + 1)
  return tomorrow.getDate() === 1
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
      return `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.expiry || '-')}</td><td>${escapeHtml(daysText)}</td></tr>`
    })
    .join('')
  return `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">
    <thead><tr><th align="left" style="border-bottom:1px solid #ddd;padding:8px">Certificate</th><th align="left" style="border-bottom:1px solid #ddd;padding:8px">Expiry</th><th align="left" style="border-bottom:1px solid #ddd;padding:8px">Days left</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`
}

async function sendEmail(input: { to: string[]; cc?: string[]; subject: string; html: string }) {
  if (!gmailUser || !gmailAppPassword) throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD')
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  })
  return transporter.sendMail({
    from: `${gmailFromName} <${gmailUser}>`,
    to: input.to.join(', '),
    cc: (input.cc || []).join(', '),
    subject: input.subject,
    html: input.html,
  })
}

async function insertLog(supabaseAdmin: any, payload: Record<string, unknown>) {
  if (payload.unique_key) {
    const { data: existing } = await supabaseAdmin
      .from('cert_email_logs')
      .select('id, status')
      .eq('unique_key', payload.unique_key)
      .maybeSingle()
    if (existing?.status && existing.status !== 'failed') return false
    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from('cert_email_logs')
        .update({ ...payload, status: 'pending', error_message: null, sent_at: null })
        .eq('id', existing.id)
      if (updateError) throw updateError
      return true
    }
  }

  const { error } = await supabaseAdmin.from('cert_email_logs').insert(payload)
  if (error && error.code !== '23505') throw error
  return !error
}

async function markLog(supabaseAdmin: any, uniqueKey: string, status: 'sent' | 'failed', errorMessage?: string) {
  await supabaseAdmin
    .from('cert_email_logs')
    .update({ status, error_message: errorMessage || null, sent_at: status === 'sent' ? new Date().toISOString() : null })
    .eq('unique_key', uniqueKey)
}

async function handleMyCerts(supabaseAdmin: any, settings: EmailSettings) {
  if (settings.my_cert_alert_enabled === false) return { sent: 0, failed: 0, skipped: true }
  const [{ data: crews }, { data: certs }] = await Promise.all([
    supabaseAdmin.from('crews').select('id, full_name, email'),
    supabaseAdmin.from('crew_certs').select('id, crew_id, cert_name, expiry_date'),
  ])

  let sent = 0
  let failed = 0
  const certsByCrew = new Map<string, CrewCert[]>()
  ;((certs || []) as CrewCert[]).forEach((cert) => {
    if (!cert.crew_id) return
    certsByCrew.set(cert.crew_id, [...(certsByCrew.get(cert.crew_id) || []), cert])
  })

  for (const crew of (crews || []) as Crew[]) {
    const email = String(crew.email || '').trim()
    if (!email) continue
    const crewCerts = certsByCrew.get(crew.id) || []
    const warningRows = crewCerts
      .map((cert) => ({ cert, days: daysUntil(cert.expiry_date) }))
      .filter((item) => isInWarningRange(item.days))
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
    const triggerRows = warningRows.filter((item) => getTrigger(item.days) !== null)
    if (triggerRows.length === 0 || warningRows.length === 0) continue

    const unsentTriggers = []
    for (const item of triggerRows) {
      const trigger = getTrigger(item.days)
      const uniqueKey = `my_cert:${crew.id}:${item.cert.id}:${trigger}`
      const inserted = await insertLog(supabaseAdmin, {
        unique_key: uniqueKey,
        alert_type: 'my_cert_trigger',
        scope: 'crew',
        trigger_label: String(trigger),
        recipient: email,
        subject: 'KMT Crew Certificate Reminder',
        crew_id: crew.id,
        crew_name: crew.full_name || '',
        related_cert_count: warningRows.length,
        payload: { triggerCert: item.cert, summaryCount: warningRows.length },
      })
      if (inserted) unsentTriggers.push({ ...item, uniqueKey })
    }
    if (unsentTriggers.length === 0) continue

    const subject = `KMT Certificate Reminder - ${crew.full_name || 'Crew'}`
    const html = `<p>Dear ${escapeHtml(crew.full_name || 'Crew')},</p>
      <p>One or more of your certificates reached a reminder trigger. Below is your certificate summary within 180 days or expired.</p>
      ${certRowsHtml(warningRows.map((item) => ({ label: item.cert.cert_name || 'Certificate', expiry: item.cert.expiry_date || '', days: item.days })))}
      <p>Please renew or upload updated certificates in KMT Crew Portal.</p>`

    try {
      await sendEmail({ to: [email], subject, html })
      await Promise.all(unsentTriggers.map((item) => markLog(supabaseAdmin, item.uniqueKey, 'sent')))
      sent += 1
    } catch (error: any) {
      await Promise.all(unsentTriggers.map((item) => markLog(supabaseAdmin, item.uniqueKey, 'failed', error?.message || 'Send failed')))
      failed += 1
    }
  }
  return { sent, failed, skipped: false }
}

async function handleMyCertMonthlySummary(supabaseAdmin: any, settings: EmailSettings) {
  if (settings.my_cert_alert_enabled === false) return { sent: 0, failed: 0, skipped: true }
  if (!isLastDayOfMonth()) return { sent: 0, failed: 0, skipped: true, reason: 'not_month_end' }

  const [{ data: crews }, { data: certs }] = await Promise.all([
    supabaseAdmin.from('crews').select('id, full_name, email'),
    supabaseAdmin.from('crew_certs').select('id, crew_id, cert_name, expiry_date'),
  ])

  let sent = 0
  let failed = 0
  const certsByCrew = new Map<string, CrewCert[]>()
  ;((certs || []) as CrewCert[]).forEach((cert) => {
    if (!cert.crew_id) return
    certsByCrew.set(cert.crew_id, [...(certsByCrew.get(cert.crew_id) || []), cert])
  })

  for (const crew of (crews || []) as Crew[]) {
    const email = String(crew.email || '').trim()
    if (!email) continue
    const crewCerts = certsByCrew.get(crew.id) || []
    if (crewCerts.length === 0) continue

    const rows = crewCerts
      .map((cert) => ({ cert, days: daysUntil(cert.expiry_date) }))
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
    const uniqueKey = `my_cert_monthly:${crew.id}:${monthKey()}`
    const inserted = await insertLog(supabaseAdmin, {
      unique_key: uniqueKey,
      alert_type: 'my_cert_monthly_summary',
      scope: 'crew',
      trigger_label: monthKey(),
      recipient: email,
      subject: 'KMT Monthly Certificate Summary',
      crew_id: crew.id,
      crew_name: crew.full_name || '',
      related_cert_count: rows.length,
      payload: { summaryCount: rows.length },
    })
    if (!inserted) continue

    const subject = `KMT Monthly Certificate Summary - ${crew.full_name || 'Crew'}`
    const html = `<p>Dear ${escapeHtml(crew.full_name || 'Crew')},</p>
      <p>This is your month-end certificate summary from KMT Crew Portal.</p>
      ${certRowsHtml(rows.map((item) => ({ label: item.cert.cert_name || 'Certificate', expiry: item.cert.expiry_date === '2099-12-31' ? 'No expiry' : item.cert.expiry_date || 'No expiry', days: item.days })))}
      <p>Please review and update any certificate that needs renewal.</p>`

    try {
      await sendEmail({ to: [email], subject, html })
      await markLog(supabaseAdmin, uniqueKey, 'sent')
      sent += 1
    } catch (error: any) {
      await markLog(supabaseAdmin, uniqueKey, 'failed', error?.message || 'Send failed')
      failed += 1
    }
  }

  return { sent, failed, skipped: false }
}

async function handleShipCerts(supabaseAdmin: any, settings: EmailSettings) {
  if (settings.ship_alert_enabled === false) return { sent: 0, failed: 0, skipped: true }
  const envTo = normalizeEmailList(shipCertToEmail.split(/[,\n;]/))
  const envCc = normalizeEmailList(shipCertCcEmails.split(/[,\n;]/))
  const to = envTo.length > 0 ? envTo : normalizeEmailList(settings.ship_to_emails)
  const cc = envCc.length > 0 ? envCc : normalizeEmailList(settings.ship_cc_emails)
  if (to.length === 0) return { sent: 0, failed: 0, skipped: true, reason: 'no_ship_recipients' }

  const { data } = await supabaseAdmin
    .from('ship_certificates')
    .select('id, code, cert_name, expiry_date, has_expiry')
    .eq('has_expiry', true)

  const rows = ((data || []) as ShipCert[])
    .map((cert) => ({ cert, days: daysUntil(cert.expiry_date) }))
    .filter((item) => isInWarningRange(item.days))
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
  if (rows.length === 0) return { sent: 0, failed: 0, skipped: false }

  const expiredRows = rows.filter((item) => (item.days ?? 9999) < 0)
  const triggerRows = rows.filter((item) => getTrigger(item.days) !== null)
  if (expiredRows.length === 0 && triggerRows.length === 0) return { sent: 0, failed: 0, skipped: false }

  const dateKey = isoDate()
  const triggerKeys = expiredRows.length > 0
    ? [`ship_cert_daily_expired:${dateKey}`]
    : triggerRows.map((item) => `ship_cert:${item.cert.id}:${getTrigger(item.days)}`)
  const insertedKeys = []
  for (const uniqueKey of triggerKeys) {
    const inserted = await insertLog(supabaseAdmin, {
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
    if (inserted) insertedKeys.push(uniqueKey)
  }
  if (insertedKeys.length === 0) return { sent: 0, failed: 0, skipped: false, reason: 'already_sent' }

  const subject = expiredRows.length > 0
    ? `KMT Ship Certificate Daily Alert - ${expiredRows.length} expired`
    : 'KMT Ship Certificate Reminder'
  const html = `<p>Dear Team,</p>
    <p>${expiredRows.length > 0 ? 'At least one ship certificate is expired. This daily summary will continue until the expired item is corrected.' : 'One or more ship certificates reached a reminder trigger.'}</p>
    ${certRowsHtml(rows.map((item) => ({ label: [item.cert.code, item.cert.cert_name].filter(Boolean).join(' | '), expiry: item.cert.expiry_date || '', days: item.days })))}
    <p>Please update the ship certificate record in KMT Crew Portal after renewal.</p>`

  try {
    await sendEmail({ to, cc, subject, html })
    await Promise.all(insertedKeys.map((key) => markLog(supabaseAdmin, key, 'sent')))
    return { sent: 1, failed: 0, skipped: false }
  } catch (error: any) {
    await Promise.all(insertedKeys.map((key) => markLog(supabaseAdmin, key, 'failed', error?.message || 'Send failed')))
    return { sent: 0, failed: 1, skipped: false }
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
    if (cronSecret && request.headers.get('x-cert-email-secret') !== cronSecret && bearerToken !== cronSecret && new URL(request.url).searchParams.get('secret') !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return NextResponse.json({ error: 'Missing Supabase service role configuration' }, { status: 500 })

    const { data: settingsRow } = await supabaseAdmin
      .from('cert_email_settings')
      .select('ship_alert_enabled, my_cert_alert_enabled, ship_to_emails, ship_cc_emails')
      .eq('id', 'default')
      .maybeSingle()
    const settings = (settingsRow || {}) as EmailSettings

    const myCert = { sent: 0, failed: 0, skipped: true, reason: 'push_notify_only' }
    const myCertMonthly = { sent: 0, failed: 0, skipped: true, reason: 'push_notify_only' }
    const shipCert = await handleShipCerts(supabaseAdmin, settings)

    return NextResponse.json({ ok: true, myCert, myCertMonthly, shipCert })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Certificate email cron failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
