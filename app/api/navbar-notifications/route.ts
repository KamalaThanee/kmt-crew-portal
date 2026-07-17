import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyPpeRequestUserFilterWithClient } from '@/lib/ppeRequests'
import { isAdminRole, normalizeRole } from '@/lib/roles'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type CurrentCrew = {
  id: string
  full_name?: string | null
  position?: string | null
  is_active?: boolean | null
  resigned_at?: string | null
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service role environment variables')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function authenticateCrew(request: Request, supabaseAdmin: any) {
  const crewId = request.headers.get('x-kmt-user-id') || ''
  const pin = (request.headers.get('x-kmt-pin') || '').replace(/\D/g, '').slice(0, 6)
  if (!crewId || pin.length !== 6) return null
  const { data, error } = await supabaseAdmin
    .from('crews')
    .select('id, full_name, position, is_active, resigned_at')
    .eq('id', crewId)
    .eq('pin', pin)
    .maybeSingle()
  if (error || !data || data.is_active === false || data.resigned_at) return null
  return data as CurrentCrew
}

function eventTargetsCrew(event: any, crew: CurrentCrew) {
  if (event.audience === 'all') return true
  if (event.audience === 'admins') return isAdminRole(crew.position)
  if (event.audience === 'roles') {
    const roles = (event.target_roles || []).map(normalizeRole)
    return roles.includes(normalizeRole(crew.position))
  }
  if (event.audience === 'users') return (event.target_user_ids || []).map(String).includes(String(crew.id))
  return false
}

function buildPpeSizeActions(windowRow: any, crew: CurrentCrew) {
  if (!windowRow?.id) return []
  return [{
    id: `ppe-size-${windowRow.id}`,
    status: 'ppe-size',
    title: windowRow.title || 'Confirm PPE sizes',
    description: windowRow.deadline_at
      ? `Deadline ${new Date(windowRow.deadline_at).toLocaleString('en-GB')}`
      : 'Boiler suit and safety boots survey',
    href: '/dashboard?ppe=size#ppe-size-update',
  }]
}

