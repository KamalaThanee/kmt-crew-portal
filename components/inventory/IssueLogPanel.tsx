import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { exportJsonRowsToExcel } from '@/lib/excelExport'
import type { StockTransaction } from '@/lib/inventoryTypes'

type IssueLogPanelProps = {
  stockTransactions: StockTransaction[]
  stockTransactionError: string
  isRefreshingTransactions: boolean
  onRefreshTransactions: () => void
}

export function IssueLogPanel({
  stockTransactions,
  stockTransactionError,
  isRefreshingTransactions,
  onRefreshTransactions,
}: IssueLogPanelProps) {
  const [itemSearch, setItemSearch] = useState('')
  const [crewSearch, setCrewSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')

  const actionOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(stockTransactions.map((movement) => movement.movement_type).filter(Boolean) as string[])).sort()]
  }, [stockTransactions])

  const monthOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(stockTransactions.map((movement) => {
      if (!movement.created_at) return ''
      const date = new Date(movement.created_at)
      if (Number.isNaN(date.getTime())) return ''
      return String(date.getMonth() + 1).padStart(2, '0')
    }).filter(Boolean))).sort()]
  }, [stockTransactions])

  const yearOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(stockTransactions.map((movement) => {
      if (!movement.created_at) return ''
      const date = new Date(movement.created_at)
      if (Number.isNaN(date.getTime())) return ''
      return String(date.getFullYear())
    }).filter(Boolean))).sort((a, b) => b.localeCompare(a))]
  }, [stockTransactions])

  const filteredTransactions = useMemo(() => {
    const itemQuery = itemSearch.trim().toLowerCase()
    const crewQuery = crewSearch.trim().toLowerCase()

    return stockTransactions.filter((movement) => {
      const date = movement.created_at ? new Date(movement.created_at) : null
      const month = date && !Number.isNaN(date.getTime()) ? String(date.getMonth() + 1).padStart(2, '0') : ''
      const year = date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : ''
      const itemText = [movement.item_name, movement.color, movement.size].filter(Boolean).join(' ').toLowerCase()
      const crewText = [movement.crew_name, movement.actor_name].filter(Boolean).join(' ').toLowerCase()

      return (
        (!itemQuery || itemText.includes(itemQuery)) &&
        (!crewQuery || crewText.includes(crewQuery)) &&
        (actionFilter === 'all' || movement.movement_type === actionFilter) &&
        (monthFilter === 'all' || month === monthFilter) &&
        (yearFilter === 'all' || year === yearFilter)
      )
    })
  }, [actionFilter, crewSearch, itemSearch, monthFilter, stockTransactions, yearFilter])

  const summary = useMemo(() => {
    const totalOut = filteredTransactions.reduce((sum, movement) => {
      const qty = Number(movement.quantity_delta || 0)
      return sum + (qty < 0 ? Math.abs(qty) : 0)
    }, 0)
    const itemCounts = new Map<string, number>()
    const crewCounts = new Map<string, number>()

    filteredTransactions.forEach((movement) => {
      const qty = Math.abs(Number(movement.quantity_delta || 0)) || 0
      if (movement.item_name) itemCounts.set(movement.item_name, (itemCounts.get(movement.item_name) || 0) + qty)
      if (movement.crew_name) crewCounts.set(movement.crew_name, (crewCounts.get(movement.crew_name) || 0) + qty)
    })

    const topItem = Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1])[0]
    const topCrew = Array.from(crewCounts.entries()).sort((a, b) => b[1] - a[1])[0]

    return {
      movementCount: filteredTransactions.length,
      totalOut,
      topItem: topItem ? `${topItem[0]} (${topItem[1]})` : '-',
      topCrew: topCrew ? `${topCrew[0]} (${topCrew[1]})` : '-',
    }
  }, [filteredTransactions])

  const handleExport = async () => {
    if (filteredTransactions.length === 0) {
      toast.error('No stock movements to export')
      return
    }

    const rows = filteredTransactions.map((movement) => ({
      Date: movement.created_at ? new Date(movement.created_at).toLocaleString() : '',
      Action: String(movement.movement_type || 'issue').replace(/_/g, ' '),
      Item: movement.item_name || '',
      Color: movement.color || '',
      Size: movement.size || '',
      Crew: movement.crew_name || '',
      By: movement.actor_name || '',
      Quantity: movement.quantity_delta || '',
      Note: movement.note || '',
    }))
    const stamp = new Date().toISOString().slice(0, 10)
    await exportJsonRowsToExcel({ fileName: `kmt-stock-movement-${stamp}.xlsx`, rows, sheetName: 'Stock Movement' })
    toast.success(`Exported ${rows.length} stock movements`)
  }

  const clearFilters = () => {
    setItemSearch('')
    setCrewSearch('')
    setActionFilter('all')
    setMonthFilter('all')
    setYearFilter('all')
  }

  return (
    <div className="space-y-4 pb-20 max-w-5xl mx-auto animate-in fade-in">
      <div className="rounded-[32px] border border-blue-500/20 bg-blue-500/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-blue-300 text-[10px] tracking-[0.25em] uppercase">Stock Movement Audit</p>
            <p className="mt-2 text-sm normal-case text-zinc-300">Latest {stockTransactions.length} stock movements from received requests and direct issue.</p>
            <p className="mt-1 text-[11px] normal-case text-zinc-500">Only completed stock deductions are shown here. Legacy pending approvals stay out of this log until stock is actually deducted. If this is empty after deploy, rerun sql/ppe_stock_transactions.sql once to backfill old received issues.</p>
          </div>
          <button onClick={onRefreshTransactions} disabled={isRefreshingTransactions} className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-5 py-3 text-[10px] font-black text-blue-200 transition-all hover:bg-blue-500 hover:text-white disabled:cursor-wait disabled:opacity-60">
            {isRefreshingTransactions ? 'Refreshing...' : 'Refresh Log'}
          </button>
        </div>
        {stockTransactionError && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[11px] normal-case text-red-200">
            {stockTransactionError}. Run <span className="font-black text-white">sql/ppe_stock_transactions.sql</span> in Supabase, then press Refresh Log again.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
          <p className="text-[9px] tracking-[0.25em] text-zinc-500">MOVEMENTS</p>
          <p className="mt-2 text-2xl font-black text-white">{summary.movementCount}</p>
        </div>
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-[9px] tracking-[0.25em] text-red-200">TOTAL OUT</p>
          <p className="mt-2 text-2xl font-black text-white">{summary.totalOut}</p>
        </div>
        <div className="rounded-[24px] border border-blue-400/20 bg-blue-500/10 p-4">
          <p className="text-[9px] tracking-[0.25em] text-blue-200">TOP ITEM</p>
          <p className="mt-2 text-sm font-black text-white normal-case">{summary.topItem}</p>
        </div>
        <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-[9px] tracking-[0.25em] text-emerald-200">TOP CREW</p>
          <p className="mt-2 text-sm font-black text-white normal-case">{summary.topCrew}</p>
        </div>
      </div>

      <div className="rounded-[30px] border border-white/10 bg-black/35 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_150px_130px_130px_auto_auto]">
          <label className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-black/40 px-4">
            <Search size={15} className="text-blue-300" />
            <input
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              placeholder="Search item..."
              className="h-12 w-full bg-transparent text-xs font-black uppercase text-white outline-none placeholder:text-zinc-600"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-black/40 px-4">
            <Search size={15} className="text-blue-300" />
            <input
              value={crewSearch}
              onChange={(event) => setCrewSearch(event.target.value)}
              placeholder="Search crew / by..."
              className="h-12 w-full bg-transparent text-xs font-black uppercase text-white outline-none placeholder:text-zinc-600"
            />
          </label>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="h-12 rounded-2xl border border-blue-500/20 bg-black/60 px-3 text-[10px] font-black uppercase text-white outline-none">
            {actionOptions.map((action) => (
              <option key={action} value={action}>{action === 'all' ? 'All Actions' : action.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="h-12 rounded-2xl border border-blue-500/20 bg-black/60 px-3 text-[10px] font-black uppercase text-white outline-none">
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month === 'all' ? 'All Months' : month}</option>
            ))}
          </select>
          <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="h-12 rounded-2xl border border-blue-500/20 bg-black/60 px-3 text-[10px] font-black uppercase text-white outline-none">
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year === 'all' ? 'All Years' : year}</option>
            ))}
          </select>
          <button onClick={clearFilters} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:border-blue-400/40 hover:text-white">
            Clear
          </button>
          <button onClick={handleExport} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-200 hover:bg-blue-500 hover:text-white">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
        {filteredTransactions.length} shown / {stockTransactions.length} stock movements
      </p>

      {filteredTransactions.length === 0 ? (
        <div className="rounded-[40px] border border-white/5 bg-black/40 p-12 text-center text-zinc-600 font-black tracking-widest">
          No stock movements yet
        </div>
      ) : filteredTransactions.map((movement) => (
        <div key={movement.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 rounded-[32px] border border-white/5 bg-black/40 p-6 shadow-xl">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-[8px] font-black tracking-widest ${movement.movement_type === 'direct_issue' ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300'}`}>
                {String(movement.movement_type || 'issue').replace(/_/g, ' ')}
              </span>
              <span className="text-zinc-600 text-[10px]">
                {movement.created_at ? new Date(movement.created_at).toLocaleString() : '-'}
              </span>
            </div>
            <p className="text-white text-base font-black italic uppercase">
              {movement.item_name || 'Unknown Item'}
              <span className="ml-2 text-blue-300 text-xs not-italic">{[movement.color, movement.size].filter(Boolean).join(' | ')}</span>
            </p>
            <p className="text-zinc-400 normal-case text-xs">
              Crew: <span className="text-white font-black">{movement.crew_name || '-'}</span>
              <span className="mx-2 text-zinc-700">|</span>
              By: <span className="text-white font-black">{movement.actor_name || '-'}</span>
            </p>
            {movement.note && <p className="text-[11px] normal-case text-zinc-600">{movement.note}</p>}
          </div>
          <div className="flex items-center justify-end">
            <span className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-xl font-black text-red-400">
              {movement.quantity_delta}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
