'use client'

import { getApprovalCrewName } from '@/lib/approvals'

type ApprovalActionModalsProps = {
  approvingRequest: any
  rejectingRequest: any
  rejectReason: string
  isSubmitting: boolean
  activeRequestId: string | null
  onRejectReasonChange: (value: string) => void
  onCancelApprove: () => void
  onCancelReject: () => void
  onConfirmApprove: (request: any) => void
  onConfirmReject: () => void
}

export function ApprovalActionModals({
  approvingRequest,
  rejectingRequest,
  rejectReason,
  isSubmitting,
  activeRequestId,
  onRejectReasonChange,
  onCancelApprove,
  onCancelReject,
  onConfirmApprove,
  onConfirmReject,
}: ApprovalActionModalsProps) {
  return (
    <>
      {rejectingRequest && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in">
          <div className="bg-zinc-900 border border-red-500/20 rounded-[40px] w-full max-w-md p-10 space-y-6">
            <h2 className="text-2xl font-black italic text-red-500">Reject Request</h2>
            <textarea
              rows={4}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => onRejectReasonChange(e.target.value)}
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-red-500 text-sm font-bold"
            />
            <div className="flex gap-3">
              <button onClick={onCancelReject} className="flex-1 py-4 bg-zinc-800 rounded-2xl">
                Cancel
              </button>
              <button
                onClick={onConfirmReject}
                disabled={isSubmitting}
                className="flex-1 py-4 bg-red-600 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && activeRequestId === rejectingRequest.id ? 'Processing...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {approvingRequest && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in">
          <div className="bg-zinc-900 border border-emerald-500/20 rounded-[40px] w-full max-w-md p-10 space-y-6">
            <h2 className="text-2xl font-black italic text-emerald-500">Approve Request</h2>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm normal-case text-zinc-200">
              Approve request for <span className="font-black text-white">{getApprovalCrewName(approvingRequest)}</span>?
            </div>
            <div className="flex gap-3">
              <button onClick={onCancelApprove} className="flex-1 py-4 bg-zinc-800 rounded-2xl">
                Cancel
              </button>
              <button
                onClick={() => onConfirmApprove(approvingRequest)}
                disabled={isSubmitting}
                className="flex-1 py-4 bg-emerald-600 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && activeRequestId === approvingRequest.id ? 'Processing...' : 'Confirm Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
