import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const cronSecret = process.env.CERT_EMAIL_CRON_SECRET || process.env.CRON_SECRET || ''

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isAuthorized(request: Request) {
  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
  const secret = new URL(request.url).searchParams.get('secret')
  return !cronSecret || request.headers.get('x-cert-email-secret') === cronSecret || bearerToken === cronSecret || secret === cronSecret
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return NextResponse.json({ error: 'Missing Supabase service role configuration' }, { status: 500 })

    const body = await request.json().catch(() => ({}))
    const pendingKeys = Array.isArray(body?.pendingKeys) ? body.pendingKeys.map(String).filter(Boolean) : []
    if (pendingKeys.length === 0) return NextResponse.json({ ok: false, reason: 'no_pending_keys' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('cert_email_logs')
      .update({ status: 'sent', error_message: null, sent_at: new Date().toISOString() })
      .in('unique_key', pendingKeys)

    if (error) throw error
    return NextResponse.json({ ok: true, marked: pendingKeys.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to mark sent' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
