'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileBadge, Users, User, AlertTriangle, ChevronRight, CheckCircle2, ShieldCheck, Activity, Clock, Box, Archive } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({
    myCertProgress: 0, myExpired: 0, suitQuota: 0, bootQuota: 0,
    pendingPPE: 0, lowStock: 0, totalInventory: 0, lastRestock: 'No data', fleetCompliance: 0, fleetExpired: 0,
    topExpired: []
  })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) { const u = JSON.parse(uStr); setUser(u); fetchAdminStats(u); }
  }, [])

  async function fetchAdminStats(u: any) {
    // --- Data Fetching ---
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected')
    const { data: crews } = await supabase.from('crews').select('*')
    const { data: allCerts } = await supabase.from('crew_certs').select('*')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    const { count: pendingCount } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    const { data: restock } = await supabase.from('restock_history').select('created_at').order('created_at', { ascending: false }).limit(1)

    // --- My Personal Progress ---
    let myProgress = 0; let myExpired = 0; let suit = 0; let boot = 0;
    if (matrix && myCerts) {
      const posKey = u.position ? u.position.trim().toLowerCase() : "";
      const required = matrix.filter(row => {
        const colKey = Object.keys(row).find(k => k.trim().toLowerCase() === posKey);
        return colKey && String(row[colKey]).toUpperCase() === 'P';
      })
      const okCerts = required.filter(req => {
        const c = myCerts.find(mc => mc.cert_name.trim().toLowerCase() === req.cert_name.trim().toLowerCase())
        return c && (new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31')
      }).length
      myExpired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      myProgress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }

    myReqs?.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    // --- Fleet Oversight ---
    const lowStockCount = inventory?.filter(i => i.quantity <= i.threshold).length || 0
    const lastRestock = restock && restock.length > 0 ? new Date(restock[0].created_at).toLocaleDateString('en-GB') : "N/A"

    // คำนวณความพร้อมของลูกเรือทั้งลำ (Fleet Compliance)
    let totalRequired = 0; let totalOk = 0;
    let crewAlerts: any[] = []; // เก็บชื่อลูกเรือที่มีใบหมดอายุ

    crews?.forEach(crew => {
      const posKey = crew.position ? crew.position.trim().toLowerCase() : "";
      const req = matrix?.filter(row => {
        const colKey = Object.keys(row).find(k => k.trim().toLowerCase() === posKey);
        return colKey && String(row[colKey]).toUpperCase() === 'P';
      }) || []
      
      const crewC = allCerts?.filter(c => c.crew_id === crew.id) || []
      let crewExpired = 0;

      req.forEach(r => {
        totalRequired++;
        const c = crewC.find(mc => mc.cert_name.trim().toLowerCase() === r.cert_name.trim().toLowerCase())
        if (c && (new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31')) {
          totalOk++;
        }
      })
      
      crewExpired = crewC.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      if (crewExpired > 0) crewAlerts.push({ name: crew.full_name, expired: crewExpired, pos: crew.position })
    })

    const compliance = totalRequired > 0 ? Math.round((totalOk / totalRequired) * 100) : 0
    const fleetExpired = allCerts?.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length || 0

    setStats({ 
      myCertProgress: myProgress, myExpired, suitQuota: suit, bootQuota: boot, 
      pendingPPE: pendingCount || 0, lowStock: lowStockCount, 
      totalInventory: inventory?.reduce((a, b) => a + b.quantity, 0) || 0, 
      lastRestock, fleetCompliance: compliance, fleetExpired,
      topExpired: crewAlerts.sort((a,b) => b.expired - a.expired).slice(0, 3) // ดึงมาแค่ 3 คนที่อาการหนักสุด
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING DASHBOARD...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center"><h1 className="text-3xl font-black italic leading-none">Command Center</h1><button onClick={() => window.location.reload()} className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><RefreshCw size={20}/></button></div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* --- TRACK 1: MY PERSONAL (ซ้ายสุด คอลัมน์ 1) --- */}
        <div className="lg:col-span-1 space-y-6">
           <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-2"><User size={14}/> My Personal Status</h2>
           <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all">
              <div className="flex justify-between items-center mb-4"><FileBadge className="text-blue-500" size={32}/><span className="text-2xl font-black">{stats.myCertProgress}%</span></div>
              <p className="text-xs uppercase font-black">My Certificates</p>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden"><div className="bg-blue-500 h-full" style={{ width: `${stats.myCertProgress}%` }}></div></div>
              {stats.myExpired > 0 && <p className="mt-3 text-red-500 animate-pulse">⚠️ {stats.myExpired} Expired</p>}
           </Link>
           <div className="bg-slate-900 border border-white/10 p-6 rounded-[32px] space-y-4 shadow-xl">
              <div className="flex justify-between items-center"><p className="text-slate-500">My PPE Quotas</p><Link href="/ppe" className="text-emerald-500 hover:underline">Request <ChevronRight size={12} className="inline"/></Link></div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center"><p className="text-[8px] text-slate-600">Boiler Suit</p><p className="font-black text-sm">{stats.suitQuota}/2</p></div>
                 <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center"><p className="text-[8px] text-slate-600">Boots</p><p className="font-black text-sm">{stats.bootQuota}/1</p></div>
              </div>
           </div>
        </div>

        {/* --- TRACK 2: FLEET OVERSIGHT (ขวา คอลัมน์ 2-4) --- */}
        <div className="lg:col-span-3 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-2"><ShieldCheck size={14}/> Vessel Oversight</h2>
           
           {/* Grid ย่อยของ Fleet */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-amber-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500"><Clock size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-2xl font-black">{stats.pendingPPE}</p><p className="text-amber-500 mt-1">Pending Req</p></div>
              </Link>
              <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-red-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-red-500/20 p-2.5 rounded-xl text-red-500"><AlertTriangle size={20} className={stats.lowStock > 0 ? "animate-pulse" : ""}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-2xl font-black">{stats.lowStock}</p><p className="text-red-500 mt-1">Low Stock</p></div>
              </Link>
              <Link href="/admin/inventory" className="bg-slate-900 border border-blue-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-blue-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500"><Box size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-2xl font-black">{stats.totalInventory}</p><p className="text-blue-500 mt-1">Total Items</p></div>
              </Link>
              <Link href="/admin/restock" className="bg-slate-900 border border-emerald-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-emerald-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500"><Archive size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-lg font-black truncate">{stats.lastRestock}</p><p className="text-emerald-500 mt-1">Last Restock</p></div>
              </Link>

              {/* Fleet Compliance Box + Alert List (กินพื้นที่ 4 คอลัมน์) */}
              <div className="col-span-2 md:col-span-4 bg-slate-900 border border-white/5 p-6 rounded-[40px] shadow-2xl flex flex-col md:flex-row gap-8">
                 <Link href="/admin/settings?tab=crews" className="flex-1 flex items-center gap-6 group">
                    <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-500 font-black text-2xl border border-purple-500/20">{stats.fleetCompliance}%</div>
                    <div>
                       <p className="text-xl font-black leading-none group-hover:text-purple-400 transition-colors">Fleet Cert Readiness</p>
                       <p className="text-slate-500 mt-1">Overall Vessel Compliance</p>
                       <p className="mt-3 text-red-500 font-black flex items-center gap-1"><AlertTriangle size={14}/> {stats.fleetExpired} Total Expired Certificates</p>
                    </div>
                 </Link>

                 {/* ตารางย่อย โชว์คนที่ใบเซอร์หมดอายุเยอะสุด 3 อันดับแรก */}
                 <div className="flex-1 bg-black/30 rounded-3xl p-4 border border-white/5 space-y-2">
                    <p className="text-slate-500 text-[8px] tracking-widest border-b border-white/5 pb-2">Critical Attention Required</p>
                    {stats.topExpired.length === 0 ? (
                       <p className="text-emerald-500 py-4 text-center">All crew members are compliant!</p>
                    ) : (
                       stats.topExpired.map((crew: any, idx: number) => (
                         <div key={idx} className="flex justify-between items-center text-[10px]">
                            <div><p className="text-white truncate max-w-[150px]">{crew.name}</p><p className="text-slate-500 font-normal">{crew.pos}</p></div>
                            <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded-md">{crew.expired} Expired</span>
                         </div>
                       ))
                    )}
                 </div>
              </div>

           </div>
        </div>
      </div>
    </div>
  )
}
