'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { PackageCheck, CheckCircle2, Clock, XCircle, ChevronDown, MessageCircle, ArrowRight, Loader2 } from 'lucide-react'

export default function MyRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchRequests = async () => {
    const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    const { data } = await supabase.from('ppe_requests').select('*').eq('crew_id', user.id).order('created_at', { ascending: false })
    if (data) setRequests(data)
    setLoading(false)
  }

  useEffect(() => { fetchRequests() }, [])

  const handleReceive = async (req: any) => {
    if (!confirm("คุณได้รับอุปกรณ์ถูกต้องครบถ้วนแล้วใช่หรือไม่? ระบบจะทำการอัปเดตสต๊อกทันที")) return;
    setIsProcessing(true);
    try {
      // 🎯 1. วนลูปตัดสต๊อกทีละชิ้นตามรายการใน JSONB
      for (const item of req.items) {
        const { data: inv } = await supabase.from('ppe_inventory').select('quantity').eq('id', item.id).single();
        if (inv) {
          await supabase.from('ppe_inventory').update({ quantity: Math.max(0, inv.quantity - 1) }).eq('id', item.id);
        }
      }

      // 🎯 2. อัปเดตสถานะเป็น 'received'
      const { error } = await supabase.from('ppe_requests').update({ 
        status: 'received', 
        received_at: new Date().toISOString() 
      }).eq('id', req.id);

      if (error) throw error;
      toast.success('ยืนยันการรับสำเร็จ สต๊อกถูกตัดแล้ว');
      fetchRequests();
    } catch (e) {
      toast.error('เกิดข้อผิดพลาดในการอัปเดต');
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto pb-32 pt-24 font-sans text-white uppercase font-bold text-[10px]">
      <h1 className="text-3xl font-black italic flex items-center gap-3 mb-10"><PackageCheck className="text-orange-500" size={32}/> My PPE History</h1>

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
                <p className="text-white text-sm mt-2">Request #{req.id.slice(0,8)}</p>
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

                {/* 🎯 แสดงเหตุผลถ้าโดน Reject */}
                {req.status === 'rejected' && req.admin_remark && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400">
                    <p className="text-[7px] font-black mb-1 flex items-center gap-1"><XCircle size={10}/> ADMIN REMARK:</p>
                    <p className="italic text-xs normal-case">{req.admin_remark}</p>
                  </div>
                )}

                {/* 🎯 ปุ่ม Confirm Received สำหรับใบที่ Approved */}
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
