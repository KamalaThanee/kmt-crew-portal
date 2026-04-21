'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileBadge, Users, User, AlertTriangle, ChevronRight, CheckCircle2, ShieldCheck, Activity, Clock, Box, Archive, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [personal, setPersonal] = useState<any>({ progress: 0, okCount: 0, reqCount: 0, expired: 0, warning: 0, missing: 0, suit: 0, boot: 0, lastStatus: 'None' })
  const [vessel, setVessel] = useState<any>({ pending: 0, lowStock: 0, vesselExpired: 0, compliance: 0, totalItems: 0, vesselWarning: 0 })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) { const u = JSON.parse(uStr); setUser(u); fetchAdminStats(u); }
  }, [])

  async function fetchAdminStats(u: any) {
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: crews } = await supabase.from('crews').select('*')
    const { data: allCerts } = await supabase.from('crew_certs').select('*')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    const { count: pending } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected').order('created_at', { ascending: false })

    // --- My Personal ---
    let okCount = 0; let expired = 0; let warning = 0; let suit = 0; let boot = 0;
    const userPosNorm = normalize(u.position);
    const myReqRows = matrix?.filter(m => normalize(m.position) === userPosNorm && m.requirement_type === 'P') || []
    const myCerts = allCerts?.filter(cc => cc.crew_id === u.id) || []
    const today = new Date()

    myReqRows.forEach(req => {
      const uploaded = myCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name))
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') okCount++;
        else {
          const expDate = new Date(uploaded.expiry_date)
          const diff = (expDate.getTime() - today.getTime()) / 86400000
          if (diff < 0) expired++; else if (diff <= 90) { warning++; okCount++; } else okCount++;
        }
      }
    })

    myReqs?.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    setPersonal({ progress: myReqRows.length > 0 ? Math.round((okCount/myReqRows.length)*100) : 0, okCount, reqCount: myReqRows.length, expired, warning, missing: myReqRows.length - okCount, suit, boot, lastStatus: myReqs?.[0]?.status || 'None' })

    // --- Fleet Oversight ---
    let totalFleetReq = 0; let totalFleetOk = 0; let vExpired = 0; let vWarning = 0;
    crews?.forEach(c => {
      const cReq = matrix?.filter(m => normalize(m.position) === normalize(c.position) && m.requirement_type === 'P') || []
      const cCerts = allCerts?.filter(cc => cc.crew_id === c.id) || []
      totalFleetReq += cReq.length
      cReq.forEach(req => {
        const uC = cCerts.find(cc => normalize(cc.cert_name) === normalize(req.cert_name))
        if (uC) {
          if (uC.expiry_date === '2099-12-31') totalFleetOk++;
          else {
            const expD = new Date(uC.expiry_date); const dDiff = (expD.getTime() - today.getTime())/86400000;
            if (dDiff < 0) vExpired++; else if (dDiff <= 90) { vWarning++; totalFleetOk++; } else totalFleetOk++;
          }
        }
      })
    })

    setVessel({ 
      pending: pending || 0, 
      lowStock: inventory?.filter(i => (i.quantity||0) <= (i.threshold||0)).length || 0, 
      totalItems: inventory?.reduce((a, b) => a + (b.quantity || 0), 0) || 0, 
      compliance: totalFleetReq > 0 ? Math.round((totalFleetOk/totalFleetReq)*100) : 0, 
      vesselExpired: vExpired, 
      vesselWarning: vWarning 
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">Admin Hub Loading...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center">
        <div><h1 className="text-3xl font-black italic leading-none">Command Center</h1><p className="text-slate-500 tracking-[0.2em] mt-2 font-black uppercase text-[10px]">Vessel Operation Hub</p></div>
        <button onClick={() => {setLoading(true); fetchAdminStats(user);}} className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
           <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-2"><User size={16}/> My Personal Status</h2>
           
           <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all group">
              <div className="flex justify-between items-center mb-6">
                 <div className="relative w-20 h-20 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90"><circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-white/5"/><circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray="226" strokeDashoffset={226 - (personal.progress/100)*226} className="text-blue-500 transition-all duration-1000"/></svg>
                   <span className="absolute text-base font-black">{personal.progress}%</span>
                 </div>
                 <div className="text-right"><p className="text-blue-400 text-lg">{personal.okCount} / {personal.reqCount}</p><p className="text-[8px] text-slate-500">Certs Valid</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                 <div className="bg-emerald-500/10 p-2 rounded-xl text-center"><p className="text-emerald-500 text-sm">{personal.okCount}</p><p className="text-[7px] text-emerald-500/50">OK</p></div>
                 <div className="bg-amber-500/10 p-2 rounded-xl text-center"><p className="text-amber-500 text-sm">{personal.warning}</p><p className="text-[7px] text-amber-500/50">90 DAYS</p></div>
                 <div className="bg-red-500/10 p-2 rounded-xl text-center"><p className="text-red-500 text-sm">{personal.expired}</p><p className="text-[7px] text-red-500/50">EXPIRED</p></div>
                 <div className="bg-white/5 p-2 rounded-xl text-center"><p className="text-slate-400 text-sm">{personal.missing}</p><p className="text-[7px] text-slate-500">MISSING</p></div>
              </div>
           </Link>

           <div className="bg-slate-900 border border-white/10 p-6 rounded-[32px] space-y-4 shadow-xl">
              <div className="flex justify-between items-center"><p className="text-slate-500">My PPE Usage</p><span className="px-2 py-0.5 bg-blue-600 rounded text-[8px]">{personal.lastStatus}</span></div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center"><p className="text-[7px] text-slate-600 mb-1 uppercase">Boiler Suit</p><p className="text-sm font-black">{personal.suit}/2</p></div>
                 <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center"><p className="text-[7px] text-slate-600 mb-1 uppercase">Boots</p><p className="text-sm font-black">{personal.boot}/1</p></div>
              </div>
              <Link href="/my-requests" className="block w-full py-3 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-500/20 rounded-xl text-center transition-all">View My History</Link>
           </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-2"><ShieldCheck size={14}/> Vessel Oversight</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-amber-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500 w-fit"><Clock size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-2xl font-black">{vessel.pending}</p><p className="text-amber-500 uppercase text-[9px]">Pending Req</p></div>
              </Link>
              <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-red-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-red-500/20 p-2.5 rounded-xl text-red-500 w-fit"><AlertTriangle size={20} className={vessel.lowStock > 0 ? "animate-pulse" : ""}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-2xl font-black">{vessel.lowStock}</p><p className="text-red-500 uppercase text-[9px]">Low Stock</p></div>
              </Link>
              <Link href="/admin/inventory" className="bg-slate-900 border border-blue-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-blue-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500 w-fit"><Package size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-2xl font-black">{vessel.totalItems}</p><p className="text-blue-500 uppercase text-[9px]">Total Items</p></div>
              </Link>
              <Link href="/admin/restock" className="bg-slate-900 border border-emerald-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-emerald-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500 w-fit"><Archive size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-lg font-black truncate">{vessel.lastRestock}</p><p className="text-emerald-500 uppercase text-[9px]">Last Restock</p></div>
              </Link>

              {/* 🎯 Fleet Readiness Box (3 Stats) */}
              <Link href="/admin/settings?tab=crews" className="col-span-2 md:col-span-4 bg-slate-900 border border-purple-500/20 p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between shadow-2xl hover:border-purple-500 transition-all group gap-6">
                 <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-purple-500/10 rounded-[32px] flex items-center justify-center text-purple-500 font-black text-2xl border border-purple-500/20 shadow-inner">{vessel.compliance}%</div>
                    <div><p className="text-lg font-black group-hover:text-purple-400 transition-colors uppercase">Fleet Cert Readiness</p><p className="text-slate-500 mt-1 uppercase text-[8px]">Vessel Certificate Compliance</p></div>
                 </div>
                 <div className="flex gap-4 w-full md:w-auto">
                    <div className="flex-1 bg-amber-500/10 p-3 rounded-2xl text-center border border-amber-500/20"><p className="text-amber-500 text-xl font-black">{vessel.vesselWarning}</p><p className="text-[7px] text-amber-500/70 uppercase">90 Days Left</p></div>
                    <div className="flex-1 bg-red-500/10 p-3 rounded-2xl text-center border border-red-500/20"><p className="text-red-500 text-xl font-black">{vessel.vesselExpired}</p><p className="text-[7px] text-red-500/70 uppercase">Expired</p></div>
                 </div>
              </Link>
           </div>
        </div>
      </div>
    </div>
  )
}
