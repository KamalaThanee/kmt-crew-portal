export type HistoryItem = {
  item_name?: string
  color?: string
  size?: string
}

export type HistoryRow = {
  id: string
  created_at: string
  approved_at?: string | null
  rejected_at?: string | null
  received_at?: string | null
  status?: string | null
  approved_by?: string | null
  approved_by_name?: string | null
  crew_id?: string | null
  crew_name?: string | null
  requester_name?: string | null
  full_name?: string | null
  admin_remark?: string | null
  rejection_reason?: string | null
  reason?: string | null
  items?: HistoryItem[] | null
}

export const PAGE_SIZE = 25

export const HISTORY_COLUMNS = [
  'id',
  'created_at',
  'approved_at',
  'rejected_at',
  'received_at',
  'status',
  'approved_by',
  'approved_by_name',
  'crew_id',
  'crew_name',
  'requester_name',
  'full_name',
  'admin_remark',
  'rejection_reason',
  'reason',
  'items',
].join(',')

export const LEGACY_HISTORY_COLUMNS = [
  'id',
  'created_at',
  'received_at',
  'status',
  'approved_by',
  'approved_by_name',
  'crew_id',
  'crew_name',
  'admin_remark',
  'rejection_reason',
  'reason',
  'items',
].join(',')

export const MINIMAL_HISTORY_COLUMNS = [
  'id',
  'created_at',
  'received_at',
  'status',
  'approved_by',
  'crew_id',
  'crew_name',
  'admin_remark',
  'rejection_reason',
  'reason',
  'items',
].join(',')

export const normalize = (value: string) => String(value || '').toLowerCase().trim()

type HistoryQueryOptions = {
  supabaseClient: any
  statusFilter: string
  monthFilter: string
  yearFilter: string
  searchCrew: string
  page: number
  includeStatusFilter?: boolean
  paginate?: boolean
}

const isMissingHistoryColumn = (error: unknown) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return (
    message.includes('column') &&
    (message.includes('approved_at') ||
      message.includes('rejected_at') ||
      message.includes('approved_by_name') ||
      message.includes('requester_name') ||
      message.includes('full_name') ||
      message.includes('schema cache'))
  )
}

const buildHistoryQuery = (
  columns: string,
  legacySchema: boolean,
  {
    supabaseClient,
    statusFilter,
    monthFilter,
    yearFilter,
    searchCrew,
    page,
    includeStatusFilter = true,
    paginate = true,
  }: HistoryQueryOptions,
) => {
  let query = supabaseClient
    .from('ppe_requests')
    .select(columns, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (includeStatusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter)
  if (yearFilter !== 'all') {
    const startMonth = monthFilter !== 'all' ? Number(monthFilter) - 1 : 0
    const endMonth = monthFilter !== 'all' ? startMonth + 1 : 12
    const start = new Date(Number(yearFilter), startMonth, 1).toISOString()
    const end = new Date(Number(yearFilter), endMonth, 1).toISOString()
    query = query.gte('created_at', start).lt('created_at', end)
  }

  const crewQuery = normalize(searchCrew)
  if (crewQuery) {
    const safeCrewQuery = crewQuery.replace(/[,%]/g, ' ')
    query = legacySchema
      ? query.ilike('crew_name', `%${safeCrewQuery}%`)
      : query.or(
          `crew_name.ilike.%${safeCrewQuery}%,requester_name.ilike.%${safeCrewQuery}%,full_name.ilike.%${safeCrewQuery}%`,
        )
  }

  if (!paginate) return query.limit(1000)

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  return query.range(from, to)
}

export const runHistoryQuery = async (options: HistoryQueryOptions) => {
  let result = await buildHistoryQuery(HISTORY_COLUMNS, false, options)
  if (result.error && isMissingHistoryColumn(result.error)) {
    result = await buildHistoryQuery(LEGACY_HISTORY_COLUMNS, true, options)
  }
  if (result.error && isMissingHistoryColumn(result.error)) {
    result = await buildHistoryQuery(MINIMAL_HISTORY_COLUMNS, true, options)
  }

  return result
}

export const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-GB')
}

export const formatMonthOption = (value: string) => {
  const monthIndex = Number(value) - 1
  if (monthIndex < 0 || monthIndex > 11) return value
  return new Date(2000, monthIndex, 1).toLocaleString('en-US', { month: 'long' })
}

export const getMonthOptions = () => ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

export const getYearOptions = () => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, index) => String(currentYear - index))
}

