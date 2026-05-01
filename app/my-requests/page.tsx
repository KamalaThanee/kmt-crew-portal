'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import { receivePpeRequest } from '@/lib/ppeStock'
import { notifyOneSignal } from '@/lib/onesignalClient'
import { toast } from 'sonner'
import { PackageCheck, CheckCircle2, XCircle, ChevronDown, Loader2 } from 'lucide-react'

export default function MyRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [readyToReceiveCount, setReadyToReceiveCount] = useState(0)

  const fetchRequests = async () => {
    const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    const query = await applyPpeRequestUserFilter(
      supabase.from('ppe_requests').select('*').order('created_at', { ascending: false }),
      user,
    )
    const { data, error } = await query
    if (error) {
      toast.error(error.message || 'Unable to load your request history')
    }
    if (data) {
      setRequests(data)
      setReadyToReceiveCount(data.filter((req: any) => req.status === 'approved').length)
    }
    setLoading(false)
  }

  useEffect(() => { fetchRequests() }, [])
  useEffect(() => {
    const handleRefresh = () => fetchRequests()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchRequests()
    }

    const interval = window.setInterval(fetchRequests, 15000)
    window.addEventListener('new-notification', handleRefresh)
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('new-notification', handleRefresh)
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const handleReceive = async (req: any) => {
    if (!confirm('Confirm this PPE has been received? Stock will be deducted immediately.')) return
    setIsProcessing(true)
    try {
      await receivePpeRequest(req)
      const pushResult = await notifyOneSignal({
        type: 'received',
        requestId: req.id,
        crewId: req.crew_id,
        crewName: req.crew_name || req.requester_name || req.full_name,
        itemName: req.items?.[0]?.item_name || 'PPE request',
      })
      if (!pushResult?.ok || pushResult?.data?.skipped) {
        toast.warning(`Push not sent: ${pushResult?.error || pushResult?.data?.reason || 'check OneSignal logs'}`)
      }
      toast.success('Received confirmed. Stock updated.')
      fetchRequests()
    } catch (error: any) {
      toast.error(error?.message || 'Unable to confirm received')
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div><h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3"><PackageCheck className="text-orange-500" size={36}/> My PPE History</h1><p className="text-zinc-500 mt-1 tracking-widest">Request status and received items</p></div>
      </div>

      {readyToReceiveCount > 0 && (
        <div className="mb-6 rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-5 text-left">
          <p className="text-[9px] text-emerald-300 tracking-[0.24em] uppercase">Action Needed</p>
          <p className="mt-2 text-sm text-white normal-case font-black">
            {readyToReceiveCount} approved request{readyToReceiveCount > 1 ? 's are' : ' is'} waiting for you to confirm receipt.
          </p>
          <p className="mt-1 text-[11px] text-emerald-100/80 normal-case">
            Open an approved card below, then tap <span className="font-black">Confirm Received</span>.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className={`bg-zinc-900 border transition-all rounded-[32px] overflow-hidden ${expanded === req.id ? 'border-orange-500/40 shadow-xl' : 'border-white/5'}`}>
            <div className="p-6 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(expanded === req.id ? null : req.id)}>
              <div>
                <span className={`px-2 py-1 rounded text-[8px] font-black ${
                  req.status === 'received' ? 'bg-emerald-500/20 text-emerald-500' :
                  req.status === 'approved' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
                  req.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-zinc-500'
                }`}>{req.status.toUpperCase()}</span>
                <p className="text-white text-sm mt-2">Request #{String(req.id).slice(0, 8)}</p>
                <p className="text-zinc-600 text-[8px] mt-1">{new Date(req.created_at).toLocaleString()}</p>
              </div>
              <ChevronDown size={20} className={`text-zinc-700 transition-transform ${expanded === req.id ? 'rotate-180' : ''}`} />
            </div>

            {expanded === req.id && (
              <div className="px-6 pb-6 space-y-4 animate-in fade-in">
                <div className="bg-black/30 rounded-2xl p-4 space-y-2 border border-white/5">
                   {req.items?.map((item: any, i: number) => (
                     <div key={i} className="flex justify-between text-[10px]"><span className="text-zinc-400">{item.item_name}</span><span className="text-white">{item.color} {item.size}</span></div>
                   ))}
                </div>

                {req.status === 'rejected' && req.admin_remark && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400">
                    <p className="text-[7px] font-black mb-1 flex items-center gap-1"><XCircle size={10}/> ADMIN REMARK:</p>
                    <p className="italic text-xs normal-case">{req.admin_remark}</p>
                  </div>
                )}

                {req.status === 'approved' && (
                   <button onClick={() => handleReceive(req)} disabled={isProcessing} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                     {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>} Confirm Received & Cut Stock
                   </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
