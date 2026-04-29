'use client'

import { Check, Clock, History, Loader2, User, X } from 'lucide-react'
import { getApprovalCrewName } from '@/lib/approvals'

type ApprovalRequestCardProps = {
  request: any
  contextMap: Record<string, string>
  focusRequestId: string | null
  isSubmitting: boolean
  activeRequestId: string | null
  onApproveClick: (request: any) => void
  onRejectClick: (request: any) => void
}

export function ApprovalRequestCard({
  request,
  contextMap,
  focusRequestId,
  isSubmitting,
  activeRequestId,
  onApproveClick,
  onRejectClick,
}: ApprovalRequestCardProps) {
  return (
    <div
      id={`approval-card-${request.id}`}
      className={`bg-zinc-900/50 border p-6 md:p-8 rounded-[40px] space-y-6 shadow-xl hover:border-orange-500/20 transition-all ${
        focusRequestId === String(request.id) ? 'border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.45)]' : 'border-white/5'
      }`}
    >
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-white font-black text-sm">{getApprovalCrewName(request)}</h3>
            <p className="text-zinc-500 flex items-center gap-1 mt-1">
              <Clock size={12} /> {new Date(request.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            disabled={isSubmitting}
            onClick={() => onRejectClick(request)}
            className="flex-1 md:flex-none p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
          <button
            disabled={isSubmitting}
            onClick={() => onApproveClick(request)}
            className="flex-1 md:flex-none p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && activeRequestId === request.id ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
          </button>
        </div>
      </div>

      {request.reason && request.reason !== 'No reason provided' && (
        <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl text-blue-400 italic font-medium">{request.reason}</div>
      )}

      <div className="bg-black/30 rounded-2xl p-4 space-y-3">
        {request.items?.map((item: any, idx: number) => (
          <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/5 last:border-0 pb-2">
            <div>
              <p className="text-white text-xs">{item.item_name}</p>
              <p className="text-orange-500">{item.color} | {item.size}</p>
            </div>
            <div className="text-[8px] text-zinc-500 bg-black/40 px-2 py-1 rounded flex items-center gap-1">
              <History size={10} /> {contextMap[`${request.id}:${item.item_name}`] || 'Checking history...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
