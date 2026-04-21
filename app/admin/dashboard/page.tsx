'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  FileBadge, Users, User, AlertTriangle, ChevronRight, 
  CheckCircle2, ShieldCheck, Package, RefreshCw, Clock, Archive, Activity 
} from 'lucide-react'
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
    if (uStr) {
      const u = JSON.parse(uStr)
      setUser(u)
      fetchStats(u)
    }
  }, [])

  async function fetchStats(u: any) {
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: crews } = await supabase.from('crews').select('*')
    const { data: allCerts } = await supabase.from('crew_certs').select('*')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    const { data: rules } = await supabase.from('cert_rules').select('*')
    const { count: pending } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected').order('created_at', { ascending: false })

    // --- My Personal Data ---
    let okCount = 0; let expired = 0; let warning = 0; let suit = 0; let boot = 0;
    const userPosNorm = normalize(u.position);
    
    let myRequired = matrix?.filter(row => {
      const colKey = Object.keys(row).find(k => normalize(k) === userPosNorm);
      return colKey && String(row[colKey]).toUpperCase() === 'P';
    }).map(m => ({ cert_name: m.cert_name })) || [];

    const myCerts = allCerts?.filter(cc => cc.crew_id === u.id) || [];
    
    rules?.forEach(rule => {
      if (myCerts.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))) {
        if (!myRequired.some(req => normalize(req.cert_name) === normalize(rule.required_cert))) {
          myRequired.push({ cert_name: rule.required_cert })
        }
      }
    });

    const today = new Date();
    myRequired.forEach(req => {
      const uploaded = myCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name))
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') okCount++;
        else {
          const expDate = new Date(uploaded.expiry_date);
          const diff = (expDate.getTime() - today.getTime()) / 86400000;
          if (diff < 0) expired++; else if (diff <= 90) { warning++; okCount++; } else okCount++;
        }
      }
    });

    myReqs?.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    });

    setPersonal({
      progress: myRequired.length > 0 ? Math.round((okCount / myRequired.length) * 100) : 0,
      okCount, reqCount: myRequired.length, expired, warning,
      missing: myRequired.length - okCount, suit, boot,
      lastStatus: myReqs?.[0]?.status || 'None'
    });

    // --- Fleet Oversight ---
    let totalFleetReq = 0; let totalFleetOk = 0; let vExpired = 0; let vWarning = 0;
    crews?.forEach(c => {
      const cPosNorm = normalize(c.position);
      const cReq = matrix?.filter(m => normalize(m.position) === cPosNorm && m.requirement_type === 'P') || []
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-widest text-xs">Hub Accessing...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center">
        <div><h1 className="text-3xl font-black italic leading-none">Command Center</h1><p className="text-slate-500 tracking-widest mt-2">Personal & Fleet Oversight</p></div>
        <button onClick={() => {setLoading(true); fetchStats(user);}} className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* PERSONAL TRACK */}
        <div className="lg:col-span-1 space-y-6">
           <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-2"><User size={16}/> My Personal</h2>
           <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all">
              <div className="flex justify-between items-center mb-6">
                 <div className="relative w-16 h-16 flex items-center justify-center"><svg className="w-full h-full transform -rotate-90"><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5"/><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="176" strokeDashoffset={176 - (personal.progress/100)*176} className="text-blue-500"/></svg><span className="absolute text-[10px] font-black">{personal.progress}%</span></div>
                 <div className="text-right"><p className="text-blue-400 text-lg">{personal.okCount}/{personal.reqCount}</p><p className="text-[7px] text-slate-500">Certs Valid</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-red-500/10 p-2 rounded-xl text-center border border-red-500/10"><p className="text-red-500 text-xs">{personal.expired}</p><p className="text-[6px] text-red-500/50 uppercase">Expired</p></div>
                 <div className="bg-amber-500/10 p-2 rounded-xl text-center border border-amber-500/10"><p className="text-amber-500 text-xs">{personal.warning}</p><p className="text-[6px] text-amber-500/50 uppercase">Soon</p></div>
              </div>
           </Link>
           <div className="bg-slate-900 border border-white/5 p-6 rounded-[32px] space-y-4 shadow-xl">
              <div className="flex justify-between items-center"><p className="text-slate-500">My PPE Quota</p><span className="text-blue-400">{personal.lastStatus}</span></div>
              <div className="flex gap-4">
                 <div className="flex-1 bg-black/30 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] text-slate-600 uppercase">Suit</p><p className="font-black">{personal.suit}/2</p></div>
                 <div className="flex-1 bg-black/30 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] text-slate-600 uppercase">Boots</p><p className="font-black">{personal.boot}/1</p></div>
              </div>
              <Link href="/my-requests" className="block w-full py-3 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-500/20 rounded-xl text-center transition-all">View History</Link>
           </div>
        </div>

        {/* VESSEL TRACK */}
        <div className="lg:col-span-3 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-2"><ShieldCheck size={14}/> Vessel Oversight</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-amber-500 transition-all active:scale-95 group">
                 <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500 w-fit"><Clock size={20}/></div>
                 <div><p className="text-2xl font-black">{vessel.pending}</p><p className="text-amber-500 uppercase text-[9px]">Pending Req</p></div>
              </Link>
              <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-red-500 transition-all active:scale-95 group">
                 <div className="bg-red-500/20 p-2.5 rounded-xl text-red-500 w-fit"><AlertTriangle size={20}/></div>
                 <div><p className="text-2xl font-black">{vessel.lowStock}</p><p className="text-red-500 uppercase text-[9px]">Low Stock</p></div>
              </Link>
              <Link href="/admin/inventory" className="bg-slate-900 border border-blue-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-blue-500 transition-all active:scale-95 group">
                 <div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500 w-fit"><Package size={20}/></div>
                 <div><p className="text-2xl font-black">{vessel.totalItems}</p><p className="text-blue-500 uppercase text-[9px]">Total Items</p></div>
              </Link>
              <Link href="/admin/restock" className="bg-slate-900 border border-emerald-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-emerald-500 transition-all active:scale-95 group">
                 <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500 w-fit"><Archive size={20}/></div>
                 <div><p className="text-lg font-black truncate">RECEIVE</p><p className="text-emerald-500 uppercase text-[9px]">Goods Receipt</p></div>
              </Link>

              <Link href="/admin/settings?tab=crews" className="col-span-2 md:col-span-4 bg-slate-900 border border-purple-500/20 p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between shadow-2xl hover:border-purple-500 transition-all group gap-6">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-500 font-black text-xl border border-purple-500/20">{vessel.compliance}%</div>
                    <div>
                       <p className="text-lg font-black group-hover:text-purple-400 transition-colors uppercase">Fleet Cert Readiness</p>
                       <p className="text-slate-500 mt-1 uppercase text-[8px]">Overall Certificate Compliance</p>
                    </div>
                 </div>
                 <div className="flex gap-4 w-full md:w-auto">
                    <div className="flex-1 bg-amber-500/10 p-3 rounded-2xl text-center border border-amber-500/20"><p className="text-amber-500 text-xl font-black">{vessel.vesselWarning}</p><p className="text-[7px] text-amber-500/70 uppercase">90 Days Left</p></div>
                    <div className="flex-1 bg-red-500/10 p-3 rounded-2xl text-center border border-red-500/20"><p className="text-red-500 text-xl font-black">{vessel.vesselExpired}</p><p className="text-[7px] text-red-500/70 uppercase">Expired Total</p></div>
                 </div>
              </Link>
           </div>
        </div>
      </div>
    </div>
  )
}
