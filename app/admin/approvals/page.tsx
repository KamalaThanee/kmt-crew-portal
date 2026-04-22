'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Check, X, User, Package, ShieldCheck, Loader2, MessageSquare, History, CheckCircle2 } from 'lucide-react'

export default function ApprovalsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // 🎯 State สำหรับระบบ Reject Reason
  const [rejectingReq, setRejectingReq] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 🎯 State สำหรับเก็บประวัติการเบิกเพื่อทำ Smart Context
  const [pastHistory, setPastHistory] = useState<any[]>([])

  const fetchData = async () => {
    const { data: reqs } = await supabase.from('ppe_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    if (reqs) setRequests(reqs)

    // ดึงประวัติเก่าทั้งหมดมาทำ Context
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

  // 🎯 ฟังก์ชันค้นหาประวัติการเบิกของชิ้นเดียวกันของพนักงานคนนี้
  const getSmartContext = (crewId: string, itemName: string) => {
    for (const past of pastHistory) {
      if (past.crew_id === crewId && past.status !== 'rejected') {
        const found = past.items?.find((i: any) => i.item_name === itemName)
        if (found) {
          return `Last issued: ${new Date(past.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
        }
      }
    }
    return "First time request"
  }

  const handleApprove = async (req: any) => {
    if (!confirm(`Approve request for ${req.crew_name}?`)) return;
    setIsSubmitting(true)
    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    
    // 🎯 หมายเหตุ: เราเปลี่ยนแค่ Status เป็น 'approved' สต๊อกจะยังไม่ถูกตัดจนกว่าลูกเรือจะมารับของ!
    const { error } = await supabase.from('ppe_requests').update({ 
      status: 'approved', 
      approved_by: admin.id 
    }).eq('id', req.id)

    if (!error) { 
      toast.success('Request Approved! (Waiting for crew to receive)'); 
      fetchData(); 
    } else {
      toast.error('Approval failed');
    }
    setIsSubmitting(false)
  }

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return toast.error('Please provide a reason');
    setIsSubmitting(true)
    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    
    const { error } = await supabase.from('ppe_requests').update({ 
      status: 'rejected', 
      approved_by: admin.id,
      admin_remark: rejectReason.trim() // 🎯 บันทึกเหตุผลลงในคอลัมน์ admin_remark
    }).eq('id', rejectingReq.id)

    if (!error) { 
      toast.success('Request Rejected'); 
      setRejectingReq(null);
      setRejectReason('');
      fetchData(); 
    } else {
      toast.error('Rejection failed');
    }
    setIsSubmitting(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">Accessing Approvals...</div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-24 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3 tracking-tighter"><ShieldCheck className="text-orange-500" size={32}/> Approvals</h1>
        <p className="text-zinc-500 tracking-[0.2em] mt-2">Pending PPE Requests</p>
      </div>

      <div className="space-y-6">
        {requests.length === 0 && (
          <div className="py-20 text-center bg-zinc-900/50 rounded-[40px] border border-dashed border-white/5 space-y-4">
             <CheckCircle2 className="mx-auto text-emerald-500/50" size={48}/>
             <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">No pending requests</p>
          </div>
        )}

        {requests.map(req => (
          <div key={req.id} className="bg-zinc-900/50 border border-white/5 p-6 md:p-8 rounded-[40px] space-y-6 shadow-xl transition-all hover:border-orange-500/30">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-white/5 pb-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-orange-500/10 rounded-[20px] flex items-center justify-center text-orange-500 shrink-0"><User size={24}/></div>
                <div>
                  <h3 className="text-white font-black text-sm md:text-base leading-tight uppercase">{req.crew_name || 'Crew Member'}</h3>
                  <div className="flex items-center gap-4 mt-2">
                     <span className="text-zinc-500 flex items-center gap-1"><Clock size={12}/> {new Date(req.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                     {req.reason && req.reason !== 'No reason provided' && <span className="text-blue-400 flex items-center gap-1"><MessageSquare size={12}/> Reason attached</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button onClick={() => setRejectingReq(req)} className="flex-1 md:flex-none p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"><X size={20}/> <span className="md:hidden">Reject</span></button>
                <button onClick={() => handleApprove(req)} className="flex-1 md:flex-none p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"><Check size={20}/> <span className="md:hidden">Approve</span></button>
              </div>
            </div>

            {/* Request Reason from Crew */}
            {req.reason && req.reason !== 'No reason provided' && (
              <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl">
                 <p className="text-blue-500 text-[8px] uppercase font-black tracking-widest mb-1 flex items-center gap-2"><MessageSquare size={10}/> Crew's Note</p>
                 <p className="text-blue-100 text-xs italic capitalize normal-case">{req.reason}</p>
              </div>
            )}

            <div className="bg-black/30 rounded-3xl p-5 border border-white/5">
              <p className="text-[9px] font-black text-zinc-500 uppercase mb-4 tracking-widest flex items-center gap-2"><Package size={14}/> Requested Items ({req.items?.length})</p>
              <div className="space-y-3">
                {req.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-zinc-900/50 rounded-xl border border-white/5">
                    <div>
                       <p className="text-white text-xs font-bold">{item.item_name}</p>
                       <p className="text-orange-400 mt-1">{item.color} | {item.size}</p>
                    </div>
                    {/* 🎯 Smart Context: โชว์ประวัติการเบิกใบนี้ล่าสุด */}
                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-zinc-500 bg-black/40 px-3 py-1.5 rounded-lg w-fit">
                       <History size={12}/> {getSmartContext(req.crew_id, item.item_name)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 🛠️ MODAL: Reject Reason */}
      {rejectingReq && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in duration-200">
          <div className="bg-zinc-900 border border-red-500/30 rounded-[40px] w-full max-w-md p-8 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
            <h2 className="text-2xl font-black italic text-red-500 mb-2">Reject Request</h2>
            <p className="text-zinc-400 text-[10px] mb-6">Provide a reason for rejecting the request from {rejectingReq.crew_name}. This will be visible to the crew.</p>
            
            <div className="space-y-4 mb-8">
               <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {["Quota Exceeded", "Out of Stock", "Duplicate Request", "Not Allowed for Position"].map(preset => (
                    <button key={preset} onClick={() => setRejectReason(preset)} className="px-4 py-2 bg-black/50 border border-white/10 rounded-full text-[9px] text-zinc-300 hover:border-red-500 whitespace-nowrap transition-colors">{preset}</button>
                  ))}
               </div>
               <textarea 
                  rows={4} 
                  placeholder="Or type a custom reason..." 
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-red-500 text-sm font-bold resize-none"
               />
            </div>

            <div className="flex gap-4">
               <button onClick={() => { setRejectingReq(null); setRejectReason(''); }} className="flex-1 p-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black transition-colors">Cancel</button>
               <button onClick={handleRejectSubmit} disabled={isSubmitting || !rejectReason.trim()} className="flex-1 p-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black disabled:opacity-30 transition-colors flex items-center justify-center gap-2">
                 {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Confirm Reject'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
