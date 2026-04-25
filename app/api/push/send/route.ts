import { NextResponse } from 'next/server'
import webpush from 'web-push'
import type { PushSubscription } from 'web-push'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isAdminRole } from '@/lib/roles'

export const runtime = 'nodejs'

type PushEventType = 'new_ppe_request' | 'request_approved' | 'request_rejected' | 'cert_alert'

type PushSubscriptionRow = {
  id: string
  crew_id: string
  role?: string | null
  subscription: PushSubscription
}

function getVapidConfig() {
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@kmt-crew-portal.local'
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) return null

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return { publicKey, privateKey }
}

function buildPayload(input: {
  type: PushEventType
  requestId?: string
  title?: string
  body?: string
  url?: string
}) {
  if (input.type === 'new_ppe_request') {
    return {
      title: input.title || 'New PPE Request',
      body: input.body || 'A crew member submitted a PPE request.',
      url: input.requestId ? `/admin/approvals?request=${input.requestId}` : '/admin/approvals',
      tag: input.requestId ? `ppe-request-${input.requestId}` : 'ppe-request',
    }
  }

  if (input.type === 'request_approved') {
    return {
      title: input.title || 'PPE Request Approved',
      body: input.body || 'Your PPE request is ready to receive.',
      url: '/my-requests',
      tag: input.requestId ? `ppe-approved-${input.requestId}` : 'ppe-approved',
    }
  }

  if (input.type === 'request_rejected') {
    return {
      title: input.title || 'PPE Request Rejected',
      body: input.body || 'Please check My Requests for details.',
      url: '/my-requests',
      tag: input.requestId ? `ppe-rejected-${input.requestId}` : 'ppe-rejected',
    }
  }

  return {
    title: input.title || 'Certificate Action Needed',
    body: input.body || 'A certificate needs your attention.',
    url: input.url || '/certificates',
    tag: 'cert-alert',
  }
}

async function getTargets(type: PushEventType, targetCrewId?: string) {
  let query = supabaseAdmin.from('push_subscriptions').select('id, crew_id, role, subscription').eq('enabled', true)

  if (type === 'new_ppe_request') {
    const { data, error } = await query
    if (error) throw error
    return ((data || []) as PushSubscriptionRow[]).filter((row) => isAdminRole(row.role))
  }

  if (targetCrewId) {
    query = query.eq('crew_id', targetCrewId)
  } else {
    return []
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as PushSubscriptionRow[]
}

export async function POST(request: Request) {
  const vapid = getVapidConfig()
  if (!vapid) {
    return NextResponse.json({ ok: false, skipped: 'Missing VAPID keys' }, { status: 200 })
  }

  try {
    const body = await request.json()
    const type = body.type as PushEventType

    if (!['new_ppe_request', 'request_approved', 'request_rejected', 'cert_alert'].includes(type)) {
      return NextResponse.json({ error: 'Invalid push event type' }, { status: 400 })
    }

    let targets = await getTargets(type, body.targetCrewId)
    if (!targets.length && body.targetCrewName && type !== 'new_ppe_request') {
      const { data, error } = await supabaseAdmin
        .from('push_subscriptions')
        .select('id, crew_id, role, subscription')
        .eq('enabled', true)
        .eq('crew_name', body.targetCrewName)
      if (error) throw error
      targets = (data || []) as PushSubscriptionRow[]
    }
    const payload = JSON.stringify(buildPayload(body))

    const results = await Promise.allSettled(
      targets.map((target) =>
        webpush.sendNotification(target.subscription, payload).catch(async (error) => {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').update({ enabled: false }).eq('id', target.id)
          }
          throw error
        }),
      ),
    )

    const sent = results.filter((result) => result.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent, attempted: targets.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to send push notification' }, { status: 500 })
  }
}
