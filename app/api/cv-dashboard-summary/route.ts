import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Missing Supabase service role configuration' }, { status: 500 })
    }

    const [crewRes, serviceRes] = await Promise.all([
      supabaseAdmin
        .from('crews')
        .select('id, full_name, position, cv_last_updated_at')
        .order('full_name', { ascending: true }),
      supabaseAdmin
        .from('crew_cv_sea_services')
        .select('crew_id, company, vessel_type, rank, joining_date, sign_off_date')
        .order('joining_date', { ascending: false, nullsFirst: false }),
    ])

    if (crewRes.error) throw crewRes.error
    if (serviceRes.error) throw serviceRes.error

    return NextResponse.json({
      crews: crewRes.data || [],
      services: serviceRes.data || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'CV dashboard summary failed' }, { status: 500 })
  }
}
