import { NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/serverAiModels'

const ASSIGNABLE_POSITIONS = ['Safety Officer', 'Chief Officer', 'Chief Engineer'] as const
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-01$/

const fail = (error: unknown, status = 500) => {
  const message = error instanceof Error ? error.message : 'Monthly Report setup request failed'
  return NextResponse.json({ error: message }, { status: message === 'Admin authentication required' ? 401 : status })
}

const normalizeMonth = (value: unknown) => {
  const raw = String(value || '')
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? `${raw}-01` : raw
  if (!MONTH_PATTERN.test(month)) throw new Error('Effective month is required')
  return month
}

const previousMonth = (month: string) => {
  const date = new Date(`${month}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return date.toISOString().slice(0, 10)
}

const normalizePositions = (value: unknown) => {
  const requested = Array.isArray(value) ? value.map((item) => String(item)) : []
  const positions = ASSIGNABLE_POSITIONS.filter((position) => requested.includes(position))
  if (positions.length === 0) throw new Error('Select at least one responsible position')
  return positions
}

const readInput = (body: Record<string, unknown>) => {
  const formNo = String(body.formNo || 'N/A').trim() || 'N/A'
  const details = String(body.details || '').replace(/\s+/g, ' ').trim()
  const period = String(body.period || '').replace(/\s+/g, ' ').trim()
  const positions = normalizePositions(body.positions)
  const effectiveFrom = normalizeMonth(body.effectiveFrom)
  const sortOrder = Math.max(0, Math.round(Number(body.sortOrder) || 0))
  if (!details) throw new Error('Document name is required')
  return { formNo, details, period, positions, effectiveFrom, sortOrder }
}

const selectColumns = 'id,definition_key,schedule,form_no,details,period,pic,sort_order,active,effective_from_month,effective_to_month,created_by,updated_by,created_at,updated_at'

export async function GET(req: Request) {
  try {
    const { supabase } = await requireAdminRequest(req)
    const { data, error } = await supabase
      .from('monthly_report_master')
      .select(selectColumns)
      .eq('schedule', 'Monthly Report')
      .eq('active', true)
      .order('sort_order')
      .order('details')
    if (error) throw error

    const rows = (data || []).filter((row) => {
      const roles = String(row.pic || '').split('/').map((role) => role.trim())
      return roles.some((role) => ASSIGNABLE_POSITIONS.includes(role as (typeof ASSIGNABLE_POSITIONS)[number]))
    })
    return NextResponse.json({ definitions: rows, positions: ASSIGNABLE_POSITIONS })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, admin } = await requireAdminRequest(req)
    const input = readInput(await req.json())
    let sortOrder = input.sortOrder
    if (!sortOrder) {
      const { data: last } = await supabase
        .from('monthly_report_master')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      sortOrder = Number(last?.sort_order || 0) + 10
    }

    const actor = admin.full_name || admin.id
    const { data, error } = await supabase
      .from('monthly_report_master')
      .insert({
        schedule: 'Monthly Report',
        form_no: input.formNo,
        details: input.details,
        period: input.period || null,
        pic: input.positions.join(' / '),
        sort_order: sortOrder,
        active: true,
        effective_from_month: input.effectiveFrom,
        effective_to_month: null,
        created_by: actor,
        updated_by: actor,
      })
      .select(selectColumns)
      .single()
    if (error) throw error
    return NextResponse.json({ definition: data })
  } catch (error) {
    return fail(error, 400)
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, admin } = await requireAdminRequest(req)
    const body = await req.json() as Record<string, unknown>
    const id = String(body.id || '')
    const input = readInput(body)
    if (!id) return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })

    const { data: source, error: sourceError } = await supabase
      .from('monthly_report_master')
      .select(selectColumns)
      .eq('id', id)
      .single()
    if (sourceError || !source) throw sourceError || new Error('Monthly Report document not found')

    const actor = admin.full_name || admin.id
    const values = {
      form_no: input.formNo,
      details: input.details,
      period: input.period || null,
      pic: input.positions.join(' / '),
      sort_order: input.sortOrder || Number(source.sort_order || 0),
      updated_by: actor,
      updated_at: new Date().toISOString(),
    }

    if (input.effectiveFrom <= String(source.effective_from_month)) {
      const { error } = await supabase
        .from('monthly_report_master')
        .update({ ...values, active: true, effective_from_month: input.effectiveFrom, effective_to_month: null })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true, versioned: false })
    }

    const originalEnd = source.effective_to_month || null
    const { error: closeError } = await supabase
      .from('monthly_report_master')
      .update({
        active: false,
        effective_to_month: previousMonth(input.effectiveFrom),
        updated_by: actor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (closeError) throw closeError

    const { error: insertError } = await supabase.from('monthly_report_master').insert({
      definition_key: source.definition_key,
      schedule: 'Monthly Report',
      ...values,
      active: true,
      effective_from_month: input.effectiveFrom,
      effective_to_month: null,
      created_by: actor,
    })
    if (insertError) {
      await supabase
        .from('monthly_report_master')
        .update({ active: true, effective_to_month: originalEnd })
        .eq('id', id)
      throw insertError
    }
    return NextResponse.json({ ok: true, versioned: true })
  } catch (error) {
    return fail(error, 400)
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, admin } = await requireAdminRequest(req)
    const url = new URL(req.url)
    const id = String(url.searchParams.get('id') || '')
    const effectiveFrom = normalizeMonth(url.searchParams.get('effectiveFrom'))
    if (!id) return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })

    const { data: source, error: sourceError } = await supabase
      .from('monthly_report_master')
      .select('id,effective_from_month')
      .eq('id', id)
      .single()
    if (sourceError || !source) throw sourceError || new Error('Monthly Report document not found')

    if (effectiveFrom <= String(source.effective_from_month)) {
      const { count, error: countError } = await supabase
        .from('monthly_report_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', id)
      if (countError) throw countError
      if (count) throw new Error('This document already has submission history. Choose a later effective month.')
      const { error } = await supabase.from('monthly_report_master').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true, deleted: true })
    }

    const { error } = await supabase
      .from('monthly_report_master')
      .update({
        active: false,
        effective_to_month: previousMonth(effectiveFrom),
        updated_by: admin.full_name || admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true, deleted: false })
  } catch (error) {
    return fail(error, 400)
  }
}
