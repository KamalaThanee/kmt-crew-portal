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
  const [personal, setPersonal] = useState<any>({ progress: 0, expired: 0, suit: 0, boot: 0, lastStatus: 'None' })
  const [vessel, setVessel] = useState<any>({ pending: 0, lowStock: 0, totalItems: 0, fleetCompliance: 0, fleetExpired: 0 })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) { const u = JSON.parse(uStr); setUser(u); fetchStats(u); }
  }, [])

  async function fetchStats(u: any) {
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: crews } = await supabase.from('crews').select('*')
    const { data: allCerts } = await supabase.from('crew_certs').select('*')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    const { count: pending } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')

    // --- My Personal ---
    const myCerts = allCerts?.filter(c => c.crew_id === u.id) || []
    const myRequired = matrix?.filter(m => normalize(m.position) === normalize(u.position) && m.requirement_type === 'P') || []
    const myOk = myRequired.filter(req => myCerts.some(c => normalize(c.cert_name) === normalize(req.cert_name) && (new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31'))).length
    const myExpired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
    
    // --- Fleet Oversight ---
    let totalReq = 0; let totalOk = 0;
    crews?.forEach(c => {
      const cReq = matrix?.filter(m => normalize(m.position) === normalize(c.position) && m.requirement_type === 'P') || []
      const cCerts = allCerts?.filter(cc => cc.crew_id === c.id) || []
      totalReq += cReq.length
      totalOk += cReq.filter(req => cCerts.some(cc => normalize(cc.cert_name) === normalize(req.cert_name) && (new Date(cc.expiry_date) >= new Date() || cc.expiry_date === '2099-12-31'))).length
    })

    setPersonal({ progress: myRequired.length > 0 ? Math.round((myOk/myRequired.length)*100) : 0, expired: myExpired })
    setVessel({
      pending: pending || 0,
      lowStock: inventory?.filter(i => i.quantity <= i.threshold).length || 0,
      totalItems: inventory?.reduce((a, b) => a + (b.quantity || 0), 0) || 0,
      fleetCompliance: totalReq > 0 ? Math.round((totalOk/totalReq)*100) : 0,
      fleetExpired: allCerts?.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length || 0
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING DASHBOARD...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-center">
        <div><h1 className="text-3xl font-black italic leading-none">Command Center</h1><p className="text-slate-500 tracking-widest mt-2 font-black uppercase text-[10px]">Vessel Operation Hub</p></div>
        <button onClick={() => window.location.reload()} className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* PERSONAL */}
        <div className="lg:col-span-1 space-y-6">
           <h2 className="text-blue-500 tracking-widest flex items-center gap-2"><User size={14}/> My Personal Status</h2>
           <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all">
              <div className="flex justify-between items-center mb-4"><FileBadge className="text-blue-500" size={32}/><span className="text-2xl font-black">{personal.progress}%</span>
</div>
<p className="text-blue-400 font-bold mb-4">{personal.okCount} / {personal.reqCount} Certs Valid</p></div>
              <p className="text-xs uppercase font-black">My Certificates</p>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden"><div className="bg-blue-500 h-full" style={{ width: `${personal.progress}%` }}></div></div>
              {personal.expired > 0 && <p className="mt-3 text-red-500 animate-pulse">⚠️ {personal.expired} Expired</p>}
           </Link>
        </div>

        {/* VESSEL OVERSIGHT */}
        <div className="lg:col-span-3 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2"><ShieldCheck size={14}/> Vessel Oversight</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-amber-500 transition-all">
                 <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500 w-fit"><Clock size={20}/></div>
                 <div><p className="text-2xl font-black">{vessel.pending}</p><p className="text-amber-500 uppercase text-[9px]">Pending Req</p></div>
              </Link>
              <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-red-500 transition-all">
                 <div className="bg-red-500/20 p-2.5 rounded-xl text-red-500 w-fit"><AlertTriangle size={20}/></div>
                 <div><p className="text-2xl font-black">{vessel.lowStock}</p><p className="text-red-500 uppercase text-[9px]">Low Stock</p></div>
              </Link>
              <Link href="/admin/inventory" className="bg-slate-900 border border-blue-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-blue-500 transition-all">
                 <div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500 w-fit"><Box size={20}/></div>
                 <div><p className="text-2xl font-black">{vessel.totalItems}</p><p className="text-blue-500 uppercase text-[9px]">Total Items</p></div>
              </Link>
              <Link href="/admin/restock" className="bg-slate-900 border border-emerald-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-emerald-500 transition-all">
                 <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500 w-fit"><Archive size={20}/></div>
                 <div><p className="text-lg font-black truncate">RESTOCK</p><p className="text-emerald-500 uppercase text-[9px]">Inventory</p></div>
              </Link>

              {/* Compliance Box */}
              <Link href="/admin/settings?tab=crews" className="col-span-2 md:col-span-4 bg-slate-900 border border-purple-500/20 p-8 rounded-[40px] flex items-center justify-between shadow-2xl hover:border-purple-500 transition-all group">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-500 font-black text-xl border border-purple-500/20">{vessel.fleetCompliance}%</div>
                    <div>
                       <p className="text-lg font-black group-hover:text-purple-400 transition-colors">Fleet Cert Readiness</p>
                       <p className="text-slate-500 mt-1 uppercase text-[9px]">Manage Crew Certificates & Profiles</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-red-500 text-2xl font-black">{vessel.fleetExpired}</p>
                    <p className="text-slate-600 uppercase text-[8px]">Expired Certificates</p>
                 </div>
              </Link>
           </div>
        </div>
      </div>
    </div>
  )
}
