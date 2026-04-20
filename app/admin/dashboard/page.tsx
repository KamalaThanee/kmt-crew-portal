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
    pendingPPE: 0, lowStock: 0, totalInventory: 0, lastRestock: 'No data', fleetCompliance: 0, fleetExpired: 0
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
    // 1. Personal Stats
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected')
    
    let progress = 0; let myExpired = 0; let suit = 0; let boot = 0;
    if (matrix && myCerts) {
      const posKey = u.position ? u.position.trim().toLowerCase() : "";
      const required = matrix.filter(row => {
        const colKey = Object.keys(row).find(k => k.trim().toLowerCase() === posKey);
        return colKey && String(row[colKey]).toUpperCase() === 'P';
      })
      const okCerts = myCerts.filter(c => new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31').length
      myExpired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      progress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }

    myReqs?.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    // 2. Fleet Overview
    const { count: pending } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    let totalQty = 0; let lowStockCount = 0;
    inventory?.forEach(i => {
      totalQty += (i.quantity || 0);
      if (i.quantity <= i.threshold) lowStockCount++;
    })

    const { data: restock } = await supabase.from('restock_history').select('created_at').order('created_at', { ascending: false }).limit(1)
    const lastRestock = restock && restock.length > 0 ? new Date(restock[0].created_at).toLocaleDateString('en-GB') : "N/A"

    const { data: allCerts } = await supabase.from('crew_certs').select('expiry_date')
    const fleetExpired = allCerts?.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length || 0

    const { count: crewCount } = await supabase.from('crews').select('*', { count: 'exact', head: true })
    const compliance = crewCount ? Math.min(100, Math.round(((allCerts?.length || 0) / (crewCount * 10)) * 100)) : 0

    setStats({ myCertProgress: progress, myExpired, suitQuota: suit, bootQuota: boot, pendingPPE: pending || 0, lowStock: lowStockCount, totalInventory: totalQty, lastRestock, fleetCompliance: compliance, fleetExpired })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING HUB...</div>

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10"><h1 className="text-3xl font-black italic leading-none">Command Center</h1><p className="text-slate-500 tracking-[0.2em] mt-2">Vessel Oversight & Personal Compliance</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- TRACK 1: MY PERSONAL --- */}
        <div className="space-y-6">
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

        {/* --- TRACK 2: FLEET OVERSIGHT (FULL RESOLUTION) --- */}
        <div className="lg:col-span-2 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-2"><ShieldCheck size={14}/> Vessel Oversight</h2>
           
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
              {/* 🎯 นำปุ่ม Restock กลับมา */}
              <Link href="/admin/restock" className="bg-slate-900 border border-emerald-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-emerald-500 transition-all">
                 <div className="flex justify-between items-start"><div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500"><Archive size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
                 <div><p className="text-lg font-black truncate">{stats.lastRestock}</p><p className="text-emerald-500 mt-1">Last Restock</p></div>
              </Link>
           </div>

           <Link href="/admin/settings?tab=crews" className="block bg-slate-900 border border-purple-500/20 p-8 rounded-[40px] shadow-2xl hover:border-purple-500 transition-all group">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-500 font-black text-xl">{stats.fleetCompliance}%</div>
                 <div className="flex-1">
                    <p className="text-lg font-black leading-none group-hover:text-purple-400 transition-colors">Fleet Cert Readiness</p>
                    <p className="text-slate-500 mt-1">Manage Crew Certificates & Profiles</p>
                 </div>
                 <div className="text-right hidden md:block">
                    <p className="text-red-500 text-xl font-black">{stats.fleetExpired}</p>
                    <p className="text-slate-600">Expired Certs</p>
                 </div>
              </div>
           </Link>
        </div>
      </div>
    </div>
  )
}
