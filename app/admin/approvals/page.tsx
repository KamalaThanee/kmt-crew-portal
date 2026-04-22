'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Check, X, User, Package, ShieldCheck, Loader2, MessageSquare, History, CheckCircle2, Clock } from 'lucide-react'

export default function ApprovalsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectingReq, setRejectingReq] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pastHistory, setPastHistory] = useState<any[]>([])

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
      const adminRoles = ["safety officer", "chief officer", "barge master"]
      if (!adminRoles.includes((user.position || "").toLowerCase())) { router.replace('/ppe'); return; }
      fetchData();
    }
    checkAuth()
  }, [router])

  const getSmartContext = (crewId: string, itemName: string) => {
    for (const past of pastHistory) {
      if (past.crew_id === crewId && past.status !== 'rejected') {
        const found = past.items?.find((i: any) => i.item_name === itemName)
        if (found) return `Last issued: ${new Date(past.created_at).toLocaleDateString('en-GB')}`
      }
    }
    return "First time request"
  }

  const handleApprove = async (req: any) => {
    if (!confirm(`Approve request for ${req.crew_name}?`)) return;
    setIsSubmitting(true)
    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    const { error } = await supabase.from('ppe_requests').update({ status: 'approved', approved_by: admin.id }).eq('id', req.id)
    if (!error) { toast.success('Request Approved!'); fetchData(); }
    setIsSubmitting(false)
  }

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return toast.error('Please provide a reason');
    setIsSubmitting(true)
    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    const { error } = await supabase.from('ppe_requests').update({ status: 'rejected', approved_by: admin.id, admin_remark: rejectReason.trim() }).eq('id', rejectingReq.id)
    if (!error) { toast.success('Request Rejected'); setRejectingReq(null); setRejectReason(''); fetchData(); }
    setIsSubmitting(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-24 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center">
        <div><h1 className="text-3xl font-black italic text-white flex items-center gap-3"><ShieldCheck className="text-orange-500" size={32}/> Approvals</h1><p className="text-zinc-500 mt-1 uppercase">Pending Crew Requests</p></div>
      </div>
      <div className="space-y-6">
        {requests.length === 0 && <div className="py-20 text-center bg-zinc-900/50 rounded-[40px] border border-dashed border-white/5 text-zinc-500 font-black">NO PENDING REQUESTS</div>}
        {requests.map(req => (
          <div key={req.id} className="bg-zinc-900/50 border border-white/5 p-6 md:p-8 rounded-[40px] space-y-6 shadow-xl hover:border-orange-500/20 transition-all">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500"><User size={24}/></div>
                <div><h3 className="text-white font-black text-sm">{req.crew_name}</h3><p className="text-zinc-500 flex items-center gap-1 mt-1"><Clock size={12}/> {new Date(req.created_at).toLocaleString()}</p></div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setRejectingReq(req)} className="flex-1 md:flex-none p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><X size={20}/></button>
                <button onClick={() => handleApprove(req)} className="flex-1 md:flex-none p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"><Check size={20}/></button>
              </div>
            </div>
            {req.reason && req.reason !== 'No reason provided' && <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl text-blue-400 italic font-medium">{req.reason}</div>}
            <div className="bg-black/30 rounded-2xl p-4 space-y-3">
              {req.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/5 last:border-0 pb-2">
                  <div><p className="text-white text-xs">{item.item_name}</p><p className="text-orange-500">{item.color} | {item.size}</p></div>
                  <div className="text-[8px] text-zinc-500 bg-black/40 px-2 py-1 rounded flex items-center gap-1"><History size={10}/> {getSmartContext(req.crew_id, item.item_name)}</div>
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
            <div className="flex gap-3"><button onClick={() => setRejectingReq(null)} className="flex-1 py-4 bg-zinc-800 rounded-2xl">Cancel</button><button onClick={handleRejectSubmit} className="flex-1 py-4 bg-red-600 rounded-2xl">Confirm Reject</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
