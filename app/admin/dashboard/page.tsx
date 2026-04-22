'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileBadge, Users, User, AlertTriangle, ChevronRight, ShieldCheck, Package, RefreshCw, Clock, Archive, ArrowUpRight, BarChart3, X, PieChart } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [stats, setStats] = useState<any>({
    myCertProgress: 0, myExpired: 0, okCount: 0, reqCount: 0, expired: 0, warning: 0, missing: 0, suit: 0, boot: 0, lastStatus: 'None',
    pendingPPE: 0, lowStock: 0, totalInventory: 0, lastRestock: 'No data', fleetCompliance: 0, fleetExpired: 0, vesselWarning: 0,
    topAlerts: [], recentReqs: []
  })
  const [requests, setRequests] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState("")
  const [availableMonths, setAvailableMonths] = useState<string[]>([])

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) { const u = JSON.parse(uStr); setUser(u); fetchAdminStats(u); }
  }, [])

  async function fetchAdminStats(u: any) {
    setIsRefreshing(true)
    const [matrixRes, crewsRes, allCertsRes, invRes, pendingRes, myReqsRes, reqsAllRes] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crews').select('*'),
      supabase.from('crew_certs').select('*'),
      supabase.from('ppe_inventory').select('quantity, threshold'),
      supabase.from('ppe_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
      supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected').order('created_at', { ascending: false }),
      supabase.from('ppe_requests').select('created_at, items, status')
    ]);

    const matrix = matrixRes.data || []; const crews = crewsRes.data || []; const allCerts = allCertsRes.data || [];
    const inventory = invRes.data || []; const pendingReqs = pendingRes.data || []; const myReqs = myReqsRes.data || [];
    const reqsAll = reqsAllRes.data || [];

    // Personal Logic
    let okCount = 0; let expired = 0; let warning = 0; let suit = 0; let boot = 0;
    const userPosNorm = normalize(u.position);
    const myReqRows = matrix.filter(row => normalize(row.position) === userPosNorm && row.requirement_type === 'P')
    const myCertsPersonal = allCerts.filter(cc => cc.crew_id === u.id)
    const today = new Date()

    myReqRows.forEach(req => {
      const c = myCertsPersonal.find(mc => normalize(mc.cert_name) === normalize(req.cert_name))
      if (c) {
        if (c.expiry_date === '2099-12-31') okCount++;
        else {
          const expDate = new Date(c.expiry_date); const diff = (expDate.getTime() - today.getTime()) / 86400000;
          if (diff < 0) expired++; else if (diff <= 90) warning++; else okCount++;
        }
      }
    })

    myReqs.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    // Fleet Oversight
    let totalFleetReq = 0; let totalFleetOk = 0; let vExpired = 0; let vWarning = 0;
    let crewAlerts: any[] = [];
    crews.forEach(c => {
      const cPosNorm = normalize(c.position);
      const cReq = matrix.filter(m => normalize(m.position) === cPosNorm && m.requirement_type === 'P');
      const cCerts = allCerts.filter(cc => cc.crew_id === c.id);
      totalFleetReq += cReq.length;
      let cExp = 0;
      cReq.forEach(req => {
        const uC = cCerts.find(cc => normalize(cc.cert_name) === normalize(req.cert_name))
        if (uC) {
          if (uC.expiry_date === '2099-12-31') totalFleetOk++;
          else {
            const expD = new Date(uC.expiry_date); const dDiff = (expD.getTime() - today.getTime())/86400000;
            if (dDiff < 0) { vExpired++; cExp++; } else if (dDiff <= 90) { vWarning++; totalFleetOk++; } else totalFleetOk++;
          }
        }
      });
      if (cExp > 0) crewAlerts.push({ name: c.full_name, expired: cExp, pos: c.position });
    })

    if (reqsAll) {
      setRequests(reqsAll);
      const months = Array.from(new Set(reqsAll.map(r => {
        const d = new Date(r.created_at); return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
      })));
      const sortedMonths = months.sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
      setAvailableMonths(sortedMonths);
      if (!selectedMonth) setSelectedMonth(sortedMonths[0]);
    }

    setStats({ 
      myCertProgress: myReqRows.length > 0 ? Math.round((okCount/myReqRows.length)*100) : 0, myExpired: expired, okCount, reqCount: myReqRows.length, warning, missing: myReqRows.length - okCount, suit, boot, lastStatus: myReqs?.[0]?.status || 'None',
      pendingPPE: (await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')).count || 0,
      lowStock: inventory.filter(i => (i.quantity||0) <= (i.threshold||0)).length, 
      totalInventory: inventory.reduce((a, b) => a + (b.quantity || 0), 0), 
      lastRestock: 'RESTOCK', fleetCompliance: totalFleetReq > 0 ? Math.round((totalFleetOk/totalFleetReq)*100) : 0, fleetExpired: vExpired, vesselWarning: vWarning,
      topAlerts: crewAlerts.sort((a,b) => b.expired - a.expired).slice(0, 3), recentReqs: pendingReqs
    })
    setLoading(false); setIsRefreshing(false);
  }

  const topItems: any[] = useMemo(() => {
    if (!selectedMonth) return [];
    const filtered = requests.filter(r => `${new Date(r.created_at).toLocaleString('en-US', { month: 'short' })} ${new Date(r.created_at).getFullYear()}` === selectedMonth && r.status !== 'rejected');
    const itemMap: any = {};
    filtered.forEach(r => r.items?.forEach((i: any) => itemMap[i.item_name] = (itemMap[i.item_name] || 0) + 1));
    return Object.entries(itemMap).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
  }, [requests, selectedMonth]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse">LOADING DASHBOARD...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-24 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center">
        <div><h1 className="text-3xl font-black italic">Dashboard</h1><p className="text-orange-500 tracking-[0.2em] mt-1">Vessel Control Center</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowReport(true)} className="p-3 bg-orange-600/10 border border-orange-500/20 text-orange-500 rounded-2xl active:scale-90 transition-all"><PieChart size={20}/></button>
          <button onClick={() => fetchAdminStats(user)} className="p-3 bg-orange-600/10 border border-orange-500/20 text-orange-500 rounded-2xl active:scale-90 transition-all"><RefreshCw className={isRefreshing ? 'animate-spin' : ''} size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* --- TRACK 1: MY PERSONAL --- */}
        <div className="lg:col-span-1 space-y-6">
           <h2 className="text-zinc-500 tracking-widest flex items-center gap-2 mb-2 uppercase text-[9px]"><User size={14}/> My Profile</h2>
           <Link href="/certificates" className="block bg-zinc-900/30 border border-orange-500/20 p-6 rounded-[32px] shadow-2xl hover:border-orange-500 transition-all group">
              <div className="flex justify-between items-center mb-6">
                 <div className="relative w-16 h-16 flex items-center justify-center"><svg className="w-full h-full transform -rotate-90"><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5"/><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="176" strokeDashoffset={176 - (stats.myCertProgress/100)*176} className="text-orange-500"/></svg><span className="absolute text-[10px] font-black">{stats.myCertProgress}%</span></div>
                 <div className="text-right"><p className="text-white text-lg">{stats.okCount} / {stats.reqCount}</p><p className="text-slate-500">Certs Valid</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                 <div className="bg-red-500/10 p-2 rounded-xl text-center"><p className="text-red-500 text-xs">{stats.myExpired}</p><p className="text-[6px] uppercase">EXP</p></div>
                 <div className="bg-amber-500/10 p-2 rounded-xl text-center"><p className="text-amber-500 text-xs">{stats.warning}</p><p className="text-[6px] uppercase">90D</p></div>
                 <div className="bg-white/5 p-2 rounded-xl text-center"><p className="text-slate-400 text-xs">{stats.missing}</p><p className="text-[6px] uppercase">MISS</p></div>
              </div>
           </Link>

           {/* 🎯 ลิงก์ไปหน้า My History */}
           <Link href="/my-requests" className="block bg-zinc-900/30 border border-orange-500/10 p-6 rounded-[32px] space-y-4 hover:border-emerald-500 transition-all">
              <div className="flex justify-between items-center"><p className="text-slate-500">My PPE Usage</p><span className="text-blue-400">{stats.lastStatus}</span></div>
              <div className="flex gap-4">
                 <div className="flex-1 text-center"><p className="text-[7px] text-zinc-600">SUIT</p><p className="text-sm font-black">{stats.suit}/2</p></div>
                 <div className="flex-1 text-center"><p className="text-[7px] text-zinc-600">BOOTS</p><p className="text-sm font-black">{stats.boot}/1</p></div>
              </div>
              <p className="text-emerald-500 text-right flex items-center justify-end gap-1">My History <ChevronRight size={12}/></p>
           </Link>
        </div>

        {/* --- TRACK 2: VESSEL OVERSIGHT --- */}
        <div className="lg:col-span-3 space-y-6">
           <h2 className="text-zinc-500 tracking-widest flex items-center gap-2 mb-2 uppercase text-[9px]"><ShieldCheck size={14}/> Vessel Oversight</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/admin/approvals" className="bg-zinc-900/30 border border-orange-500/10 p-5 rounded-[32px] flex flex-col justify-between h-40 hover:border-orange-500 transition-all"><Clock className="text-orange-500" size={20}/><p className="text-2xl font-black">{stats.pendingPPE}</p><p className="text-zinc-500 text-[8px]">Pending</p></Link>
              {/* 🎯 ลิงก์ไปหน้า Inventory พร้อม Filter Low Stock */}
              <Link href="/admin/inventory?filter=low" className="bg-zinc-900/30 border border-orange-500/10 p-5 rounded-[32px] flex flex-col justify-between h-40 hover:border-red-500 transition-all"><AlertTriangle className="text-red-500" size={20}/><p className="text-2xl font-black">{stats.lowStock}</p><p className="text-zinc-500 text-[8px]">Low Stock</p></Link>
              <Link href="/admin/inventory" className="bg-zinc-900/30 border border-orange-500/10 p-5 rounded-[32px] flex flex-col justify-between h-40 hover:border-blue-500 transition-all"><Package className="text-blue-500" size={20}/><p className="text-2xl font-black">{stats.totalInventory}</p><p className="text-zinc-500 text-[8px]">Inventory</p></Link>
              <Link href="/admin/restock" className="bg-zinc-900/30 border border-orange-500/10 p-5 rounded-[32px] flex flex-col justify-between h-40 hover:border-emerald-500 transition-all"><Archive className="text-emerald-500" size={20}/><p className="text-lg font-black">RECEIVE</p><p className="text-zinc-500 text-[8px]">Stock In</p></Link>
              
              <Link href="/admin/settings?tab=crews" className="col-span-2 md:col-span-4 bg-zinc-900/30 border border-orange-500/20 p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between hover:border-orange-500 transition-all gap-6 shadow-2xl">
                 <div className="flex items-center gap-6"><div className="w-20 h-20 bg-orange-600/10 rounded-[32px] flex items-center justify-center text-orange-500 font-black text-2xl border border-orange-500/20 shadow-inner">{stats.fleetCompliance}%</div><div><p className="text-xl font-black text-white italic uppercase">Fleet Readiness</p><p className="text-zinc-500 mt-1 uppercase text-[8px]">Vessel Certificate Compliance Hub</p></div></div>
                 <div className="flex gap-4"><div className="text-center border-r border-white/5 pr-4"><p className="text-red-500 text-xl font-black">{stats.fleetExpired}</p><p className="text-[7px] text-zinc-500 uppercase">Expired</p></div><div className="text-center pl-4"><p className="text-orange-500 text-xl font-black">{stats.vesselWarning}</p><p className="text-[7px] text-zinc-500 uppercase">90 Days</p></div></div>
              </Link>
           </div>
        </div>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col p-6 animate-in slide-in-from-bottom">
           <div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-black uppercase italic italic text-orange-500 flex items-center gap-3"><BarChart3/> Consumption Analysis</h2><button onClick={() => setShowReport(false)} className="p-3 bg-white/5 rounded-full"><X/></button></div>
           <div className="space-y-6 max-w-sm mx-auto w-full overflow-y-auto">
              {topItems.length > 0 ? topItems.map(([name, count]: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-white"><span>{name}</span><span className="text-orange-500">{count} Units</span></div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden"><div className="bg-orange-600 h-full rounded-full transition-all" style={{ width: `${(count / topItems[0][1]) * 100}%` }}></div></div>
                </div>
              )) : <p className="text-center text-zinc-700 py-20 font-black uppercase">No data</p>}
           </div>
        </div>
      )}
    </div>
  )
}
