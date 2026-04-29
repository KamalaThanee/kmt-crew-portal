'use client'

import type { HistoryRow } from '@/lib/history'
import { formatDateTime, getCrewName, getItemSummary, getStatusTimelineMeta } from '@/lib/history'
import { StatusPill } from '@/components/history/StatusPill'

type HistoryDesktopTableProps = {
  adminNameMap: Record<string, string>
  rows: HistoryRow[]
}

export function HistoryDesktopTable({ adminNameMap, rows }: HistoryDesktopTableProps) {
  return (
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
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className={`border-b border-white/5 last:border-0 ${index % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'}`}
            >
              <td className="px-6 py-5 font-semibold text-zinc-300">{formatDateTime(row.created_at)}</td>
              <td className="px-6 py-5 font-black text-white normal-case">{getCrewName(row)}</td>
              <td className="px-6 py-5 font-semibold text-white normal-case">{getItemSummary(row)}</td>
              <td className="px-6 py-5">
                <StatusPill status={row.status} />
              </td>
              <td className="px-6 py-5 font-semibold text-zinc-300 normal-case">
                {getStatusTimelineMeta(row, adminNameMap)}
                {(row.admin_remark || row.rejection_reason) && (
                  <div className="mt-1 text-[11px] text-zinc-500">{row.admin_remark || row.rejection_reason}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
