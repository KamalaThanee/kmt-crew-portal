import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateCrewCertificateCompliance } from '@/lib/certCompliance'
import { getStatusDisplayLabel } from '@/lib/history'
import { applyPpeRequestUserFilterWithClient } from '@/lib/ppeRequests'
import { canViewShipCertificates } from '@/lib/roles'
import { getShipCertificateStatus, getShipSurveyStatus } from '@/lib/shipCertificates'

const crewCertColumns = 'id, crew_id, cert_name, issue_date, expiry_date, file_url, created_at, updated_at'
const ppeRequestColumns = 'id, items, status, created_at, crew_id, crew_name'
const shipCertColumns = 'id, expiry_date, next_survey_date, has_expiry, has_survey'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Missing Supabase service role configuration' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const user = {
      id: searchParams.get('userId') || '',
      full_name: searchParams.get('fullName') || '',
      position: searchParams.get('position') || '',
      suit_color: searchParams.get('suitColor') || '',
      suit_size: searchParams.get('suitSize') || '',
      boot_size: searchParams.get('bootSize') || '',
    }

    if (!user.id && !user.full_name) {
      return NextResponse.json({ error: 'Missing user identity' }, { status: 400 })
    }

    const reqQuery = await applyPpeRequestUserFilterWithClient(
      supabaseAdmin,
      supabaseAdmin
        .from('ppe_requests')
        .select(ppeRequestColumns)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false }),
      user,
    )

    const [
      matrixRes,
      myCertsRes,
      rulesRes,
      reqRes,
      globalIssueRes,
      inventoryStatsRes,
      restockRes,
      shipCertRes,
      sizeWindowRes,
      inventoryRes,
    ] = await Promise.all([
      supabaseAdmin.from('cert_matrix').select('*'),
      supabaseAdmin.from('crew_certs').select(crewCertColumns).eq('crew_id', user.id),
      supabaseAdmin.from('cert_rules').select('*'),
      reqQuery,
      supabaseAdmin.from('ppe_requests').select('id', { count: 'exact', head: true }).neq('status', 'rejected'),
      supabaseAdmin.from('ppe_inventory').select('quantity, threshold'),
      supabaseAdmin.from('restock_history').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      canViewShipCertificates(user.position)
        ? supabaseAdmin.from('ship_certificates').select(shipCertColumns)
        : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin
        .from('ppe_size_windows')
        .select('id, title, deadline_at, status, opened_at')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from('ppe_inventory').select('item_name, color, size'),
    ])

    const matrix = matrixRes.data || []
    const myCerts = myCertsRes.data || []
    const rules = rulesRes.data || []
    const myReqs = reqRes.data || []
    const shipRows = shipCertRes.data || []
    const inventoryStatsRows = inventoryStatsRes.data || []
    const lowStockCount = inventoryStatsRows.filter((item: any) => Number(item.quantity || 0) <= Number(item.threshold || 0)).length
    const lastIntakeLabel = restockRes.data?.created_at
      ? new Date(restockRes.data.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      : 'No intake yet'

    let stats = { progress: 0, ok: 0, warn: 0, exp: 0, miss: 0, total: 0, suit: 0, boot: 0, lastStatus: 'No issue yet' }

    if (matrix.length) {
      const certData = calculateCrewCertificateCompliance({ crew: user, crewCerts: myCerts, matrix, rules })

      let suitCount = 0
      let bootCount = 0
      myReqs.forEach((requestRow: any) => {
        requestRow.items?.forEach((item: any) => {
          const itemName = String(item.item_name || '').toLowerCase()
          if (itemName.includes('suit')) suitCount += 1
          if (itemName.includes('safety boot') && !itemName.includes('rubber')) bootCount += 1
        })
      })

      stats = {
        total: certData.mandatoryTotal,
        ok: certData.ok,
        warn: certData.warning,
        exp: certData.expired,
        miss: certData.missing,
        progress: certData.progress,
        suit: suitCount,
        boot: bootCount,
        lastStatus: myReqs[0]?.status ? getStatusDisplayLabel(myReqs[0].status) : 'No issue yet',
      }
    }

    const shipStats = {
      expired: shipRows.filter((cert: any) => getShipCertificateStatus(cert) === 'expired').length,
      due90: shipRows.filter((cert: any) => ['due-30', 'due-60', 'due-90'].includes(getShipCertificateStatus(cert))).length,
      surveyDue: shipRows.filter((cert: any) => ['survey-overdue', 'survey-due-30', 'survey-due-60', 'survey-due-90'].includes(getShipSurveyStatus(cert))).length,
    }

    const vesselStats = {
      totalIssues: globalIssueRes.count || 0,
      lowStock: lowStockCount,
      lastIntakeLabel,
    }

    return NextResponse.json({
      stats,
      shipStats,
      vesselStats,
      activePpeSizeWindow: sizeWindowRes.error ? null : sizeWindowRes.data || null,
      ppeInventory: inventoryRes.error ? [] : inventoryRes.data || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Dashboard summary failed' }, { status: 500 })
  }
}
