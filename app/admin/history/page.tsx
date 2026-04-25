'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import {
  CalendarRange,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  History,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

type HistoryRow = {
  id: string
  created_at: string
  received_at?: string | null
  status?: string | null
  approved_by?: string | null
  crew_id?: string | null
  crew_name?: string | null
  requester_name?: string | null
  full_name?: string | null
  admin_remark?: string | null
  rejection_reason?: string | null
  reason?: string | null
  items?: Array<{ item_name?: string; color?: string; size?: string }>
}

const adminRoles = ['safety officer', 'chief officer', 'barge master']

const normalize = (value: string) => String(value || '').toLowerCase().trim()

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-GB')
}

const getCrewName = (row: HistoryRow) => row.crew_name || row.requester_name || row.full_name || 'Unknown Crew'

const getStatusMeta = (row: HistoryRow, adminNameMap: Record<string, string>) => {
  const status = normalize(row.status || 'pending')
  const actorName = row.approved_by ? adminNameMap[String(row.approved_by)] || 'Admin' : 'Admin'

  if (status === 'approved') return `Approved by ${actorName}`
  if (status === 'rejected') return `Rejected by ${actorName}`
  if (status === 'received') return row.received_at ? `Received on ${formatDateTime(row.received_at)}` : 'Received'
  return 'Waiting for approval'
}

const getItemSummary = (row: HistoryRow) =>
  (row.items || [])
    .map((item) => [item.item_name, item.color, item.size].filter(Boolean).join(' | '))
    .join(', ')

