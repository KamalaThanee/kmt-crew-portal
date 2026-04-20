'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileBadge, Users, User, AlertTriangle, ChevronRight, CheckCircle2, ShieldCheck, Package, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    myCertProgress: 0,
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
      fetchAdminStats(u)
    }
  }, [])

  async function fetchAdminStats(u: any) {
    // 1. Personal Stats (Same logic as Crew)
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    let myProgress = 0;
    if (matrix && myCerts) {
      const required = matrix.filter(m => m[u.position] === 'P')
      const okCerts = myCerts.filter(c => new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31').length
      myProgress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }

    // 2. Fleet Overview
    const { count: pendingCount } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    const lowStock = inventory?.filter(i => i.quantity <= i.threshold).length || 0
    
    setStats({
      myCertProgress: myProgress,
      mySuitQuota: 0, // Placeholder
      myBootQuota: 0, // Placeholder
      pendingPPE: pendingCount || 0,
      lowStockItems: lowStock,
      fleetCompliance: 85 // Placeholder
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase text-xs">Admin Hub Loading...</div>

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32 pt-20 font-sans text-white">
      <div className="mb-10 flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-black uppercase italic leading-none">Command Center</h1>
           <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Personal Status & Vessel Oversight</p>
        </div>
        <button onClick={() => window.location.reload()} className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- Section 1: My Personal Track --- */}
        <div className="space-y-6">
           <h2 className="text-[10px] font-black uppercase text-blue-500 tracking-widest flex items-center gap-2"><User size={14}/> My Personal Compliance</h2>
           <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all">
              <div className="flex justify-between items-center mb-4">
                 <FileBadge className="text-blue-500" size={32}/>
                 <span className="text-2xl font-black">{stats.myCertProgress}%</span>
              </div>
              <p className="text-xs font-bold uppercase">My Certificates</p>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
                 <div className="bg-blue-500 h-full" style={{ width: `${stats.myCertProgress}%` }}></div>
              </div>
           </Link>
           <Link href="/ppe" className="block bg-slate-900 border border-white/10 p-6 rounded-[32px] space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase">
                 <span className="text-slate-500">My PPE Quotas</span>
                 <span className="text-emerald-500">Ready</span>
              </div>
              <div className="flex gap-4">
                 <div className="flex-1 bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] text-slate-500 uppercase">Boiler Suit</p>
                    <p className="font-black">0/2</p>
                 </div>
                 <div className="flex-1 bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] text-slate-500 uppercase">Safety Boots</p>
                    <p className="font-black">0/1</p>
                 </div>
              </div>
           </Link>
        </div>

        {/* --- Section 2: Vessel Management Track --- */}
        <div className="lg:col-span-2 space-y-6">
           <h2 className="text-[10px] font-black uppercase text-purple-500 tracking-widest flex items-center gap-2"><ShieldCheck size={14}/> Vessel Oversight</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/30 p-6 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-amber-500 transition-all">
                 <div className="flex justify-between items-start">
                    <div className="bg-amber-500/20 p-3 rounded-2xl text-amber-500"><Clock size={24}/></div>
                    <ChevronRight className="text-slate-700"/>
                 </div>
                 <div>
                    <p className="text-3xl font-black">{stats.pendingPPE}</p>
                    <p className="text-[10px] font-black uppercase text-amber-500">Pending Requests</p>
                 </div>
              </Link>

              <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/30 p-6 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-red-500 transition-all">
                 <div className="flex justify-between items-start">
                    <div className="bg-red-500/20 p-3 rounded-2xl text-red-500"><AlertTriangle size={24} className={stats.lowStockItems > 0 ? "animate-pulse" : ""}/></div>
                    <ChevronRight className="text-slate-700"/>
                 </div>
                 <div>
                    <p className="text-3xl font-black">{stats.lowStockItems}</p>
                    <p className="text-[10px] font-black uppercase text-red-500">Low Stock Items</p>
                 </div>
              </Link>

              <div className="md:col-span-2 bg-slate-900 border border-white/5 p-8 rounded-[40px] flex items-center justify-between shadow-2xl">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-500"><Users size={32}/></div>
                    <div>
                       <p className="text-2xl font-black">{stats.fleetCompliance}%</p>
                       <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Fleet Cert Compliance</p>
                    </div>
                 </div>
                 <div className="hidden md:block w-48 bg-white/5 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full" style={{ width: '85%' }}></div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
