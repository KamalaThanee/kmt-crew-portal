'use client'

import { ChevronDown, Download, ExternalLink, FileText, Trash2 } from 'lucide-react'
import type { RestockBatch, RestockLine } from '@/lib/inventoryTypes'

type RestockHistoryPanelProps = {
  restockBatches: RestockBatch[]
  restockMonthFilter: string
  restockMonthOptions: string[]
  expandedRestockBatches: string[]
  onMonthFilterChange: (value: string) => void
  onToggleBatch: (batchId: string) => void
  onOpenDoDocument: (receiptUrl: string) => void
  onExportRestockBatch: (batch: RestockBatch) => void
  onDeleteRestockBatch: (batch: RestockBatch) => void
  onDeleteRestockLine: (line: RestockLine) => void
}

export function RestockHistoryPanel({
  restockBatches,
  restockMonthFilter,
  restockMonthOptions,
  expandedRestockBatches,
  onMonthFilterChange,
  onToggleBatch,
  onOpenDoDocument,
  onExportRestockBatch,
  onDeleteRestockBatch,
  onDeleteRestockLine,
}: RestockHistoryPanelProps) {
  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-[32px] border border-emerald-500/20 bg-emerald-500/10 p-6">
        <div>
          <p className="text-emerald-300 text-[10px] tracking-[0.25em] uppercase">DO Receiving History</p>
          <p className="mt-2 text-sm normal-case text-zinc-300">{restockBatches.length} DO batches in current filter.</p>
        </div>
        <select value={restockMonthFilter} onChange={(e) => onMonthFilterChange(e.target.value)} className="bg-black/60 border border-emerald-500/20 rounded-2xl px-5 py-3 text-white font-black text-xs outline-none focus:border-emerald-500">
          <option value="all">All Months</option>
          {restockMonthOptions.map((month) => <option key={month} value={month}>{month}</option>)}
        </select>
      </div>

      {restockBatches.length === 0 ? (
        <div className="rounded-[40px] border border-white/5 bg-black/40 p-12 text-center text-zinc-600 font-black tracking-widest">
          No restock history in this period
        </div>
      ) : restockBatches.map((batch) => {
        const expanded = expandedRestockBatches.includes(batch.id)

        return (
          <div key={batch.id} className="bg-black/40 border border-white/5 rounded-[40px] overflow-hidden shadow-xl">
            <button onClick={() => onToggleBatch(batch.id)} className="w-full p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 text-left group">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-emerald-500/10 text-emerald-500 rounded-[24px] group-hover:bg-emerald-500 group-hover:text-white transition-all"><FileText size={32}/></div>
                <div>
                  <p className="text-white font-black text-xl uppercase italic">{batch.do_number}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-zinc-600 font-bold uppercase text-[10px] tracking-widest">
                    <span>{batch.created_at ? new Date(batch.created_at).toLocaleString() : '-'}</span>
                    <span>By: {batch.added_by || 'Admin'}</span>
                    <span>{batch.lines.length} lines</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end md:self-auto">
                {batch.receipt_url && (
                  <button onClick={(e) => { e.stopPropagation(); onOpenDoDocument(batch.receipt_url) }} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[10px] font-black text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2">
                    <ExternalLink size={14}/> View DO
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onExportRestockBatch(batch) }} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[10px] font-black text-blue-300 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                  <Download size={14}/> Export DO
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDeleteRestockBatch(batch) }} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[10px] font-black text-red-300 hover:bg-red-600 hover:text-white transition-all flex items-center gap-2">
                  <Trash2 size={14}/> Delete
                </button>
                <p className="text-emerald-500 font-black text-2xl">+{batch.totalQty}</p>
                <ChevronDown size={22} className={`text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {expanded && (
              <div className="border-t border-white/5 p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-3xl border border-white/5 bg-emerald-500/5 p-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">DO Number</p>
                    <p className="mt-1 text-sm font-black text-white">{batch.do_number}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Received</p>
                    <p className="mt-1 text-sm font-black text-white">{batch.created_at ? new Date(batch.created_at).toLocaleString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Received By</p>
                    <p className="mt-1 text-sm font-black text-white">{batch.added_by || 'Admin'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Total Qty</p>
                    <p className="mt-1 text-sm font-black text-emerald-400">+{batch.totalQty}</p>
                  </div>
                </div>
                <div className="hidden md:grid grid-cols-[80px_1fr_140px_140px_110px_56px] gap-4 px-5 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                  <span>No.</span>
                  <span>Item</span>
                  <span>Color</span>
                  <span>Size</span>
                  <span className="text-right">Qty</span>
                  <span></span>
                </div>
                {batch.lines.map((line, index: number) => (
                  <div key={line.id || `${batch.id}-${index}`} className="grid grid-cols-1 md:grid-cols-[80px_1fr_140px_140px_110px_56px] md:items-center gap-3 rounded-2xl bg-white/5 px-5 py-4">
                    <p className="hidden md:block text-zinc-500 font-black">#{index + 1}</p>
                    <div>
                      <p className="text-white font-black italic">{line.item_name}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 md:hidden">
                        {[line.color, line.size].filter(Boolean).join(' | ') || 'No spec'}
                      </p>
                    </div>
                    <p className="hidden md:block text-zinc-300 font-black">{line.color || '-'}</p>
                    <p className="hidden md:block text-zinc-300 font-black">{line.size || '-'}</p>
                    <p className="text-emerald-400 font-black md:text-right">+{line.quantity_added}</p>
                    <button onClick={() => onDeleteRestockLine(line)} className="w-fit rounded-xl bg-red-500/10 p-3 text-red-400 hover:bg-red-600 hover:text-white transition-all">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