export const getCrewName = (row: HistoryRow) =>
  row.crew_name || row.requester_name || row.full_name || 'Unknown Crew'

export const getStatusTimelineMeta = (row: HistoryRow, adminNameMap: Record<string, string>) => {
  const status = normalize(row.status || 'pending')
  const actorName =
    row.approved_by_name ||
    (row.approved_by ? adminNameMap[String(row.approved_by)] || 'Unknown approver' : 'Unknown approver')

  const timeline: string[] = []

  if (row.approved_at || status === 'approved' || status === 'received') {
    timeline.push(`Approved by ${actorName}${row.approved_at ? ` on ${formatDateTime(row.approved_at)}` : ''}`)
  }

  if (row.rejected_at || status === 'rejected') {
    timeline.push(`Rejected by ${actorName}${row.rejected_at ? ` on ${formatDateTime(row.rejected_at)}` : ''}`)
  }

  if (status === 'received') {
    timeline.push(`Received${row.received_at ? ` on ${formatDateTime(row.received_at)}` : ''}`)
  }

  if (status === 'pending') {
    return 'Waiting for approval'
  }

  return timeline.length > 0 ? timeline.join(' | ') : '-'
}

export const getItemSummary = (row: HistoryRow) =>
  (row.items || [])
    .map((item) => [item.item_name, item.color, item.size].filter(Boolean).join(' | '))
    .join(', ')

export const filterHistoryRowsByItem = (rows: HistoryRow[], searchItem: string) =>
  rows.filter((row) => {
    const createdAt = row.created_at ? new Date(row.created_at) : null
    const itemSummary = getItemSummary(row)
    const matchesItem = !searchItem || normalize(itemSummary).includes(normalize(searchItem))
    return !!createdAt && matchesItem
  })

export const getCrewOptions = (rows: HistoryRow[], adminNameMap: Record<string, string>) =>
  [
    ...new Set([
      ...Object.values(adminNameMap),
      ...rows.map((row) => getCrewName(row)).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b))

export const getItemOptions = (rows: HistoryRow[]) =>
  [
    ...new Set(rows.flatMap((row) => (row.items || []).map((item) => item.item_name || '').filter(Boolean))),
  ].sort((a, b) => a.localeCompare(b))

export const getHistorySummary = (rows: HistoryRow[], rowCount: number, searchItem: string) => {
  let pendingCount = 0
  let approvedCount = 0
  let rejectedCount = 0
  let receivedCount = 0
  const crewCounts = new Map<string, number>()
  const itemCounts = new Map<string, number>()

  rows.forEach((row) => {
    const status = normalize(row.status || 'pending')
    if (status === 'approved') approvedCount += 1
    else if (status === 'rejected') rejectedCount += 1
    else if (status === 'received') receivedCount += 1
    else pendingCount += 1

    const crewName = getCrewName(row)
    crewCounts.set(crewName, (crewCounts.get(crewName) || 0) + 1)

    ;(row.items || []).forEach((item) => {
      const itemName = item.item_name || 'Unknown Item'
      itemCounts.set(itemName, (itemCounts.get(itemName) || 0) + 1)
    })
  })

  const topCrewEntry = [...crewCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const topItemEntry = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    requestCount: searchItem ? rows.length : rowCount,
    pendingCount,
    approvedCount,
    rejectedCount,
    receivedCount,
    topCrew: topCrewEntry ? topCrewEntry[0] : '-',
    topCrewCount: topCrewEntry ? topCrewEntry[1] : 0,
    topItem: topItemEntry ? topItemEntry[0] : '-',
    topItemCount: topItemEntry ? topItemEntry[1] : 0,
  }
}

export const getHistoryExportRows = (rows: HistoryRow[], adminNameMap: Record<string, string>) =>
  rows.map((row) => ({
    RequestedAt: formatDateTime(row.created_at),
    ApprovedAt: formatDateTime(row.approved_at),
    RejectedAt: formatDateTime(row.rejected_at),
    ReceivedAt: formatDateTime(row.received_at),
    DecisionBy:
      row.approved_by_name ||
      (row.approved_by ? adminNameMap[String(row.approved_by)] || 'Unknown approver' : ''),
    Crew: getCrewName(row),
    Items: getItemSummary(row),
    Status: row.status || 'pending',
    Detail: getStatusTimelineMeta(row, adminNameMap),
    RequestReason: row.reason || '',
    AdminRemark: row.admin_remark || row.rejection_reason || '',
  }))
