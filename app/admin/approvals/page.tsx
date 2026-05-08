'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPpeRequestIdentity } from '@/lib/ppeRequests'
import { isAdminRole } from '@/lib/roles'
import { notifyOneSignal } from '@/lib/onesignalClient'
import { getApprovalCrewName, isApprovedByForeignKeyError, isMissingColumnError, isUuid } from '@/lib/approvals'
import { ApprovalActionModals } from '@/components/approvals/ApprovalActionModals'
import { ApprovalRequestCard } from '@/components/approvals/ApprovalRequestCard'
import { toast } from 'sonner'
import { History, ShieldCheck } from 'lucide-react'
import type { PpeRequest, PpeRequestUpdateResult } from '@/lib/approvalTypes'

type StoredCrewUser = {
  id?: string
  full_name?: string
  position?: string
}

const readStoredUser = (): StoredCrewUser => {
  try {
    return JSON.parse(localStorage.getItem('kmt_user') || '{}') as StoredCrewUser
  } catch {
    return {}
  }
}

export default function ApprovalsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<PpeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingReq, setApprovingReq] = useState<PpeRequest | null>(null)
  const [rejectingReq, setRejectingReq] = useState<PpeRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [pastHistory, setPastHistory] = useState<PpeRequest[]>([])
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null)

  const fetchData = async () => {
    const { data: reqs } = await supabase.from('ppe_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    if (reqs) setRequests(reqs as PpeRequest[])
    const { data: past } = await supabase.from('ppe_requests').select('*').neq('status', 'pending').order('created_at', { ascending: false })
    if (past) setPastHistory(past as PpeRequest[])
    setLoading(false)
  }

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user')
      if (!userStr) { router.replace('/login'); return; }
      const user = JSON.parse(userStr) as StoredCrewUser
      if (!isAdminRole(user.position)) { router.replace('/ppe'); return; }
      fetchData();
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setFocusRequestId(params.get('request'))
  }, [])

  const updateRequestStatus = async (
    requestId: string,
    status: 'approved' | 'rejected',
    extra: Partial<PpeRequest> = {},
  ) => {
    const admin = readStoredUser()
    const payload = { status, ...extra } as Record<string, unknown>
    if (isUuid(admin.id)) payload.approved_by = admin.id
    if (admin.full_name) payload.approved_by_name = admin.full_name
    if (status === 'approved') payload.approved_at = new Date().toISOString()
    if (status === 'rejected') payload.rejected_at = new Date().toISOString()

    const variants: Record<string, unknown>[] = [payload]
    let shrinkingPayload = { ...payload }
    for (const column of ['approved_by', 'approved_at', 'rejected_at', 'approved_by_name']) {
      if (!(column in shrinkingPayload)) continue
      shrinkingPayload = { ...shrinkingPayload }
      delete shrinkingPayload[column]
      variants.push(shrinkingPayload)
    }

    let lastResult: PpeRequestUpdateResult = { data: null, error: null }
    const seen = new Set<string>()
    for (const variant of variants) {
      const key = JSON.stringify(Object.keys(variant).sort())
      if (seen.has(key)) continue
      seen.add(key)

      const result = await supabase
        .from('ppe_requests')
        .update(variant)
        .eq('id', requestId)
        .select('id, status')
        .maybeSingle()

      if (!result.error) return result
      lastResult = result

      if (
        !isMissingColumnError(result.error, 'approved_by') &&
        !isMissingColumnError(result.error, 'approved_by_name') &&
        !isMissingColumnError(result.error, 'approved_at') &&
        !isMissingColumnError(result.error, 'rejected_at') &&
        !isApprovedByForeignKeyError(result.error)
      ) {
        return result
      }
    }

    return lastResult
  }

  const getSmartContext = async (req: PpeRequest, itemName: string) => {
    const requestIdentity = await getPpeRequestIdentity(req)

    for (const past of pastHistory) {
      const pastIdentity = await getPpeRequestIdentity(past)
      if (pastIdentity === requestIdentity && past.status !== 'rejected') {
        const found = past.items?.find((item) => item.item_name === itemName)
        if (found) return `Last issued: ${past.created_at ? new Date(past.created_at).toLocaleDateString('en-GB') : '-'}`
      }
    }
    return "First time request"
  }

  const [contextMap, setContextMap] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true

    const buildContextMap = async () => {
      const entries = await Promise.all(
        requests.flatMap((req) =>
          (req.items || []).map(async (item) => {
            const itemName = item.item_name || 'Unknown Item'
            const key = `${req.id}:${itemName}`
            const value = await getSmartContext(req, itemName)
            return [key, value] as const
          }),
        ),
      )

      if (!active) return
      setContextMap(Object.fromEntries(entries))
    }

    if (requests.length) buildContextMap()
    else setContextMap({})

    return () => {
      active = false
    }
  }, [requests, pastHistory])

  useEffect(() => {
    if (!focusRequestId || !requests.length) return
    const target = document.getElementById(`approval-card-${focusRequestId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusRequestId, requests])

  const handleApprove = async (req: PpeRequest) => {
    setIsSubmitting(true)
    setActiveRequestId(req.id)
    setActionMessage(`Approving request ${String(req.id).slice(0, 8)}...`)
    try {
      const response = await Promise.race([
        updateRequestStatus(req.id, 'approved'),
        new Promise<PpeRequestUpdateResult>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Request timed out after 10 seconds') }), 10000),
        ),
      ])
      const { data, error } = response
      if (error) {
        setActionMessage(`Approve failed: ${error.message}`)
        toast.error(`Approve failed: ${error.message}`)
        return
      }
      if (!data) {
        const message = 'Approve failed: no rows updated'
        setActionMessage(message)
        toast.error(message)
        return
      }

      setRequests((prev) => prev.filter((item) => item.id !== req.id))
      setPastHistory((prev) => [{ ...req, ...data }, ...prev])
      const pushResult = await notifyOneSignal({
        type: 'approved',
        requestId: req.id,
        crewId: req.crew_id,
        crewName: getApprovalCrewName(req),
        itemName: req.items?.[0]?.item_name || 'PPE request',
        actorName: readStoredUser().full_name,
      })
      if (!pushResult?.ok || pushResult?.data?.skipped) {
        toast.warning(`Push not sent: ${pushResult?.error || pushResult?.data?.reason || 'check OneSignal logs'}`)
      }
      setActionMessage(`Approved request ${String(req.id).slice(0, 8)} successfully`)
      toast.success('Request Approved!')
      setApprovingReq(null)
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setActionMessage(`Approve failed: ${message}`)
      toast.error(`Approve failed: ${message}`)
    } finally {
      setIsSubmitting(false)
      setActiveRequestId(null)
    }
  }

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return toast.error('Please provide a reason');
    if (!rejectingReq) return toast.error('No request selected')
    setIsSubmitting(true)
    setActiveRequestId(rejectingReq.id)
    setActionMessage(`Rejecting request ${String(rejectingReq.id).slice(0, 8)}...`)
    try {
      const response = await Promise.race([
        updateRequestStatus(rejectingReq.id, 'rejected', { admin_remark: rejectReason.trim() }),
        new Promise<PpeRequestUpdateResult>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Request timed out after 10 seconds') }), 10000),
        ),
      ])
      const { data, error } = response
      if (error) {
        setActionMessage(`Reject failed: ${error.message}`)
        toast.error(`Reject failed: ${error.message}`)
        return
      }
      if (!data) {
        const message = 'Reject failed: no rows updated'
        setActionMessage(message)
        toast.error(message)
        return
      }

      setRequests((prev) => prev.filter((item) => item.id !== rejectingReq.id))
      setPastHistory((prev) => [{ ...rejectingReq, ...data, admin_remark: rejectReason.trim() }, ...prev])
      const pushResult = await notifyOneSignal({
        type: 'rejected',
        requestId: rejectingReq.id,
        crewId: rejectingReq.crew_id,
        crewName: getApprovalCrewName(rejectingReq),
        itemName: rejectingReq.items?.[0]?.item_name || 'PPE request',
        actorName: readStoredUser().full_name,
        reason: rejectReason.trim(),
      })
      if (!pushResult?.ok || pushResult?.data?.skipped) {
        toast.warning(`Push not sent: ${pushResult?.error || pushResult?.data?.reason || 'check OneSignal logs'}`)
      }
      setActionMessage(`Rejected request ${String(rejectingReq.id).slice(0, 8)} successfully`)
      toast.success('Request Rejected')
      setRejectingReq(null)
      setRejectReason('')
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setActionMessage(`Reject failed: ${message}`)
      toast.error(`Reject failed: ${message}`)
    } finally {
      setIsSubmitting(false)
      setActiveRequestId(null)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div><h1 className="text-3xl md:text-4xl font-black italic text-white flex items-center gap-3"><ShieldCheck className="text-orange-500" size={36}/> Approvals</h1><p className="text-zinc-500 mt-1 tracking-widest">Pending Crew Requests</p></div>
        <div className="grid w-full max-w-md grid-cols-2 rounded-[26px] border border-orange-500/20 bg-black/40 p-1.5 text-[10px] font-black uppercase tracking-tight text-zinc-500 shadow-2xl backdrop-blur md:w-[420px]">
          <button type="button" className="rounded-[20px] bg-orange-600 px-4 py-3 text-white shadow-lg shadow-orange-600/25">
            Pending Requests
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/history')}
            className="flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 transition-all hover:bg-white/5 hover:text-white"
          >
            <History size={14} /> Request History
          </button>
        </div>
      </div>
      {actionMessage && (
        <div className="mb-6 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-[10px] text-orange-300 normal-case">
          {actionMessage}
        </div>
      )}
      <div className="space-y-6">
        {requests.length === 0 && <div className="py-20 text-center bg-zinc-900/50 rounded-[40px] border border-dashed border-white/5 text-zinc-500 font-black">NO PENDING REQUESTS</div>}
        {requests.map(req => (
          <ApprovalRequestCard
            key={req.id}
            request={req}
            contextMap={contextMap}
            focusRequestId={focusRequestId}
            isSubmitting={isSubmitting}
            activeRequestId={activeRequestId}
            onApproveClick={setApprovingReq}
            onRejectClick={setRejectingReq}
          />
        ))}
      </div>
      <ApprovalActionModals
        approvingRequest={approvingReq}
        rejectingRequest={rejectingReq}
        rejectReason={rejectReason}
        isSubmitting={isSubmitting}
        activeRequestId={activeRequestId}
        onRejectReasonChange={setRejectReason}
        onCancelApprove={() => setApprovingReq(null)}
        onCancelReject={() => setRejectingReq(null)}
        onConfirmApprove={handleApprove}
        onConfirmReject={handleRejectSubmit}
      />
    </div>
  )
}
