'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  FileBadge, Users, User, AlertTriangle, ChevronRight, 
  CheckCircle2, ShieldCheck, Package, RefreshCw, Clock 
} from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    myCertProgress: 0,
    myExpiredCerts: 0,
    mySuitQuota: 0,
    myBootQuota: 0,
    pendingPPE: 0,
    lowStockItems: 0,
    fleetCompliance: 0
  })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) {
      const u = JSON.parse(uStr)
      setUser(u)
      fetchAdminData(u)
    }
  }, [])

  async function fetchAdminData(u: any) {
    // 1. Personal Stats
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    
    let myProgress = 0; let myExpired = 0;
    if (matrix && myCerts) {
      const required = matrix.filter(m => m[u.position] === 'P')
      const okCerts = myCerts.filter(c => new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31').length
      myExpired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      myProgress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }

    // 2. Personal PPE Quota
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected')
    let suit = 0; let boot = 0;
    myReqs?.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    // 3. Fleet Oversight
    const { count: pendingCount } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    const lowStock = inventory?.filter(i => i.quantity <= i.threshold).length || 0
    
    setStats({
      myCertProgress: myProgress,
      myExpiredCerts: myExpired,
      mySuitQuota: suit,
      myBootQuota: boot,
      pendingPPE: pendingCount || 0,
      lowStockItems: lowStock,
      fleetCompliance: 88
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase text-xs">Admin Hub Loading...</div>

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32 pt-20 font-sans text-white text-xs uppercase font-bold">
      <div className="mb-10 flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-black italic leading-none">Command Center</h1>
           <p className="text-slate-500 tracking-[0.2em] mt-2 font-black uppercase text-[10px]">Management & Personal Status</p>
        </div>
        <button onClick={() => window.location.reload()} className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all active:rotate-180 duration-500"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PERSONAL TRACK */}
        <div className="space-y-6">
           <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-2"><User size={14}/> My Personal Compliance</h2>
           <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all">
              <div className="flex justify-between items-center mb-4">
                 <FileBadge className="text-blue-500" size={32}/>
                 <span className="text-2xl font-black">{stats.myCertProgress}%</span>
              </div>
              <p className="text-[10px] font-black uppercase mb-2">My Certificates</p>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                 <div className="bg-blue-500 h-full" style={{ width: `${stats.myCertProgress}%` }}></div>
              </div>
              {stats.myExpiredCerts > 0 && <p className="mt-3 text-red-500 animate-pulse">⚠️ {stats.myExpiredCerts} Expired</p>}
           </Link>
           <div className="bg-slate-900 border border-white/10 p-6 rounded-[32px] space-y-4 shadow-xl">
              <p className="text-slate-500">My PPE Usage (Annual)</p>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] text-slate-600">Boiler Suit</p>
                    <p className="font-black text-sm">{stats.mySuitQuota}/2</p>
                 </div>
                 <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] text-slate-600">Boots</p>
                    <p className="font-black text-sm">{stats.myBootQuota}/1</p>
                 </div>
              </div>
           </div>
        </div>

        {/* FLEET TRACK */}
        <div className="lg:col-span-2 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-2"><ShieldCheck size={14}/> Vessel Oversight</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/30 p-6 rounded-[32px] flex flex-col justify-between h-44 shadow-lg hover:border-amber-500 transition-all active:scale-95">
                 <div className="flex justify-between items-start">
                    <div className="bg-amber-500/20 p-3 rounded-2xl text-amber-500"><Clock size={24}/></div>
                    <ChevronRight className="text-slate-700"/>
                 </div>
                 <div>
                    <p className="text-4xl font-black">{stats.pendingPPE}</p>
                    <p className="text-amber-500 mt-1">Pending PPE Requests</p>
                 </div>
              </Link>
              <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/30 p-6 rounded-[32px] flex flex-col justify-between h-44 shadow-lg hover:border-red-500 transition-all active:scale-95">
                 <div className="flex justify-between items-start">
                    <div className="bg-red-500/20 p-3 rounded-2xl text-red-500"><AlertTriangle size={24}/></div>
                    <ChevronRight className="text-slate-700"/>
                 </div>
                 <div>
                    <p className="text-4xl font-black">{stats.lowStockItems}</p>
                    <p className="text-red-500 mt-1">Low Stock Alerts</p>
                 </div>
              </Link>
              <div className="md:col-span-2 bg-slate-900 border border-white/5 p-8 rounded-[40px] flex items-center justify-between shadow-2xl">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-500 font-black text-xl">{stats.fleetCompliance}%</div>
                    <div>
                       <p className="text-lg font-black leading-none">Fleet Readiness</p>
                       <p className="text-slate-500 mt-1">Overall Certificate Compliance</p>
                    </div>
                 </div>
                 <Users size={32} className="text-slate-700"/>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
