'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Check, X, Clock, User, Package, ShieldCheck } from 'lucide-react'

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPending = async () => {
    const { data } = await supabase.from('ppe_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    if (data) setRequests(data)
    setLoading(false)
  }

  useEffect(() => { fetchPending() }, [])

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    const { error } = await supabase.from('ppe_requests').update({ 
      status: action,
      approved_by: admin.id 
    }).eq('id', id)

    if (!error) {
      toast.success(`Request ${action} successfully`)
      fetchPending()
    }
  }

  if (loading) return <div className="p-10 text-center text-blue-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto pb-32 pt-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase italic text-white flex items-center gap-3">
          <ShieldCheck className="text-blue-500" /> Pending Approvals
        </h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Review and manage crew requests</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {requests.length === 0 && (
          <div className="py-20 text-center bg-slate-900/50 rounded-[32px] border border-dashed border-white/10 text-slate-500 font-bold uppercase text-xs">No pending requests</div>
        )}
        {requests.map(req => (
          <div key={req.id} className="bg-slate-900 border border-white/5 p-6 rounded-[32px] space-y-6 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500"><User size={24}/></div>
                <div>
                  <h3 className="text-white font-black uppercase text-sm leading-tight">{req.crew_name || 'Crew Member'}</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{new Date(req.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAction(req.id, 'rejected')} className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><X size={20}/></button>
                <button onClick={() => handleAction(req.id, 'approved')} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all"><Check size={20}/></button>
              </div>
            </div>
            <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2"><Package size={12}/> Requested Items</p>
              <div className="space-y-2">
                {req.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs font-bold"><span className="text-slate-300">{item.item_name}</span><span className="text-blue-400 uppercase">{item.color} | {item.size}</span></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