async function fetchActivity(supabaseAdmin: any, crew: CurrentCrew, limit = 8) {
  const [{ data: state }, { data: events, error }] = await Promise.all([
    supabaseAdmin.from('notification_user_state').select('last_read_at, cleared_at').eq('user_id', crew.id).maybeSingle(),
    supabaseAdmin.from('notification_events').select('*').order('created_at', { ascending: false }).limit(100),
  ])
  if (error) throw error

  const clearedAt = state?.cleared_at ? new Date(state.cleared_at).getTime() : 0
  const lastReadAt = state?.last_read_at ? new Date(state.last_read_at).getTime() : 0
  const visibleEvents = (events || [])
    .filter((event: any) => eventTargetsCrew(event, crew))
    .filter((event: any) => new Date(event.created_at).getTime() > clearedAt)
  const unreadCount = visibleEvents.filter((event: any) => new Date(event.created_at).getTime() > lastReadAt).length
  const actions = visibleEvents.slice(0, limit).map((event: any) => ({
    id: event.id,
    href: event.href || '/',
    title: event.title,
    description: event.description,
    meta: event.created_at ? new Date(event.created_at).toLocaleString('en-GB') : '',
    tone: event.tone || 'sky',
    icon: event.icon || 'activity',
    createdAt: event.created_at,
    isUnread: new Date(event.created_at).getTime() > lastReadAt,
  }))
  return { actions, unreadCount, readThrough: visibleEvents[0]?.created_at || new Date().toISOString() }
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const crew = await authenticateCrew(request, supabaseAdmin)
    if (!crew) return badRequest('Authentication required', 401)
    const activityLimit = new URL(request.url).searchParams.get('view') === 'all' ? 30 : 8

    const [{ data: sizeWindow }, activity] = await Promise.all([
      supabaseAdmin
        .from('ppe_size_windows')
        .select('id, title, deadline_at')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchActivity(supabaseAdmin, crew, activityLimit),
    ])
    const ppeSizeActions = buildPpeSizeActions(sizeWindow, crew)

    if (isAdminRole(crew.position)) {
      return NextResponse.json({
        pending: 0,
        lowStock: 0,
        expiredCerts: 0,
        ppeSizeActions,
        pendingActions: [],
        shipCertActions: [],
        adminActions: activity.actions,
        activityUnreadCount: activity.unreadCount,
        activityReadThrough: activity.readThrough,
        personalUpdates: [],
        personalCertActions: [],
        updates: [],
        approvedCount: 0,
        personalApprovedCount: 0,
        personalUpdateCount: 0,
        adminUploadCount: activity.actions.length,
        personalCertAlertCount: 0,
        ppeSizeAlertCount: ppeSizeActions.length,
        shipCertAlertCount: 0,
      })
    }

    const countQuery = await applyPpeRequestUserFilterWithClient(
      supabaseAdmin,
      supabaseAdmin.from('ppe_requests').select('*', { count: 'exact', head: true }).in('status', ['approved', 'rejected']),
      { id: crew.id, full_name: crew.full_name || '' },
    )
    const updatesQuery = await applyPpeRequestUserFilterWithClient(
      supabaseAdmin,
      supabaseAdmin
        .from('ppe_requests')
        .select('id, created_at, status, admin_remark, rejection_reason, reason, items')
        .in('status', ['approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(6),
      { id: crew.id, full_name: crew.full_name || '' },
    )
    const [{ count }, { data: updates }] = await Promise.all([countQuery, updatesQuery])
    const rows = updates || []
    const actionItems = rows.map((req: any) => {
      const itemName = req.items?.[0]?.item_name || 'PPE item'
      const approved = req.status === 'approved'
      return {
        id: req.id,
        status: req.status,
        title: approved ? 'PPE ready to receive' : 'PPE issue rejected',
        description: approved
          ? `${itemName} is waiting for your confirmation`
          : req.admin_remark || req.rejection_reason || `${itemName} needs your attention`,
      }
    })

    return NextResponse.json({
      pending: count || 0,
      lowStock: 0,
      expiredCerts: 0,
      ppeSizeActions,
      personalCertActions: [],
      shipCertActions: [],
      adminActions: activity.actions,
      activityUnreadCount: activity.unreadCount,
      activityReadThrough: activity.readThrough,
      updates: actionItems,
      approvedCount: rows.filter((req: any) => req.status === 'approved').length,
      personalCertAlertCount: 0,
      ppeSizeAlertCount: ppeSizeActions.length,
      personalUpdates: [],
      personalApprovedCount: 0,
      shipCertAlertCount: 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load notifications' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const crew = await authenticateCrew(request, supabaseAdmin)
    if (!crew) return badRequest('Authentication required', 401)
    const body = await request.json().catch(() => ({}))
    const action = body?.action
    if (action !== 'mark-read' && action !== 'clear-read') return badRequest('Unknown notification action')

    const readThrough = body?.readThrough && !Number.isNaN(new Date(body.readThrough).getTime())
      ? new Date(body.readThrough).toISOString()
      : new Date().toISOString()
    let payload: Record<string, unknown>
    if (action === 'mark-read') {
      payload = { user_id: crew.id, last_read_at: readThrough, updated_at: new Date().toISOString() }
    } else {
      const { data: state } = await supabaseAdmin
        .from('notification_user_state')
        .select('last_read_at')
        .eq('user_id', crew.id)
        .maybeSingle()
      if (!state?.last_read_at) return NextResponse.json({ ok: true, action, cleared: 0 })
      payload = { user_id: crew.id, cleared_at: state.last_read_at, updated_at: new Date().toISOString() }
    }
    const { error } = await supabaseAdmin.from('notification_user_state').upsert(payload, { onConflict: 'user_id' })
    if (error) throw error
    return NextResponse.json({ ok: true, action, readThrough })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to update notification state' }, { status: 500 })
  }
}
