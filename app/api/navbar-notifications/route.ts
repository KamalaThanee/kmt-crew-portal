import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyPpeRequestUserFilterWithClient } from '@/lib/ppeRequests'
import { isAdminRole } from '@/lib/roles'

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
      const authCrewId = request.headers.get('x-kmt-user-id') || ''
      const authPin = (request.headers.get('x-kmt-pin') || '').replace(/\D/g, '').slice(0, 6)
      if (!authCrewId || authCrewId !== userId || authPin.length !== 6) {
        return badRequest('Admin authentication required', 401)
      }
      const { data: adminCrew, error: adminCrewError } = await supabaseAdmin
        .from('crews')
        .select('id, position, is_active, resigned_at')
        .eq('id', authCrewId)
        .eq('pin', authPin)
        .maybeSingle()
      if (adminCrewError || !adminCrew || adminCrew.is_active === false || adminCrew.resigned_at || !isAdminRole(adminCrew.position)) {
        return badRequest('Admin authentication required', 401)
      }

      const [activePpeSizeWindow, crewUploadsRes, shipUploadsRes] = await Promise.all([
        fetchActivePpeSizeWindow(),
        supabaseAdmin
          .from('crew_cert_history')
          .select('id, actor_name, new_data, created_at')
          .eq('action', 'upload_certificate')
          .order('created_at', { ascending: false })
          .limit(8),
        supabaseAdmin
          .from('ship_cert_history')
          .select('id, action, actor_name, old_data, new_data, created_at')
          .in('action', ['add_certificate', 'renew_upload'])
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      const ppeSizeActions = buildPpeSizeActions(activePpeSizeWindow, user)
      const crewUploadActions = (crewUploadsRes.data || []).map((row: any) => {
        const crewName = row.new_data?.crew_name || 'Crew member'
        const certName = row.new_data?.cert_name || 'Crew certificate'
        return {
          id: `crew-cert-upload-${row.id}`,
          href: '/certificates?tab=crew',
          title: `${certName} uploaded for ${crewName}`,
          description: `Uploaded by ${row.actor_name || crewName}`,
          meta: row.created_at ? new Date(row.created_at).toLocaleString('en-GB') : '',
          countLabel: 'UPLOAD',
          tone: 'sky',
          icon: 'file',
          createdAt: row.created_at || '',
        }
      })
      const shipUploadActions = (shipUploadsRes.data || [])
        .filter((row: any) => {
          const nextFileUrl = row.new_data?.file_url
          const oldFileUrl = row.old_data?.file_url
          return Boolean(nextFileUrl) && (row.action === 'add_certificate' || nextFileUrl !== oldFileUrl)
        })
        .map((row: any) => ({
          id: `ship-cert-upload-${row.id}`,
          href: '/admin/ship-certificates',
          title: `${row.new_data?.cert_name || 'Ship certificate'} uploaded`,
          description: `Uploaded by ${row.actor_name || 'Unknown crew'}`,
          meta: row.created_at ? new Date(row.created_at).toLocaleString('en-GB') : '',
          countLabel: 'UPLOAD',
          tone: 'violet',
          icon: 'ship',
          createdAt: row.created_at || '',
        }))
      const adminActions = [...crewUploadActions, ...shipUploadActions]
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
        .slice(0, 8)

      return NextResponse.json({
        pending: 0,
        lowStock: 0,
        expiredCerts: 0,
        ppeSizeActions,
        pendingActions: [],
        shipCertActions: [],
        adminActions,
        personalUpdates: [],
        personalCertActions: [],
        updates: [],
        approvedCount: 0,
        personalApprovedCount: 0,
        personalUpdateCount: 0,
        adminUploadCount: adminActions.length,
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
