'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  FileBadge, Users, User, AlertTriangle, ChevronRight, 
  CheckCircle2, ShieldCheck, Package, RefreshCw, Clock, Activity, ArrowUpRight 
} from 'lucide-react'
import Link from 'next/link'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [personal, setPersonal] = useState<any>({ 
    progress: 0, okCount: 0, reqCount: 0, expired: 0, warning: 0, missing: 0, suit: 0, boot: 0, lastStatus: 'None' 
  })
  const [vessel, setVessel] = useState<any>({ 
    pending: 0, lowStock: 0, vesselExpired: 0, compliance: 0, totalItems: 0, vesselWarning: 0, topAlerts: [], recentReqs: [] 
  })

  // 🎯 ชื่อฟังก์ชันหลักสำหรับการดึงข้อมูล
  async function fetchAdminData(u: any) {
    setLoading(true)
    const [matrixRes, crewsRes, allCertsRes, invRes, pendingRes, myReqsRes] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crews').select('*'),
      supabase.from('crew_certs').select('*'),
      supabase.from('ppe_inventory').select('quantity, threshold'),
      supabase.from('ppe_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
      supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected').order('created_at', { ascending: false })
    ]);

    const matrix = matrixRes.data || [];
    const crews = crewsRes.data || [];
    const allCerts = allCertsRes.data || [];
    const inventory = invRes.data || [];
    const pendingReqs = pendingRes.data || [];
    const myReqs = myReqsRes.data || [];

    // --- My Personal Logic ---
    let okCount = 0; let expired = 0; let warning = 0; let suit = 0; let boot = 0;
    const userPosNorm = normalize(u.position);
    let myRequired = matrix.filter(row => normalize(row.position) === userPosNorm && row.requirement_type === 'P');
    const myCerts = allCerts.filter(cc => cc.crew_id === u.id);
    const today = new Date();

    myRequired.forEach(req => {
      const uploaded = myCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name))
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') okCount++;
        else {
          const d = (new Date(uploaded.expiry_date).getTime() - today.getTime()) / 86400000;
          if (d < 0) expired++; else if (d <= 90) { warning++; okCount++; } else okCount++;
        }
      }
    });

    myReqs.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    });

    setPersonal({
      progress: myRequired.length > 0 ? Math.round((okCount/myRequired.length)*100) : 0,
      okCount, reqCount: myRequired.length, expired, warning,
      missing: myRequired.length - okCount, suit, boot,
      lastStatus: myReqs?.[0]?.status || 'None'
    });

    // --- Fleet Oversight Logic ---
    let totalFleetReq = 0; let totalFleetOk = 0; let vExpired = 0; let vWarning = 0;
    let crewAlerts: any[] = [];

    crews.forEach(c => {
      const cPosNorm = normalize(c.position);
      const cReq = matrix.filter(m => normalize(m.position) === cPosNorm && m.requirement_type === 'P');
      const cCerts = allCerts.filter(cc => cc.crew_id === c.id);
      totalFleetReq += cReq.length;
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
      });
      if (cExpired > 0) crewAlerts.push({ name: c.full_name, expired: cExpired, pos: c.position });
    });

    setVessel({ 
      pending: (await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')).count || 0,
      recentReqs: pendingReqs,
      lowStock: inventory.filter(i => (i.quantity||0) <= (i.threshold||0)).length, 
      totalItems: inventory.reduce((a, b) => a + (b.quantity || 0), 0), 
      compliance: totalFleetReq > 0 ? Math.round((totalFleetOk/totalFleetReq)*100) : 0, 
      vesselExpired: vExpired, vesselWarning: vWarning,
      topAlerts: crewAlerts.sort((a,b) => b.expired - a.expired).slice(0, 3) 
    });
    setLoading(false);
  }

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user');
    if (uStr) { 
      const u = JSON.parse(uStr); 
      setUser(u); 
      fetchAdminData(u); 
    }
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase text-xs tracking-widest">Command Hub Initializing...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-2 md:pt-6 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center">
        <div><h1 className="text-3xl font-black italic leading-none">Command Center</h1><p className="text-slate-500 tracking-[0.2em] mt-2">Personal & Fleet Oversight</p></div>
        <button onClick={() => fetchAdminData(user)} className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* PERSONAL TRACK */}
        <div className="lg:col-span-1 space-y-6">
           <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-2"><User size={16}/> My Status</h2>
           <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all group">
              <div className="flex justify-between items-center mb-6">
                 <div className="relative w-20 h-20 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90"><circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-white/5"/><circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray="226" strokeDashoffset={226 - (personal.progress/100)*226} className="text-blue-500"/></svg>
                   <span className="absolute text-base font-black">{personal.progress}%</span>
                 </div>
                 <div className="text-right"><p className="text-blue-400 text-lg">{personal.okCount} / {personal.reqCount}</p><p className="text-[8px] text-slate-500">Certs Valid</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                 <div className="bg-red-500/10 p-2 rounded-xl text-center"><p className="text-red-500 text-xs">{personal.expired}</p><p className="text-[6px]">EXP</p></div>
                 <div className="bg-amber-500/10 p-2 rounded-xl text-center"><p className="text-amber-500 text-xs">{personal.warning}</p><p className="text-[6px]">90D</p></div>
                 <div className="bg-white/5 p-2 rounded-xl text-center"><p className="text-slate-400 text-xs">{personal.missing}</p><p className="text-[6px]">MISS</p></div>
              </div>
           </Link>
           <Link href="/my-requests" className="block bg-slate-900 border border-white/5 p-6 rounded-[32px] space-y-4 shadow-xl hover:border-emerald-500 transition-all">
              <div className="flex justify-between items-center"><p className="text-slate-500">My PPE</p><span className="text-blue-400">{personal.lastStatus}</span></div>
              <div className="flex gap-4">
                 <div className="flex-1 text-center"><p className="text-[7px] text-slate-600">SUIT</p><p className="font-black">{personal.suit}/2</p></div>
                 <div className="flex-1 text-center"><p className="text-[7px] text-slate-600">BOOTS</p><p className="font-black">{personal.boot}/1</p></div>
              </div>
           </Link>
        </div>

        {/* VESSEL TRACK */}
        <div className="lg:col-span-3 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-2"><ShieldCheck size={14}/> Vessel Oversight</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/admin/approvals" className="bg-slate-900 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between shadow-lg hover:border-amber-500/50 transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div><p className="text-amber-500 text-3xl font-black">{vessel.pending}</p><p className="text-slate-500 uppercase text-[9px]">Pending Requests</p></div>
                    <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500"><Clock size={20}/></div>
                 </div>
                 <div className="bg-black/30 p-3 rounded-2xl border border-white/5 space-y-2">
                    {vessel.recentReqs.length === 0 ? <p className="text-slate-600">No pending items</p> : vessel.recentReqs.map((r:any) => (
                       <div key={r.id} className="flex justify-between items-center text-[9px]"><span className="text-white truncate">{r.crew_name}</span><span className="text-blue-400">{r.items?.length || 0} Items</span></div>
                    ))}
                 </div>
              </Link>

              <Link href="/admin/inventory" className="bg-slate-900 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between shadow-lg hover:border-blue-500/50 transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div><p className="text-blue-500 text-3xl font-black">{vessel.totalItems}</p><p className="text-slate-500 uppercase text-[9px]">Total Stock</p></div>
                    <div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500"><Package size={20}/></div>
                 </div>
                 <div className={`p-4 rounded-2xl border flex justify-between items-center ${vessel.lowStock > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    <div><p className={`text-xl font-black ${vessel.lowStock > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{vessel.lowStock}</p><p className="text-[8px] text-slate-500 uppercase">Below Threshold</p></div>
                    {vessel.lowStock > 0 && <ArrowUpRight className="text-red-500" size={16}/>}
                 </div>
              </Link>

              <Link href="/admin/settings?tab=crews" className="col-span-1 md:col-span-2 bg-slate-900 border border-purple-500/20 p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between shadow-2xl hover:border-purple-500 transition-all group gap-6">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-500 font-black text-xl border border-purple-500/20">{vessel.compliance}%</div>
                    <div><p className="text-lg font-black group-hover:text-purple-400 transition-colors uppercase">Fleet Readiness</p><p className="text-slate-500 mt-1 uppercase text-[8px]">Overall Certificate Compliance</p></div>
                 </div>
                 <div className="w-full md:w-64 bg-black/30 rounded-3xl p-4 border border-white/5 space-y-2 text-[9px]">
                    <p className="text-slate-500 tracking-widest border-b border-white/5 pb-1 uppercase">Top Alerts</p>
                    {vessel.topAlerts.length === 0 ? <p className="text-emerald-500 text-center py-2">All crew ready</p> : vessel.topAlerts.map((c:any, i:number) => (
                       <div key={i} className="flex justify-between text-white"><span>{c.name}</span><span className="text-red-500">{c.expired} EXP</span></div>
                    ))}
                 </div>
              </Link>
           </div>
        </div>
      </div>
    </div>
  )
}
