'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HistoryMetricCard } from '@/components/history/HistoryMetricCard'
import { HistoryDesktopTable } from '@/components/history/HistoryDesktopTable'
import { HistoryFilterBar } from '@/components/history/HistoryFilterBar'
import { HistoryMobileCards } from '@/components/history/HistoryMobileCards'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import {
  PAGE_SIZE,
  type HistoryRow,
  filterHistoryRowsByItem,
  getCrewOptions,
  getHistoryExportRows,
  getHistorySummary,
  getItemOptions,
  getMonthOptions,
  getYearOptions,
  runHistoryQuery,
} from '@/lib/history'
import { supabase } from '@/lib/supabase'
import { isAdminRole } from '@/lib/roles'
import { toast } from 'sonner'
import {
  ClipboardCheck,
  FileSpreadsheet,
  History,
  Medal,
  Users,
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

    const fetchRows = async () => {
      setIsFetchingRows(true)
      const queryContext = {
        supabaseClient: supabase,
        statusFilter,
        monthFilter,
        yearFilter,
        searchCrew,
        page,
      }

      const [result, summaryResult] = await Promise.all([
        runHistoryQuery({ ...queryContext, includeStatusFilter: true, paginate: true }),
        runHistoryQuery({ ...queryContext, includeStatusFilter: false, paginate: false }),
      ])

      if (!active) return
      if (result.error) {
        console.error('History load failed:', result.error)
        toast.error(result.error.message || 'Unable to load request history')
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
    return filterHistoryRowsByItem(rows, searchItem)
  }, [rows, searchItem])

  const filteredRows = useMemo(() => {
    return contextRows
  }, [contextRows])

  const summaryContextRows = useMemo(() => {
    return filterHistoryRowsByItem(summaryRows, searchItem)
  }, [summaryRows, searchItem])

  const monthOptions = useMemo(() => {
    return getMonthOptions()
  }, [])

  const yearOptions = useMemo(() => {
    return getYearOptions()
  }, [])

  const crewOptions = useMemo(() => {
    return getCrewOptions(rows, adminNameMap)
  }, [adminNameMap, rows])

  const itemOptions = useMemo(() => {
    return getItemOptions(rows)
  }, [rows])

  const summary = useMemo(() => {
    return getHistorySummary(summaryContextRows, summaryRowCount, searchItem)
  }, [searchItem, summaryContextRows, summaryRowCount])

  const exportRows = useMemo(
    () => getHistoryExportRows(filteredRows, adminNameMap),
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Request History')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `kmt-request-history-${stamp}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-xs font-black uppercase tracking-widest text-orange-500 animate-pulse">
        Loading history...
      </div>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Request History"
        subtitle="Request workflow log"
        icon={<History className="text-orange-500" size={36} />}
        controls={(
          <div className="flex flex-col gap-3 md:items-end">
            <div className="grid w-full max-w-md grid-cols-2 rounded-[26px] border border-orange-500/20 bg-black/40 p-1.5 text-[10px] font-black uppercase tracking-tight text-zinc-500 shadow-2xl backdrop-blur md:w-[420px]">
              <button
                type="button"
                onClick={() => router.push('/admin/approvals')}
                className="flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 transition-all hover:bg-white/5 hover:text-white"
              >
                <ClipboardCheck size={14} /> Pending Requests
              </button>
              <button type="button" className="rounded-[20px] bg-orange-600 px-4 py-3 text-white shadow-lg shadow-orange-600/25">
                Request History
              </button>
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-3 text-xs font-black uppercase text-orange-300"
            >
              <FileSpreadsheet size={16} />
              Export Excel
            </button>
          </div>
        )}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <HistoryMetricCard
          label="Requests"
          value={summary.requestCount}
          description="Total rows in the current view"
          tone="amber"
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <HistoryMetricCard
          label="Pending"
          value={summary.pendingCount}
          description="Waiting for approval"
          tone="orange"
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter('pending')}
        />
        <HistoryMetricCard
          label="Approved"
          value={summary.approvedCount}
          description="Approved and waiting to receive"
          tone="emerald"
          active={statusFilter === 'approved'}
          onClick={() => setStatusFilter('approved')}
        />
        <HistoryMetricCard
          label="Rejected"
          value={summary.rejectedCount}
          description="Rejected requests in this view"
          tone="rose"
          active={statusFilter === 'rejected'}
          onClick={() => setStatusFilter('rejected')}
        />
        <HistoryMetricCard
          label="Received"
          value={summary.receivedCount}
          description="Completed and received"
          tone="sky"
          active={statusFilter === 'received'}
          onClick={() => setStatusFilter('received')}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HistoryMetricCard
          label="Top Item"
          value={summary.topItem}
          description={summary.topItemCount > 0 ? `${summary.topItemCount} issues in the selected period` : 'No item data in this view'}
          tone="violet"
          icon={<Medal size={16} />}
          valueClassName="text-lg"
        />

        <HistoryMetricCard
          label="Top Crew"
          value={summary.topCrew}
          description={summary.topCrewCount > 0 ? `${summary.topCrewCount} requests in the selected period` : 'No crew activity in this view'}
          tone="cyan"
          icon={<Users size={16} />}
          valueClassName="text-lg"
        />
      </div>

      <HistoryFilterBar
        crewOptions={crewOptions}
        itemOptions={itemOptions}
        monthFilter={monthFilter}
        monthOptions={monthOptions}
        searchCrew={searchCrew}
        searchItem={searchItem}
        statusFilter={statusFilter}
        yearFilter={yearFilter}
        yearOptions={yearOptions}
        onMonthFilterChange={(nextMonth) => {
          setMonthFilter(nextMonth)
          if (nextMonth !== 'all' && yearFilter === 'all') setYearFilter(String(new Date().getFullYear()))
        }}
        onSearchCrewChange={setSearchCrew}
        onSearchItemChange={setSearchItem}
        onStatusFilterChange={setStatusFilter}
        onYearFilterChange={setYearFilter}
      />

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

      <HistoryDesktopTable rows={filteredRows} adminNameMap={adminNameMap} />
      <HistoryMobileCards rows={filteredRows} adminNameMap={adminNameMap} />

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
    </PageShell>
  )
}
