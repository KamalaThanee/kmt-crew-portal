import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyPpeRequestUserFilterWithClient } from '@/lib/ppeRequests'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type CurrentUserParams = {
  userId: string
  fullName: string
}

type PpeSizeWindow = {
  id?: string
  title?: string | null
  deadline_at?: string | null
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function buildPpeSizeActions(windowRow: PpeSizeWindow | null, user: CurrentUserParams) {
  if (!windowRow?.id || !user.userId) return []

  const deadline = windowRow.deadline_at
    ? `Deadline ${new Date(windowRow.deadline_at).toLocaleString('en-GB')}`
    : 'Boiler suit and safety boots survey'

  return [{
    id: `ppe-size-${windowRow.id}`,
    status: 'ppe-size',
    title: windowRow.title || 'Confirm PPE sizes',
    description: deadline,
    href: '/dashboard?ppe=size#ppe-size-update',
  }]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || ''
  const fullName = searchParams.get('fullName') || ''
  const isAdmin = searchParams.get('isAdmin') === 'true'

  if (!userId && !fullName) {
    return badRequest('Missing user identity')
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const user = { userId, fullName }

    const fetchActivePpeSizeWindow = async () => {
      const { data, error } = await supabaseAdmin
        .from('ppe_size_windows')
        .select('id, title, deadline_at')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return null
      return (data || null) as PpeSizeWindow | null
    }

    if (isAdmin) {
      const personalCountQuery = await applyPpeRequestUserFilterWithClient(
        supabaseAdmin,
        supabaseAdmin.from('ppe_requests').select('*', { count: 'exact', head: true }).in('status', ['approved', 'rejected']),
        { id: userId, full_name: fullName },
      )

      const personalUpdatesQuery = await applyPpeRequestUserFilterWithClient(
        supabaseAdmin,
        supabaseAdmin
          .from('ppe_requests')
          .select('id, created_at, status, admin_remark, rejection_reason, reason, items')
          .in('status', ['approved', 'rejected'])
          .order('created_at', { ascending: false })
          .limit(6),
        { id: userId, full_name: fullName },
      )

      const [pendingRes, pendingRowsRes, personalCountRes, personalUpdatesRes, activePpeSizeWindow] = await Promise.all([
        supabaseAdmin.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabaseAdmin.from('ppe_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
        personalCountQuery,
        personalUpdatesQuery,
        fetchActivePpeSizeWindow(),
      ])

      const pendingRows = pendingRowsRes.data || []
      const personalRows = personalUpdatesRes.data || []

      const pendingActions = pendingRows.map((req: any) => {
        const crewName = req.crew_name || req.requester_name || req.full_name || 'Unknown crew'
        const firstItem = req.items?.[0]?.item_name || 'PPE item'
        const itemCount = req.items?.length || 0
        const moreLabel = itemCount > 1 ? ` +${itemCount - 1} more` : ''
        return {
          id: `pending-${req.id}`,
          href: '/ppe?view=history',
          title: `${crewName} needs PPE review`,
          description: `${firstItem}${moreLabel}`,
          meta: new Date(req.created_at).toLocaleString('en-GB'),
          countLabel: 'NEW',
          tone: 'amber',
          icon: 'clock',
        }
      })

      const personalUpdates = personalRows.map((req: any) => {
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

      const ppeSizeActions = buildPpeSizeActions(activePpeSizeWindow, user)

      return NextResponse.json({
        pending: pendingRes.count || 0,
        lowStock: 0,
        expiredCerts: 0,
        ppeSizeActions,
        pendingActions,
        shipCertActions: [],
        adminActions: [],
        personalUpdates,
        personalCertActions: [],
        updates: [],
        approvedCount: 0,
        personalApprovedCount: personalRows.filter((req: any) => req.status === 'approved').length,
        personalUpdateCount: personalCountRes.count || 0,
        personalCertAlertCount: 0,
        ppeSizeAlertCount: ppeSizeActions.length,
        shipCertAlertCount: 0,
      })
    }

    const countQuery = await applyPpeRequestUserFilterWithClient(
      supabaseAdmin,
      supabaseAdmin.from('ppe_requests').select('*', { count: 'exact', head: true }).in('status', ['approved', 'rejected']),
      { id: userId, full_name: fullName },
    )

    const updatesQuery = await applyPpeRequestUserFilterWithClient(
      supabaseAdmin,
      supabaseAdmin
        .from('ppe_requests')
        .select('id, created_at, status, admin_remark, rejection_reason, reason, items')
        .in('status', ['approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(6),
      { id: userId, full_name: fullName },
    )

    const [{ count }, { data: updates }, activePpeSizeWindow] = await Promise.all([
      countQuery,
      updatesQuery,
      fetchActivePpeSizeWindow(),
    ])

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
    const ppeSizeActions = buildPpeSizeActions(activePpeSizeWindow, user)

    return NextResponse.json({
      pending: count || 0,
      lowStock: 0,
      expiredCerts: 0,
      ppeSizeActions,
      personalCertActions: [],
      shipCertActions: [],
      updates: actionItems,
      approvedCount: rows.filter((req: any) => req.status === 'approved').length,
      personalCertAlertCount: 0,
      ppeSizeAlertCount: ppeSizeActions.length,
      adminActions: [],
      personalUpdates: [],
      personalApprovedCount: 0,
      shipCertAlertCount: 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load notifications' }, { status: 500 })
  }
}
