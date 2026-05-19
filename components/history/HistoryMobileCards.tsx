'use client'

import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { HistoryRow } from '@/lib/history'
import {
  formatDateTime,
  getCrewName,
  getItemSummary,
  getStatusDisplayLabel,
  getStatusTimelineMeta,
  normalize,
} from '@/lib/history'
import { StatusPill } from '@/components/history/StatusPill'

type HistoryMobileCardsProps = {
  adminNameMap: Record<string, string>
  rows: HistoryRow[]
}

export function HistoryMobileCards({ adminNameMap, rows }: HistoryMobileCardsProps) {
  return (
    <div className="space-y-4 lg:hidden">
      {rows.length === 0 && (
        <div className="rounded-[32px] border border-white/6 bg-zinc-950/45 py-20 text-center text-zinc-500">
          <p className="text-sm font-black uppercase tracking-widest">No history found</p>
          <p className="mt-2 text-xs font-semibold normal-case">Try clearing filters or confirm data exists in ppe_requests.</p>
        </div>
      )}

      {rows.map((row) => {
        const status = normalize(row.status || 'pending')

        return (
          <div key={row.id} className="space-y-4 rounded-[32px] border border-white/6 bg-zinc-950/45 p-5 shadow-xl">
            <div className="flex flex-col justify-between gap-4">
              <div>
                <p className="text-sm font-black text-white normal-case">{getCrewName(row)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
                  Logged on {formatDateTime(row.created_at)}
                </p>
              </div>
              <StatusPill status={row.status} className="w-fit px-4 py-2" />
            </div>

            <div className="rounded-2xl border border-sky-500/10 bg-sky-500/[0.05] p-4">
              <p className="mb-2 text-[9px] uppercase tracking-widest text-sky-200/80">Items</p>
              <p className="text-sm font-semibold text-white normal-case">{getItemSummary(row)}</p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.05] p-4">
                <p className="mb-2 text-[9px] uppercase tracking-widest text-emerald-200/80">Issue Detail</p>
                <p className="text-sm font-semibold text-white normal-case">{getStatusTimelineMeta(row, adminNameMap)}</p>
                {(row.admin_remark || row.rejection_reason) && (
                  <p className="mt-2 text-[11px] font-semibold text-zinc-400 normal-case">
                    {row.admin_remark || row.rejection_reason}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.05] px-4 py-3">
                  <p className="text-[9px] uppercase tracking-widest text-amber-200/80">Issue Note</p>
                  <p className="mt-2 text-[11px] font-semibold text-white normal-case">{row.reason || 'Direct issue record'}</p>
                </div>
                <div className="rounded-2xl border border-violet-500/10 bg-violet-500/[0.05] px-4 py-3">
                  <p className="text-[9px] uppercase tracking-widest text-violet-200/80">Stage</p>
                  <div className="mt-2 flex items-center gap-2">
                    {status === 'approved' && <CheckCircle2 size={14} className="text-emerald-400" />}
                    {status === 'rejected' && <XCircle size={14} className="text-rose-400" />}
                    {(status === 'pending' || status === 'received') && <Clock size={14} className="text-amber-400" />}
                    <span className="text-[11px] font-bold uppercase text-white">{getStatusDisplayLabel(row.status)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
