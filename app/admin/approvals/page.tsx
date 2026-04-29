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
import { ShieldCheck } from 'lucide-react'

export default function ApprovalsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingReq, setApprovingReq] = useState<any>(null)
  const [rejectingReq, setRejectingReq] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [pastHistory, setPastHistory] = useState<any[]>([])
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null)

  const fetchData = async () => {
    const { data: reqs } = await supabase.from('ppe_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    if (reqs) setRequests(reqs)
    const { data: past } = await supabase.from('ppe_requests').select('*').neq('status', 'pending').order('created_at', { ascending: false })
    if (past) setPastHistory(past)
    setLoading(false)
  }

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user')
      if (!userStr) { router.replace('/login'); return; }
      const user = JSON.parse(userStr)
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
    extra: Record<string, any> = {},
  ) => {
    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    const payload = { status, ...extra } as Record<string, any>
    if (isUuid(admin.id)) payload.approved_by = admin.id
    if (admin.full_name) payload.approved_by_name = admin.full_name
    if (status === 'approved') payload.approved_at = new Date().toISOString()
    if (status === 'rejected') payload.rejected_at = new Date().toISOString()

    const variants: Record<string, any>[] = [payload]
    let shrinkingPayload = { ...payload }
    for (const column of ['approved_by', 'approved_at', 'rejected_at', 'approved_by_name']) {
      if (!(column in shrinkingPayload)) continue
      shrinkingPayload = { ...shrinkingPayload }
      delete shrinkingPayload[column]
      variants.push(shrinkingPayload)
    }

    let lastResult: any = null
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

  const getSmartContext = async (req: any, itemName: string) => {
    const requestIdentity = await getPpeRequestIdentity(req)

    for (const past of pastHistory) {
      const pastIdentity = await getPpeRequestIdentity(past)
      if (pastIdentity === requestIdentity && past.status !== 'rejected') {
        const found = past.items?.find((i: any) => i.item_name === itemName)
        if (found) return `Last issued: ${new Date(past.created_at).toLocaleDateString('en-GB')}`
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
          (req.items || []).map(async (item: any) => {
            const key = `${req.id}:${item.item_name}`
            const value = await getSmartContext(req, item.item_name)
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

  const handleApprove = async (req: any) => {
    setIsSubmitting(true)
    setActiveRequestId(req.id)
    setActionMessage(`Approving request ${String(req.id).slice(0, 8)}...`)
    try {
      const response = await Promise.race([
        updateRequestStatus(req.id, 'approved'),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Request timed out after 10 seconds') }), 10000),
        ),
      ])
      const { data, error } = response
      if (error) {
        setActionMessage(`Approve failed: ${error.message}`)
        toast.error(`Approve failed: ${error.message}`)
        alert(`Approve failed: ${error.message}`)
        return
      }
      if (!data) {
        const message = 'Approve failed: no rows updated'
        setActionMessage(message)
        toast.error(message)
        alert(message)
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
        actorName: JSON.parse(localStorage.getItem('kmt_user') || '{}')?.full_name,
      })
      if (!pushResult?.ok || pushResult?.data?.skipped) {
        toast.warning(`Push not sent: ${pushResult?.error || pushResult?.data?.reason || 'check OneSignal logs'}`)
      }
      setActionMessage(`Approved request ${String(req.id).slice(0, 8)} successfully`)
      toast.success('Request Approved!')
      setApprovingReq(null)
      fetchData()
    } catch (error: any) {
      setActionMessage(`Approve failed: ${error?.message || 'Unknown error'}`)
      toast.error(`Approve failed: ${error?.message || 'Unknown error'}`)
      alert(`Approve failed: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
      setActiveRequestId(null)
    }
  }

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return toast.error('Please provide a reason');
    setIsSubmitting(true)
    setActiveRequestId(rejectingReq.id)
    setActionMessage(`Rejecting request ${String(rejectingReq.id).slice(0, 8)}...`)
    try {
      const response = await Promise.race([
        updateRequestStatus(rejectingReq.id, 'rejected', { admin_remark: rejectReason.trim() }),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Request timed out after 10 seconds') }), 10000),
        ),
      ])
      const { data, error } = response
      if (error) {
        setActionMessage(`Reject failed: ${error.message}`)
        toast.error(`Reject failed: ${error.message}`)
        alert(`Reject failed: ${error.message}`)
        return
      }
      if (!data) {
        const message = 'Reject failed: no rows updated'
        setActionMessage(message)
        toast.error(message)
        alert(message)
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
        actorName: JSON.parse(localStorage.getItem('kmt_user') || '{}')?.full_name,
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
    } catch (error: any) {
      setActionMessage(`Reject failed: ${error?.message || 'Unknown error'}`)
      toast.error(`Reject failed: ${error?.message || 'Unknown error'}`)
      alert(`Reject failed: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
      setActiveRequestId(null)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-24 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center">
        <div><h1 className="text-3xl font-black italic text-white flex items-center gap-3"><ShieldCheck className="text-orange-500" size={32}/> Approvals</h1><p className="text-zinc-500 mt-1 uppercase">Pending Crew Requests</p></div>
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
