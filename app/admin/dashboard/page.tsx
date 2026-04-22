'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileBadge, Users, User, AlertTriangle, ChevronRight, ShieldCheck, Package, RefreshCw, Clock, Activity, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [personal, setPersonal] = useState<any>({ progress: 0, okCount: 0, reqCount: 0, expired: 0, warning: 0, missing: 0, suit: 0, boot: 0, lastStatus: 'None' })
  const [vessel, setVessel] = useState<any>({ pending: 0, lowStock: 0, totalItems: 0, compliance: 0, vesselExpired: 0, vesselWarning: 0, topAlerts: [], recentReqs: [] })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) { const u = JSON.parse(uStr); setUser(u); fetchAdminStats(u); }
  }, [])

  async function fetchAdminStats(u: any) {
    const [matrixRes, crewsRes, allCertsRes, invRes, pendingRes, myReqsRes] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crews').select('*'),
      supabase.from('crew_certs').select('*'),
      supabase.from('ppe_inventory').select('quantity, threshold'),
      supabase.from('ppe_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
      supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected').order('created_at', { ascending: false })
    ]);

    const matrix = matrixRes.data; const crews = crewsRes.data; const allCerts = allCertsRes.data;
    const inventory = invRes.data; const pendingReqs = pendingRes.data; const myReqs = myReqsRes.data;

    // --- My Personal ---
    let okCount = 0; let expired = 0; let warning = 0; let suit = 0; let boot = 0;
    const userPosNorm = normalize(u.position);
    const myReqRows = matrix?.filter(m => normalize(m.position) === userPosNorm && m.requirement_type === 'P') || []
    const myCerts = allCerts?.filter(cc => cc.crew_id === u.id) || []
    const today = new Date()

    myReqRows.forEach(req => {
      const c = myCerts.find(mc => normalize(mc.cert_name) === normalize(req.cert_name))
      if (c) {
        if (c.expiry_date === '2099-12-31') okCount++;
        else {
          const d = (new Date(c.expiry_date).getTime() - today.getTime()) / 86400000;
          if (d < 0) expired++; else if (d <= 90) { warning++; okCount++; } else okCount++;
        }
      }
    })

    myReqs?.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    setPersonal({ progress: myReqRows.length > 0 ? Math.round((okCount/myReqRows.length)*100) : 0, okCount, reqCount: myReqRows.length, expired, warning, missing: myReqRows.length - (okCount+expired-warning), suit, boot, lastStatus: myReqs?.[0]?.status || 'None' })

    // --- Fleet Oversight ---
    let totalFleetReq = 0; let totalFleetOk = 0; let vExpired = 0; let vWarning = 0;
    let crewAlerts: any[] = [];

    crews?.forEach(c => {
      const cPosNorm = normalize(c.position);
      const cReq = matrix?.filter(m => normalize(m.position) === cPosNorm && m.requirement_type === 'P') || []
      const cCerts = allCerts?.filter(cc => cc.crew_id === c.id) || []
      totalFleetReq += cReq.length
      
      let cExpired = 0;
      cReq.forEach(req => {
        const uC = cCerts.find(cc => normalize(cc.cert_name) === normalize(req.cert_name))
        if (uC) {
          if (uC.expiry_date === '2099-12-31') totalFleetOk++;
          else {
            const expD = new Date(uC.expiry_date); const dDiff = (expD.getTime() - today.getTime())/86400000;
            if (dDiff < 0) { vExpired++; cExpired++; } else if (dDiff <= 90) { vWarning++; totalFleetOk++; } else totalFleetOk++;
          }
        }
      })
      if (cExpired > 0) crewAlerts.push({ name: c.full_name, expired: cExpired, pos: c.position })
    })

    const { count: totalPending } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    setVessel({ 
      pending: totalPending || 0, 
      recentReqs: pendingReqs || [],
      lowStock: inventory?.filter(i => (i.quantity||0) <= (i.threshold||0)).length || 0, 
      totalItems: inventory?.reduce((a, b) => a + (b.quantity || 0), 0) || 0, 
      compliance: totalFleetReq > 0 ? Math.round((totalFleetOk/totalFleetReq)*100) : 0, 
      vesselExpired: vExpired, 
      vesselWarning: vWarning,
      topAlerts: crewAlerts.sort((a,b) => b.expired - a.expired).slice(0, 3) 
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING HUB...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center">
        <div><h1 className="text-3xl font-black italic leading-none">Command Center</h1><p className="text-slate-500 tracking-[0.2em] mt-2 font-black uppercase text-[10px]">Vessel Operation Hub</p></div>
        <button onClick={() => {setLoading(true); fetchStats(user);}} className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* --- TRACK 1: MY PERSONAL --- */}
        <div className="lg:col-span-1 space-y-6">
           <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-2"><User size={16}/> My Personal Status</h2>
           
           <Link href="/certificates" className="block bg-slate-900 border border-white/5 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all group">
              <div className="flex justify-between items-center mb-6">
                 <div className="relative w-20 h-20 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90"><circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-white/5"/><circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray="226" strokeDashoffset={226 - (personal.progress/100)*226} className="text-blue-500 transition-all duration-1000"/></svg>
                   <span className="absolute text-base font-black">{personal.progress}%</span>
                 </div>
                 <div className="text-right"><p className="text-blue-400 text-lg">{personal.okCount} / {personal.reqCount}</p><p className="text-[8px] text-slate-500">Certs Valid</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                 <div className="bg-red-500/10 p-2 rounded-xl text-center border border-red-500/10"><p className="text-red-500 text-xs">{personal.expired}</p><p className="text-[6px] text-red-500/50 uppercase">Expired</p></div>
                 <div className="bg-amber-500/10 p-2 rounded-xl text-center border border-amber-500/10"><p className="text-amber-500 text-xs">{personal.warning}</p><p className="text-[6px] text-amber-500/50 uppercase">90 Days</p></div>
                 <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5"><p className="text-slate-400 text-xs">{personal.missing}</p><p className="text-[6px] text-slate-500 uppercase">Missing</p></div>
              </div>
           </Link>

           <div className="bg-slate-900 border border-white/5 p-6 rounded-[32px] space-y-4 shadow-xl">
              <div className="flex justify-between items-center"><p className="text-slate-500">My PPE Quota</p><span className="px-2 py-0.5 bg-blue-600 rounded text-[8px]">{personal.lastStatus}</span></div>
              <div className="flex gap-4">
                 <div className="flex-1 bg-black/30 p-2 rounded-xl border border-white/5 text-center"><p className="text-[7px] text-slate-600 mb-1 uppercase">Boiler Suit</p><p className="font-black">{personal.suit}/2</p></div>
                 <div className="flex-1 bg-black/30 p-2 rounded-xl border border-white/5 text-center"><p className="text-[7px] text-slate-600 mb-1 uppercase">Boots</p><p className="font-black">{personal.boot}/1</p></div>
              </div>
              <Link href="/my-requests" className="block w-full py-3 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-500/20 rounded-xl text-center transition-all">View History</Link>
           </div>
        </div>

        {/* --- TRACK 2: FLEET OVERSIGHT (Enterprise Layout) --- */}
        <div className="lg:col-span-3 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-2"><ShieldCheck size={16}/> Vessel Oversight</h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* 1. PPE Approvals (Dense Data) */}
              <Link href="/admin/approvals" className="bg-slate-900 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between shadow-lg hover:border-amber-500/50 transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div><p className="text-amber-500 text-3xl font-black">{vessel.pending}</p><p className="text-slate-500 uppercase text-[9px] tracking-widest">Pending Requests</p></div>
                    <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500"><Clock size={20}/></div>
                 </div>
                 <div className="bg-black/30 p-3 rounded-2xl border border-white/5 space-y-2">
                    <p className="text-[8px] text-slate-600 tracking-widest border-b border-white/5 pb-1">Recent Requests</p>
                    {vessel.recentReqs.length === 0 ? <p className="text-slate-500 text-[9px]">All clear</p> : vessel.recentReqs.map((r:any) => (
                       <div key={r.id} className="flex justify-between items-center text-[9px]"><span className="text-white truncate">{r.crew_name}</span><span className="text-blue-400">{r.items?.length || 0} Items</span></div>
                    ))}
                 </div>
              </Link>

              {/* 2. Inventory Health (Combined Stats) */}
              <Link href="/admin/inventory" className="bg-slate-900 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between shadow-lg hover:border-blue-500/50 transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div><p className="text-blue-500 text-3xl font-black">{vessel.totalItems}</p><p className="text-slate-500 uppercase text-[9px] tracking-widest">Total Inventory Items</p></div>
                    <div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500"><Package size={20}/></div>
                 </div>
                 <div className={`p-4 rounded-2xl border flex justify-between items-center ${vessel.lowStock > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    <div>
                       <p className={`text-xl font-black ${vessel.lowStock > 0 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>{vessel.lowStock}</p>
                       <p className="text-[8px] text-slate-500 uppercase">Items below threshold</p>
                    </div>
                    {vessel.lowStock > 0 && <ArrowUpRight className="text-red-500"/>}
                 </div>
              </Link>

              {/* 3. Fleet Readiness & Top Alerts (Full Width) */}
              <Link href="/admin/settings?tab=crews" className="col-span-1 md:col-span-2 bg-slate-900 border border-purple-500/20 p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between shadow-2xl hover:border-purple-500 transition-all group gap-6">
                 <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="w-20 h-20 bg-purple-500/10 rounded-[32px] flex items-center justify-center text-purple-500 font-black text-2xl border border-purple-500/20 shadow-inner shrink-0">{vessel.compliance}%</div>
                    <div>
                       <p className="text-xl font-black leading-none group-hover:text-purple-400 transition-colors">Fleet Cert Readiness</p>
                       <div className="flex gap-3 mt-2">
                          <span className="text-red-500 text-[10px] font-black bg-red-500/10 px-2 py-1 rounded-md">{vessel.vesselExpired} Expired</span>
                          <span className="text-amber-500 text-[10px] font-black bg-amber-500/10 px-2 py-1 rounded-md">{vessel.vesselWarning} 90 Days</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="w-full md:w-64 bg-black/30 rounded-3xl p-4 border border-white/5 space-y-2">
                    <p className="text-slate-500 text-[8px] tracking-widest border-b border-white/5 pb-2">Top Critical Crews</p>
                    {vessel.topAlerts.length === 0 ? (
                       <p className="text-emerald-500 py-4 text-center">All crew members are compliant!</p>
                    ) : (
                       vessel.topAlerts.map((crew: any, idx: number) => (
                         <div key={idx} className="flex justify-between items-center text-[9px]">
                            <div className="truncate"><p className="text-white truncate">{crew.name}</p></div>
                            <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded-md ml-2">{crew.expired} EXP</span>
                         </div>
                       ))
                    )}
                 </div>
              </Link>
           </div>
        </div>
      </div>
    </div>
  )
}
