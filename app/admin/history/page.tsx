'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/history/SearchableSelect'
import {
  HISTORY_COLUMNS,
  LEGACY_HISTORY_COLUMNS,
  MINIMAL_HISTORY_COLUMNS,
  PAGE_SIZE,
  type HistoryRow,
  formatDateTime,
  formatMonthOption,
  getCrewName,
  getItemSummary,
  getStatusTimelineMeta,
  normalize,
} from '@/lib/history'
import { supabase } from '@/lib/supabase'
import { isAdminRole } from '@/lib/roles'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  History,
  Medal,
  Package,
  Search,
  User,
  Users,
  XCircle,
} from 'lucide-react'

export default function AdminHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isFetchingRows, setIsFetchingRows] = useState(false)
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [summaryRows, setSummaryRows] = useState<HistoryRow[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [summaryRowCount, setSummaryRowCount] = useState(0)
  const [adminNameMap, setAdminNameMap] = useState<Record<string, string>>({})
  const [searchCrew, setSearchCrew] = useState('')
  const [searchItem, setSearchItem] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [searchCrew, searchItem, statusFilter, monthFilter, yearFilter])

  useEffect(() => {
    const previousGutter = document.documentElement.style.scrollbarGutter
    const previousOverflowY = document.body.style.overflowY
    document.documentElement.style.scrollbarGutter = 'stable'
    document.body.style.overflowY = 'scroll'

    return () => {
      document.documentElement.style.scrollbarGutter = previousGutter
      document.body.style.overflowY = previousOverflowY
    }
  }, [])

  useEffect(() => {
    const userStr = localStorage.getItem('kmt_user')
    if (!userStr) {
      router.replace('/login')
      return
    }

    const user = JSON.parse(userStr)
    if (!isAdminRole(user.position)) {
      router.replace('/ppe')
      return
    }

    const fetchCrewLookup = async () => {
      const crewsRes = await supabase.from('crews').select('id, full_name').order('full_name')
      if (crewsRes.error) {
        console.error('Crew lookup failed:', crewsRes.error)
        return
      }

      setAdminNameMap(
        Object.fromEntries(
          (crewsRes.data || []).map((crew: { id: string; full_name: string }) => [
            String(crew.id),
            crew.full_name,
          ]),
        ),
      )
      setLoading(false)
    }

    fetchCrewLookup()
  }, [router])

  useEffect(() => {
    const userStr = localStorage.getItem('kmt_user')
    if (!userStr) return
    const user = JSON.parse(userStr)
    if (!isAdminRole(user.position)) return

    let active = true

    const buildHistoryQuery = (
      columns: string,
      legacySchema = false,
      options: { includeStatusFilter?: boolean; paginate?: boolean } = {},
    ) => {
      const { includeStatusFilter = true, paginate = true } = options
      let query = supabase
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

    const runHistoryQuery = async (options: { includeStatusFilter?: boolean; paginate?: boolean }) => {
      let result = await buildHistoryQuery(HISTORY_COLUMNS, false, options)
      if (result.error && isMissingHistoryColumn(result.error)) {
        result = await buildHistoryQuery(LEGACY_HISTORY_COLUMNS, true, options)
      }
      if (result.error && isMissingHistoryColumn(result.error)) {
        result = await buildHistoryQuery(MINIMAL_HISTORY_COLUMNS, true, options)
      }

      return result
    }

    const fetchRows = async () => {
      setIsFetchingRows(true)

      const [result, summaryResult] = await Promise.all([
        runHistoryQuery({ includeStatusFilter: true, paginate: true }),
        runHistoryQuery({ includeStatusFilter: false, paginate: false }),
      ])

      if (!active) return
      if (result.error) {
        console.error('History load failed:', result.error)
        toast.error(result.error.message || 'Unable to load issue history')
        setRows([])
        setRowCount(0)
      } else {
        setRows(((result.data || []) as unknown) as HistoryRow[])
        setRowCount(result.count || 0)
      }

      if (summaryResult.error) {
        console.error('History summary load failed:', summaryResult.error)
        setSummaryRows([])
        setSummaryRowCount(0)
      } else {
        setSummaryRows(((summaryResult.data || []) as unknown) as HistoryRow[])
        setSummaryRowCount(summaryResult.count || 0)
      }

      setIsFetchingRows(false)
      setLoading(false)
    }

    fetchRows()

    return () => {
      active = false
    }
  }, [page, searchCrew, statusFilter, monthFilter, yearFilter])

  const contextRows = useMemo(() => {
    return rows.filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null
      const itemSummary = getItemSummary(row)
      const matchesItem = !searchItem || normalize(itemSummary).includes(normalize(searchItem))
      return !!createdAt && matchesItem
    })
  }, [rows, searchItem])

  const filteredRows = useMemo(() => {
    return contextRows
  }, [contextRows])

  const summaryContextRows = useMemo(() => {
    return summaryRows.filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null
      const itemSummary = getItemSummary(row)
      const matchesItem = !searchItem || normalize(itemSummary).includes(normalize(searchItem))
      return !!createdAt && matchesItem
    })
  }, [summaryRows, searchItem])

  const monthOptions = useMemo(() => {
    return ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
  }, [])

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => String(currentYear - index))
  }, [])

  const crewOptions = useMemo(() => {
    return [
      ...new Set([
        ...Object.values(adminNameMap),
        ...rows.map((row) => getCrewName(row)).filter(Boolean),
      ]),
    ].sort((a, b) => a.localeCompare(b))
  }, [adminNameMap, rows])

  const itemOptions = useMemo(() => {
    return [...new Set(rows.flatMap((row) => (row.items || []).map((item) => item.item_name || '').filter(Boolean)))].sort(
      (a, b) => a.localeCompare(b),
    )
  }, [rows])

  const summary = useMemo(() => {
    let pendingCount = 0
    let approvedCount = 0
    let rejectedCount = 0
    let receivedCount = 0
    const crewCounts = new Map<string, number>()
    const itemCounts = new Map<string, number>()

    summaryContextRows.forEach((row) => {
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
      requestCount: searchItem ? summaryContextRows.length : summaryRowCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      receivedCount,
      topCrew: topCrewEntry ? topCrewEntry[0] : '-',
      topCrewCount: topCrewEntry ? topCrewEntry[1] : 0,
      topItem: topItemEntry ? topItemEntry[0] : '-',
      topItemCount: topItemEntry ? topItemEntry[1] : 0,
    }
  }, [searchItem, summaryContextRows, summaryRowCount])

  const exportRows = useMemo(
    () =>
      filteredRows.map((row) => ({
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
      })),
    [filteredRows, adminNameMap],
  )

  const handleExportExcel = async () => {
    if (!exportRows.length) {
      toast.error('No history rows to export')
      return
    }

    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Issue History')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `kmt-issue-history-${stamp}.xlsx`)
  }

  const cardActiveClass = (targetStatus: string) =>
    statusFilter === targetStatus
      ? 'ring-2 ring-white/30'
      : 'hover:border-white/30'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-xs font-black uppercase tracking-widest text-orange-500 animate-pulse">
        Loading history...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-24 font-sans text-white md:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black italic md:text-4xl">
            <History className="text-orange-500" size={34} />
            Issue History
          </h1>
          <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">Request and issue log</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-xs font-black uppercase text-blue-300"
        >
          <FileSpreadsheet size={16} />
          Export Excel
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`rounded-[28px] border border-amber-400/20 bg-gradient-to-br from-amber-500/14 to-zinc-950 p-5 text-left shadow-xl shadow-amber-950/20 transition-all ${cardActiveClass('all')}`}
        >
          <p className="text-[9px] uppercase tracking-widest text-amber-200">Requests</p>
          <p className="mt-3 text-3xl font-black text-white">{summary.requestCount}</p>
          <p className="mt-2 text-xs font-semibold text-amber-100/70">Total rows in the current view</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className={`rounded-[28px] border border-orange-400/20 bg-gradient-to-br from-orange-500/14 to-zinc-950 p-5 text-left shadow-xl shadow-orange-950/20 transition-all ${cardActiveClass('pending')}`}
        >
          <p className="text-[9px] uppercase tracking-widest text-orange-200">Pending</p>
          <p className="mt-3 text-3xl font-black text-white">{summary.pendingCount}</p>
          <p className="mt-2 text-xs font-semibold text-orange-100/70">Waiting for approval</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('approved')}
          className={`rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/14 to-zinc-950 p-5 text-left shadow-xl shadow-emerald-950/20 transition-all ${cardActiveClass('approved')}`}
        >
          <p className="text-[9px] uppercase tracking-widest text-emerald-200">Approved</p>
          <p className="mt-3 text-3xl font-black text-white">{summary.approvedCount}</p>
          <p className="mt-2 text-xs font-semibold text-emerald-100/70">Approved and waiting to receive</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('rejected')}
          className={`rounded-[28px] border border-rose-400/20 bg-gradient-to-br from-rose-500/14 to-zinc-950 p-5 text-left shadow-xl shadow-rose-950/20 transition-all ${cardActiveClass('rejected')}`}
        >
          <p className="text-[9px] uppercase tracking-widest text-rose-200">Rejected</p>
          <p className="mt-3 text-3xl font-black text-white">{summary.rejectedCount}</p>
          <p className="mt-2 text-xs font-semibold text-rose-100/70">Rejected requests in this view</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('received')}
          className={`rounded-[28px] border border-sky-400/20 bg-gradient-to-br from-sky-500/14 to-zinc-950 p-5 text-left shadow-xl shadow-sky-950/20 transition-all ${cardActiveClass('received')}`}
        >
          <p className="text-[9px] uppercase tracking-widest text-sky-200">Received</p>
          <p className="mt-3 text-3xl font-black text-white">{summary.receivedCount}</p>
          <p className="mt-2 text-xs font-semibold text-sky-100/70">Completed and received</p>
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/14 to-zinc-950 p-5 shadow-xl shadow-violet-950/20">
          <div className="flex items-center gap-2 text-violet-200">
            <Medal size={16} />
            <p className="text-[9px] uppercase tracking-widest">Top Item</p>
          </div>
          <p className="mt-3 text-lg font-black text-white normal-case">{summary.topItem}</p>
          <p className="mt-2 text-xs font-semibold text-violet-100/70">
            {summary.topItemCount > 0 ? `${summary.topItemCount} issues in the selected period` : 'No item data in this view'}
          </p>
        </div>

        <div className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/14 to-zinc-950 p-5 shadow-xl shadow-cyan-950/20">
          <div className="flex items-center gap-2 text-cyan-200">
            <Users size={16} />
            <p className="text-[9px] uppercase tracking-widest">Top Crew</p>
          </div>
          <p className="mt-3 text-lg font-black text-white normal-case">{summary.topCrew}</p>
          <p className="mt-2 text-xs font-semibold text-cyan-100/70">
            {summary.topCrewCount > 0 ? `${summary.topCrewCount} requests in the selected period` : 'No crew activity in this view'}
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-[32px] border border-white/6 bg-zinc-950/45 p-4 shadow-xl shadow-black/20">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
          <Search size={14} className="text-orange-400" />
          Filter History
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.8fr]">
          <SearchableSelect
            icon={<User size={16} />}
            label="Crew"
            placeholder="Search or pick crew..."
            value={searchCrew}
            onChange={setSearchCrew}
            options={crewOptions}
            toneClassName="[&_input]:border-emerald-500/25 [&_input]:focus:border-emerald-400"
          />

          <SearchableSelect
            icon={<Package size={16} />}
            label="Item"
            placeholder="Search or pick item..."
            value={searchItem}
            onChange={setSearchItem}
            options={itemOptions}
            toneClassName="[&_input]:border-sky-500/25 [&_input]:focus:border-sky-400"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-rose-500/25 bg-zinc-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-rose-400"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="received">Received</option>
          </select>

          <select
            value={monthFilter}
            onChange={(e) => {
              const nextMonth = e.target.value
              setMonthFilter(nextMonth)
              if (nextMonth !== 'all' && yearFilter === 'all') setYearFilter(String(new Date().getFullYear()))
            }}
            className="rounded-2xl border border-amber-500/25 bg-zinc-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-amber-400"
          >
            <option value="all">All Months</option>
            {monthOptions.map((option) => (
              <option key={option} value={option}>
                {formatMonthOption(option)}
              </option>
            ))}
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-2xl border border-violet-500/25 bg-zinc-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-violet-400"
          >
            <option value="all">All Years</option>
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
          {filteredRows.length} shown {searchItem ? 'after item filter' : ''} / {rowCount} matching records
        </div>
        {isFetchingRows && (
          <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
            Loading page...
          </div>
        )}
        {rows.length === 0 && (
          <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">
            No request rows returned from ppe_requests
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-[32px] border border-white/6 bg-zinc-950/45 shadow-xl lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/6 bg-white/[0.02] text-[10px] uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="px-6 py-4">Requested</th>
              <th className="px-6 py-4">Crew</th>
              <th className="px-6 py-4">Items</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => {
              const status = normalize(row.status || 'pending')
              const statusTone =
                status === 'approved'
                  ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                  : status === 'rejected'
                    ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
                    : status === 'received'
                      ? 'text-sky-300 bg-sky-500/10 border-sky-500/20'
                      : 'text-amber-300 bg-amber-500/10 border-amber-500/20'

              return (
                <tr
                  key={row.id}
                  className={`border-b border-white/5 last:border-0 ${index % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'}`}
                >
                  <td className="px-6 py-5 font-semibold text-zinc-300">{formatDateTime(row.created_at)}</td>
                  <td className="px-6 py-5 font-black text-white normal-case">{getCrewName(row)}</td>
                  <td className="px-6 py-5 font-semibold text-white normal-case">{getItemSummary(row)}</td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-semibold text-zinc-300 normal-case">
                    {getStatusTimelineMeta(row, adminNameMap)}
                    {(row.admin_remark || row.rejection_reason) && (
                      <div className="mt-1 text-[11px] text-zinc-500">{row.admin_remark || row.rejection_reason}</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 lg:hidden">
        {filteredRows.length === 0 && (
          <div className="rounded-[32px] border border-white/6 bg-zinc-950/45 py-20 text-center text-zinc-500">
            <p className="text-sm font-black uppercase tracking-widest">No history found</p>
            <p className="mt-2 text-xs font-semibold normal-case">Try clearing filters or confirm data exists in ppe_requests.</p>
          </div>
        )}

        {filteredRows.map((row) => {
          const status = normalize(row.status || 'pending')
          const statusTone =
            status === 'approved'
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
              : status === 'rejected'
                ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
                : status === 'received'
                  ? 'text-sky-300 bg-sky-500/10 border-sky-500/20'
                  : 'text-amber-300 bg-amber-500/10 border-amber-500/20'

          return (
            <div key={row.id} className="space-y-4 rounded-[32px] border border-white/6 bg-zinc-950/45 p-5 shadow-xl">
              <div className="flex flex-col justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-white normal-case">{getCrewName(row)}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
                    Requested on {formatDateTime(row.created_at)}
                  </p>
                </div>
                <div className={`inline-flex w-fit rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${statusTone}`}>
                  {status}
                </div>
              </div>

              <div className="rounded-2xl border border-sky-500/10 bg-sky-500/[0.05] p-4">
                <p className="mb-2 text-[9px] uppercase tracking-widest text-sky-200/80">Items</p>
                <p className="text-sm font-semibold text-white normal-case">{getItemSummary(row)}</p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.05] p-4">
                  <p className="mb-2 text-[9px] uppercase tracking-widest text-emerald-200/80">Status Detail</p>
                  <p className="text-sm font-semibold text-white normal-case">{getStatusTimelineMeta(row, adminNameMap)}</p>
                  {(row.admin_remark || row.rejection_reason) && (
                    <p className="mt-2 text-[11px] font-semibold text-zinc-400 normal-case">
                      {row.admin_remark || row.rejection_reason}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.05] px-4 py-3">
                    <p className="text-[9px] uppercase tracking-widest text-amber-200/80">Reason</p>
                    <p className="mt-2 text-[11px] font-semibold text-white normal-case">
                      {row.reason || 'Standard Request'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-violet-500/10 bg-violet-500/[0.05] px-4 py-3">
                    <p className="text-[9px] uppercase tracking-widest text-violet-200/80">State</p>
                    <div className="mt-2 flex items-center gap-2">
                      {status === 'approved' && <CheckCircle2 size={14} className="text-emerald-400" />}
                      {status === 'rejected' && <XCircle size={14} className="text-rose-400" />}
                      {(status === 'pending' || status === 'received') && <Clock size={14} className="text-amber-400" />}
                      <span className="text-[11px] font-bold uppercase text-white">{status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredRows.length === 0 && (
        <div className="mt-4 hidden rounded-[32px] border border-white/6 bg-zinc-950/45 py-20 text-center lg:block">
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">No history found</p>
          <p className="mt-2 text-xs font-semibold text-zinc-400 normal-case">Try clearing filters or confirm data exists in ppe_requests.</p>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[28px] border border-white/6 bg-zinc-950/45 p-4 md:flex-row">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
          Page {page + 1} of {Math.max(1, Math.ceil(rowCount / PAGE_SIZE))}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={page === 0 || isFetchingRows}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase text-white transition disabled:cursor-not-allowed disabled:opacity-30"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= rowCount || isFetchingRows}
            onClick={() => setPage((prev) => prev + 1)}
            className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-5 py-3 text-xs font-black uppercase text-orange-200 transition disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
