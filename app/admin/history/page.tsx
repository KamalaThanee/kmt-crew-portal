'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Clock3, Download, Filter, History, Package, Search, ShieldCheck, User, Users } from 'lucide-react'

type HistoryItem = {
  id: string
  requestId: string
  createdAt: string
  receivedAt: string | null
  crewName: string
  status: string
  reason: string
  itemName: string
  color: string
  size: string
  approvedByName: string | null
}

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'received', 'rejected']
const SORT_OPTIONS = ['latest', 'oldest', 'most_requested']

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  approved: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  received: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
}

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const formatDateTime = (value: string | null) => {
  if (!value) return 'Not received yet'
  return new Date(value).toLocaleString('en-GB')
}

const getStatusMeta = (row: HistoryItem) => {
  if (row.status === 'approved') {
    return row.approvedByName ? `Approved by ${row.approvedByName}` : 'Approved by admin'
  }

  if (row.status === 'rejected') {
    return row.approvedByName ? `Rejected by ${row.approvedByName}` : 'Rejected by admin'
  }

  if (row.status === 'received') {
    return row.receivedAt ? `Received on ${formatDateTime(row.receivedAt)}` : 'Marked as received'
  }

  return 'Waiting for approval'
}

export default function AdminHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<HistoryItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState(getMonthKey(new Date()))
  const [approverFilter, setApproverFilter] = useState('all')
  const [sortBy, setSortBy] = useState('latest')

  useEffect(() => {
    const userStr = localStorage.getItem('kmt_user')
    if (!userStr) {
      router.replace('/login')
      return
    }

    const user = JSON.parse(userStr)
    const adminRoles = ['safety officer', 'chief officer', 'barge master']
    if (!adminRoles.includes((user.position || '').toLowerCase())) {
      router.replace('/ppe')
      return
    }

    const fetchHistory = async () => {
      setLoading(true)
      const [{ data }, { data: crews }] = await Promise.all([
        supabase
          .from('ppe_requests')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('crews').select('id, full_name'),
      ])

      const crewMap = new Map<string, string>(
        (crews || []).map((crew: any) => [String(crew.id), crew.full_name || 'Unknown Admin']),
      )

      const flattened = (data || []).flatMap((request: any) => {
        const crewName =
          request.crew_name ||
          request.requester_name ||
          request.full_name ||
          'Unknown Crew'

        const items = Array.isArray(request.items) ? request.items : []
        return items.map((item: any, index: number) => ({
          id: `${request.id}-${index}`,
          requestId: String(request.id),
          createdAt: request.created_at,
          receivedAt: request.received_at || null,
          crewName,
          status: String(request.status || 'pending').toLowerCase(),
          reason: request.reason || 'Standard Request',
          itemName: item.item_name || 'Unknown Item',
          color: item.color || '-',
          size: item.size || '-',
          approvedByName:
            request.approved_by_name ||
            (request.approved_by ? crewMap.get(String(request.approved_by)) || 'Unknown Admin' : null),
        }))
      })

      setRows(flattened)
      setLoading(false)
    }

    fetchHistory()
  }, [router])

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const created = new Date(row.createdAt)
      const rowMonth = getMonthKey(created)
      const matchesMonth = !monthFilter || rowMonth === monthFilter
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      const matchesApprover =
        approverFilter === 'all' ||
        String(row.approvedByName || '').toLowerCase() === approverFilter.toLowerCase()
      const haystack = `${row.crewName} ${row.itemName} ${row.color} ${row.size} ${row.reason} ${row.approvedByName || ''}`.toLowerCase()
      const matchesSearch = haystack.includes(searchTerm.trim().toLowerCase())
      return matchesMonth && matchesStatus && matchesApprover && matchesSearch
    })

    if (sortBy === 'oldest') {
      return [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    if (sortBy === 'most_requested') {
      const counts = new Map<string, number>()
      filtered.forEach((row) => counts.set(row.itemName, (counts.get(row.itemName) || 0) + 1))
      return [...filtered].sort((a, b) => (counts.get(b.itemName) || 0) - (counts.get(a.itemName) || 0))
    }

    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [rows, monthFilter, searchTerm, statusFilter, approverFilter, sortBy])

  const approverOptions = useMemo(() => {
    return [
      'all',
      ...Array.from(new Set(rows.map((row) => row.approvedByName).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      ),
    ]
  }, [rows])

  const handleExportCsv = () => {
    const headers = ['request_id', 'crew_name', 'item_name', 'color', 'size', 'status', 'status_meta', 'requested_at', 'received_at', 'reason']
    const lines = filteredRows.map((row) =>
      [
        row.requestId,
        row.crewName,
        row.itemName,
        row.color,
        row.size,
        row.status,
        getStatusMeta(row),
        formatDateTime(row.createdAt),
        formatDateTime(row.receivedAt),
        row.reason,
      ]
        .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
        .join(','),
    )

    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kmt-history-${monthFilter || 'all'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const summary = useMemo(() => {
    const requestIds = new Set(filteredRows.map((row) => row.requestId))
    const itemCounts = new Map<string, number>()
    const crewCounts = new Map<string, number>()
    const receivedCount = filteredRows.filter((row) => row.status === 'received').length

    filteredRows.forEach((row) => {
      itemCounts.set(row.itemName, (itemCounts.get(row.itemName) || 0) + 1)
      crewCounts.set(row.crewName, (crewCounts.get(row.crewName) || 0) + 1)
    })

    const topItemEntry = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const topCrewEntry = [...crewCounts.entries()].sort((a, b) => b[1] - a[1])[0]

    return {
      totalRequests: requestIds.size,
      totalItems: filteredRows.length,
      topItem: topItemEntry ? `${topItemEntry[0]} (${topItemEntry[1]})` : 'No data',
      topCrew: topCrewEntry ? `${topCrewEntry[0]} (${topCrewEntry[1]})` : 'No data',
      receivedCount,
    }
  }, [filteredRows])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase tracking-widest text-xs">
        Loading History...
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-24 font-sans uppercase font-bold text-[10px]">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black italic flex items-center gap-3">
            <History className="text-orange-500" size={32} />
            History
          </h1>
          <p className="app-text-muted mt-2 uppercase">Crew PPE request timeline and monthly activity</p>
        </div>
        <div className="app-surface-soft rounded-[28px] border border-orange-500/15 bg-gradient-to-r from-orange-500/10 to-transparent px-5 py-4">
          <p className="app-text-muted text-[8px] tracking-[0.25em]">ACTIVE WINDOW</p>
          <p className="mt-2 text-sm font-black normal-case">
            {monthFilter ? `${monthFilter} activity log` : 'All history'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div className="app-surface rounded-[28px] border p-5 shadow-[0_15px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-5">
            <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500"><ShieldCheck size={18} /></div>
            <p className="app-text-muted text-[8px]">Requests</p>
          </div>
          <p className="text-3xl font-black">{summary.totalRequests}</p>
          <p className="text-orange-400 mt-2 text-[9px]">Unique requests in current view</p>
        </div>
        <div className="app-surface rounded-[28px] border p-5 shadow-[0_15px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-5">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500"><Package size={18} /></div>
            <p className="app-text-muted text-[8px]">Items</p>
          </div>
          <p className="text-3xl font-black">{summary.totalItems}</p>
          <p className="text-blue-400 mt-2 text-[9px]">Total item lines in current view</p>
        </div>
        <div className="app-surface rounded-[28px] border p-5 shadow-[0_15px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500"><Users size={18} /></div>
            <p className="app-text-muted text-[8px]">Top Crew</p>
          </div>
          <p className="text-sm font-black leading-tight">{summary.topCrew}</p>
          <p className="text-emerald-400 mt-2 text-[9px]">Most active requester</p>
        </div>
        <div className="app-surface rounded-[28px] border p-5 shadow-[0_15px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-5">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-500"><Clock3 size={18} /></div>
            <p className="app-text-muted text-[8px]">Top Item</p>
          </div>
          <p className="text-sm font-black leading-tight">{summary.topItem}</p>
          <p className="text-purple-400 mt-2 text-[9px]">Most requested item</p>
        </div>
      </div>

      <div className="app-surface-strong mb-6 rounded-[30px] border px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="app-text-muted text-[8px] tracking-[0.2em]">OPERATIONS SNAPSHOT</p>
          <p className="text-sm font-black normal-case mt-2">Track approved actors, received flow, and monthly issue movement in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <p className="text-[8px] text-emerald-300 tracking-[0.15em]">RECEIVED</p>
            <p className="mt-1 text-lg font-black">{summary.receivedCount}</p>
          </div>
        </div>
      </div>

      <div className="app-surface rounded-[36px] border p-5 md:p-6 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 app-text-muted">
            <Filter size={15} />
            <span className="tracking-[0.15em]">Filters</span>
          </div>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-emerald-300 hover:bg-emerald-500/15 transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search crew, item, color, size..."
              className="w-full app-surface-soft border rounded-2xl py-4 pl-11 pr-4 outline-none focus:border-orange-500 normal-case text-sm font-bold"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full app-surface-soft border rounded-2xl py-4 px-4 outline-none focus:border-orange-500 text-sm font-bold"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'ALL STATUS' : status.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={approverFilter}
            onChange={(e) => setApproverFilter(e.target.value)}
            className="w-full app-surface-soft border rounded-2xl py-4 px-4 outline-none focus:border-orange-500 text-sm font-bold"
          >
            {approverOptions.map((approver) => (
              <option key={approver} value={approver}>
                {approver === 'all' ? 'ALL APPROVERS' : approver.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full app-surface-soft border rounded-2xl py-4 px-4 outline-none focus:border-orange-500 text-sm font-bold"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'latest' ? 'LATEST FIRST' : option === 'oldest' ? 'OLDEST FIRST' : 'MOST REQUESTED ITEMS'}
              </option>
            ))}
          </select>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full app-surface-soft border rounded-2xl py-4 px-4 outline-none focus:border-orange-500 text-sm font-bold"
          />
        </div>
      </div>

      <div className="app-surface-strong rounded-[36px] border overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr_1fr] gap-4 px-6 py-4 border-b border-white/5 app-text-muted text-[8px] tracking-[0.2em] hidden lg:grid">
          <div>Crew / Request</div>
          <div>Item</div>
          <div>Variant</div>
          <div>Status</div>
          <div>Requested</div>
          <div>Received</div>
        </div>
        <div className="divide-y divide-white/5">
          {filteredRows.length === 0 && (
            <div className="px-6 py-16 text-center app-text-muted font-black">NO HISTORY FOUND FOR THIS FILTER</div>
          )}
          {filteredRows.map((row) => (
            <div key={row.id} className="px-6 py-5 hover:bg-white/[0.02] transition-colors">
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr_1fr] gap-4 items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-xs">{row.crewName}</p>
                      <p className="app-text-muted text-[8px] normal-case">Request #{row.requestId.slice(0, 8)}</p>
                    </div>
                  </div>
                  <p className="text-[9px] app-text-muted normal-case">{row.reason}</p>
                </div>
                <div>
                  <p className="text-xs">{row.itemName}</p>
                </div>
                <div>
                  <p className="text-orange-400 text-[10px]">{row.color}</p>
                  <p className="app-text-muted text-[9px] normal-case">Size {row.size}</p>
                </div>
                <div>
                  <span className={`inline-flex px-3 py-2 rounded-xl border text-[8px] ${statusStyles[row.status] || 'bg-white/5 text-zinc-400 border-white/10'}`}>
                    {row.status.toUpperCase()}
                  </span>
                  <p className="mt-2 text-[8px] app-text-muted normal-case">{getStatusMeta(row)}</p>
                </div>
                <div className="text-[9px] normal-case">
                  <span className="lg:hidden app-text-muted block text-[8px] uppercase tracking-[0.15em] mb-1">Requested</span>
                  {formatDateTime(row.createdAt)}
                </div>
                <div className="text-[9px] normal-case">
                  <span className="lg:hidden app-text-muted block text-[8px] uppercase tracking-[0.15em] mb-1">Received</span>
                  {formatDateTime(row.receivedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