export default function AdminHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [adminNameMap, setAdminNameMap] = useState<Record<string, string>>({})
  const [searchCrew, setSearchCrew] = useState('')
  const [searchItem, setSearchItem] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const userStr = localStorage.getItem('kmt_user')
    if (!userStr) {
      router.replace('/login')
      return
    }

    const user = JSON.parse(userStr)
    if (!adminRoles.includes(normalize(user.position))) {
      router.replace('/ppe')
      return
    }

    const fetchData = async () => {
      setLoading(true)
      const [requestsRes, crewsRes] = await Promise.all([
        supabase
          .from('ppe_requests')
          .select('id, created_at, received_at, status, approved_by, crew_id, crew_name, requester_name, full_name, admin_remark, rejection_reason, reason, items')
          .order('created_at', { ascending: false }),
        supabase.from('crews').select('id, full_name'),
      ])

      setRows((requestsRes.data || []) as HistoryRow[])
      setAdminNameMap(
        Object.fromEntries((crewsRes.data || []).map((crew: any) => [String(crew.id), crew.full_name])),
      )
      setLoading(false)
    }

    fetchData()
  }, [router])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null
      const crewName = getCrewName(row)
      const itemSummary = getItemSummary(row)
      const matchesCrew = !searchCrew || normalize(crewName).includes(normalize(searchCrew))
      const matchesItem = !searchItem || normalize(itemSummary).includes(normalize(searchItem))
      const matchesStatus = statusFilter === 'all' || normalize(row.status || 'pending') === statusFilter
      const matchesFrom = !dateFrom || (createdAt && createdAt >= new Date(`${dateFrom}T00:00:00`))
      const matchesTo = !dateTo || (createdAt && createdAt <= new Date(`${dateTo}T23:59:59`))
      return matchesCrew && matchesItem && matchesStatus && matchesFrom && matchesTo
    })
  }, [rows, searchCrew, searchItem, statusFilter, dateFrom, dateTo])

  const exportRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        RequestedAt: formatDateTime(row.created_at),
        Crew: getCrewName(row),
        Items: getItemSummary(row),
        Status: row.status || 'pending',
        Detail: getStatusMeta(row, adminNameMap),
        RequestReason: row.reason || '',
        AdminRemark: row.admin_remark || row.rejection_reason || '',
      })),
    [filteredRows, adminNameMap],
  )

  const handleExportExcel = () => {
    if (!exportRows.length) return
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Issue History')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `kmt-issue-history-${stamp}.xlsx`)
  }

  const handleExportCsv = () => {
    if (!exportRows.length) return
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const csv = XLSX.utils.sheet_to_csv(worksheet)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `kmt-issue-history-${stamp}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase tracking-widest text-xs">
        Loading history...
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-24 font-sans text-white">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3">
            <History className="text-orange-500" size={34} />
            Issue History
          </h1>
          <p className="mt-2 text-zinc-500 uppercase text-[10px] tracking-[0.25em]">Request and issue log</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExportCsv} className="px-5 py-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-2xl font-black text-xs uppercase flex items-center gap-2">
            <Download size={16} />
            Export CSV
          </button>
          <button onClick={handleExportExcel} className="px-5 py-3 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-2xl font-black text-xs uppercase flex items-center gap-2">
            <FileSpreadsheet size={16} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-8">
        <div className="relative xl:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
          <input
            type="text"
            value={searchCrew}
            onChange={(e) => setSearchCrew(e.target.value)}
            placeholder="Search crew..."
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-orange-500"
          />
        </div>
        <div className="relative xl:col-span-1">
          <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
          <input
            type="text"
            value={searchItem}
            onChange={(e) => setSearchItem(e.target.value)}
            placeholder="Search item..."
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-orange-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="received">Received</option>
        </select>
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3">
          <CalendarRange size={16} className="text-zinc-600 shrink-0" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-sm font-bold outline-none w-full" />
          <span className="text-zinc-600 text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-sm font-bold outline-none w-full" />
        </div>
      </div>

      <div className="mb-4 text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
        {filteredRows.length} records
      </div>

      <div className="space-y-4">
        {filteredRows.length === 0 && (
          <div className="py-20 text-center bg-zinc-900/40 rounded-[32px] border border-white/5 text-zinc-500 font-black uppercase tracking-widest">
            No history found
          </div>
        )}

        {filteredRows.map((row) => {
          const status = normalize(row.status || 'pending')
          const statusTone =
            status === 'approved'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : status === 'rejected'
                ? 'text-red-400 bg-red-500/10 border-red-500/20'
                : status === 'received'
                  ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20'

          return (
            <div key={row.id} className="bg-zinc-900/50 border border-white/5 rounded-[32px] p-5 md:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div>
                  <p className="text-white font-black text-sm uppercase">{getCrewName(row)}</p>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">
                    Requested on {formatDateTime(row.created_at)}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${statusTone}`}>
                  {status}
                </div>
              </div>

              <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                <p className="text-zinc-500 text-[9px] uppercase tracking-widest mb-2">Items</p>
                <p className="text-white text-sm font-bold normal-case">{getItemSummary(row)}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <div className="bg-black/20 border border-white/5 rounded-2xl p-4">
                  <p className="text-zinc-500 text-[9px] uppercase tracking-widest mb-2">Status Detail</p>
                  <p className="text-white text-sm font-bold normal-case">{getStatusMeta(row, adminNameMap)}</p>
                  {(row.admin_remark || row.rejection_reason) && (
                    <p className="mt-2 text-[11px] text-zinc-400 font-bold normal-case">
                      {row.admin_remark || row.rejection_reason}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                  <div className="bg-black/20 border border-white/5 rounded-2xl px-4 py-3">
                    <p className="text-zinc-500 text-[9px] uppercase tracking-widest">Reason</p>
                    <p className="mt-2 text-[11px] text-white font-bold normal-case">{row.reason || 'Standard Request'}</p>
                  </div>
                  <div className="bg-black/20 border border-white/5 rounded-2xl px-4 py-3">
                    <p className="text-zinc-500 text-[9px] uppercase tracking-widest">State</p>
                    <div className="mt-2 flex items-center gap-2">
                      {status === 'approved' && <CheckCircle2 size={14} className="text-emerald-400" />}
                      {status === 'rejected' && <XCircle size={14} className="text-red-400" />}
                      {(status === 'pending' || status === 'received') && <Clock size={14} className="text-amber-400" />}
                      <span className="text-[11px] text-white font-bold uppercase">{status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
