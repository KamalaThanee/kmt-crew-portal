'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPpeRequestIdentity } from '@/lib/ppeRequests'
import { isAdminRole } from '@/lib/roles'
import { notifyOneSignal } from '@/lib/onesignalClient'
import { toast } from 'sonner'
import { Check, X, User, Package, ShieldCheck, Loader2, MessageSquare, History, CheckCircle2, Clock } from 'lucide-react'

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

  const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))

  const isMissingColumnError = (error: unknown, column: string) => {
    const message = String((error as { message?: string })?.message || '').toLowerCase()
    return message.includes(column.toLowerCase()) && (message.includes('schema cache') || message.includes('column'))
  }

  const isApprovedByForeignKeyError = (error: unknown) => {
    const message = String((error as { message?: string })?.message || '').toLowerCase()
    return message.includes('approved_by_fkey') || (message.includes('approved_by') && message.includes('foreign key'))
  }

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
        crewName: req.crew_name || req.requester_name || req.full_name,
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
        crewName: rejectingReq.crew_name || rejectingReq.requester_name || rejectingReq.full_name,
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
          <div
            id={`approval-card-${req.id}`}
            key={req.id}
            className={`bg-zinc-900/50 border p-6 md:p-8 rounded-[40px] space-y-6 shadow-xl hover:border-orange-500/20 transition-all ${
              focusRequestId === String(req.id) ? 'border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.45)]' : 'border-white/5'
            }`}
          >
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500"><User size={24}/></div>
                <div><h3 className="text-white font-black text-sm">{req.crew_name || req.requester_name || req.full_name || 'Unknown Crew'}</h3><p className="text-zinc-500 flex items-center gap-1 mt-1"><Clock size={12}/> {new Date(req.created_at).toLocaleString()}</p></div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button disabled={isSubmitting} onClick={() => setRejectingReq(req)} className="flex-1 md:flex-none p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"><X size={20}/></button>
                <button disabled={isSubmitting} onClick={() => setApprovingReq(req)} className="flex-1 md:flex-none p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting && activeRequestId === req.id ? <Loader2 size={20} className="animate-spin"/> : <Check size={20}/>}
                </button>
              </div>
            </div>
            {req.reason && req.reason !== 'No reason provided' && <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl text-blue-400 italic font-medium">{req.reason}</div>}
            <div className="bg-black/30 rounded-2xl p-4 space-y-3">
              {req.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/5 last:border-0 pb-2">
                  <div><p className="text-white text-xs">{item.item_name}</p><p className="text-orange-500">{item.color} | {item.size}</p></div>
                  <div className="text-[8px] text-zinc-500 bg-black/40 px-2 py-1 rounded flex items-center gap-1"><History size={10}/> {contextMap[`${req.id}:${item.item_name}`] || 'Checking history...'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {rejectingReq && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in">
          <div className="bg-zinc-900 border border-red-500/20 rounded-[40px] w-full max-w-md p-10 space-y-6">
            <h2 className="text-2xl font-black italic text-red-500">Reject Request</h2>
            <textarea rows={4} placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-red-500 text-sm font-bold"/>
            <div className="flex gap-3"><button onClick={() => setRejectingReq(null)} className="flex-1 py-4 bg-zinc-800 rounded-2xl">Cancel</button><button onClick={handleRejectSubmit} disabled={isSubmitting} className="flex-1 py-4 bg-red-600 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting && activeRequestId === rejectingReq.id ? 'Processing...' : 'Confirm Reject'}</button></div>
          </div>
        </div>
      )}
      {approvingReq && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in">
          <div className="bg-zinc-900 border border-emerald-500/20 rounded-[40px] w-full max-w-md p-10 space-y-6">
            <h2 className="text-2xl font-black italic text-emerald-500">Approve Request</h2>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm normal-case text-zinc-200">
              Approve request for <span className="font-black text-white">{approvingReq.crew_name || approvingReq.requester_name || approvingReq.full_name || 'this crew member'}</span>?
            </div>
            <div className="flex gap-3">
              <button onClick={() => setApprovingReq(null)} className="flex-1 py-4 bg-zinc-800 rounded-2xl">Cancel</button>
              <button onClick={() => handleApprove(approvingReq)} disabled={isSubmitting} className="flex-1 py-4 bg-emerald-600 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting && activeRequestId === approvingReq.id ? 'Processing...' : 'Confirm Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
