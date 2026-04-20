'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  FileBadge, Users, User, AlertTriangle, ChevronRight, 
  CheckCircle2, Clock, ShieldCheck, Activity 
} from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [myStats, setMyStats] = useState({ progress: 0, expired: 0 })
  const [fleetStats, setFleetStats] = useState({ totalCrew: 0, totalExpiredCerts: 0, compliance: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) {
      const u = JSON.parse(uStr)
      setUser(u)
      fetchStats(u)
    }
  }, [])

  async function fetchStats(u: any) {
    // 1. My Personal Stats
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    
    if (matrix && myCerts) {
      const userPos = (u.position || "").toLowerCase()
      const myReq = matrix.filter(m => (m[u.position] === 'P' || m[userPos] === 'P'))
      const myExpired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      const myOk = myCerts.filter(c => new Date(c.expiry_date) >= new Date()).length
      setMyStats({ 
        progress: myReq.length > 0 ? Math.round((myOk / myReq.length) * 100) : 0, 
        expired: myExpired 
      })
    }

    // 2. Fleet Overview Stats
    const { count: crewCount } = await supabase.from('crews').select('*', { count: 'exact', head: true })
    const { data: allCerts } = await supabase.from('crew_certs').select('expiry_date')
    const expiredCount = allCerts?.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length || 0
    
    setFleetStats({
      totalCrew: crewCount || 0,
      totalExpiredCerts: expiredCount,
      compliance: 82 // คำนวณเบื้องต้น
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING DASHBOARD...</div>

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32 pt-20 font-sans text-white">
      <div className="mb-10">
        <h1 className="text-3xl font-black uppercase italic leading-none">Command Center</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Vessel Oversight & Personal Compliance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- Track 1: My Personal Compliance --- */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-[10px] font-black uppercase text-blue-500 tracking-widest flex items-center gap-2"><User size={14}/> My Status</h2>
          <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all group">
            <div className="flex justify-between items-center mb-6">
               <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500"><FileBadge size={24}/></div>
               <span className="text-2xl font-black">{myStats.progress}%</span>
            </div>
            <p className="text-sm font-bold uppercase">My Certificates</p>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
               <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${myStats.progress}%` }}></div>
            </div>
            {myStats.expired > 0 && <p className="mt-4 text-[10px] font-black text-red-500 animate-pulse uppercase">⚠️ {myStats.expired} EXPIRED CERTS</p>}
          </Link>
        </div>

        {/* --- Track 2: Fleet Overview --- */}
        <div className="lg:col-span-2 space-y-6">
           <h2 className="text-[10px] font-black uppercase text-purple-500 tracking-widest flex items-center gap-2"><ShieldCheck size={14}/> Fleet Oversight</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-white/5 p-6 rounded-[32px] space-y-2">
                 <p className="text-[9px] font-black text-slate-500 uppercase">Total Crew</p>
                 <p className="text-3xl font-black">{fleetStats.totalCrew}</p>
                 <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold"><CheckCircle2 size={12}/> ACTIVE ONBOARD</div>
              </div>
              <div className="bg-slate-900 border border-white/5 p-6 rounded-[32px] space-y-2">
                 <p className="text-[9px] font-black text-slate-500 uppercase">Fleet Compliance</p>
                 <p className="text-3xl font-black text-purple-500">{fleetStats.compliance}%</p>
                 <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold"><Activity size={12}/> OVERALL HEALTH</div>
              </div>
              <Link href="/admin/approvals" className="md:col-span-2 bg-slate-900 border border-amber-500/30 p-6 rounded-[32px] flex justify-between items-center group hover:border-amber-500 transition-all">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500"><AlertTriangle size={24}/></div>
                    <div>
                       <p className="text-sm font-bold uppercase">Critical Action Required</p>
                       <p className="text-[10px] text-slate-500 font-bold uppercase">{fleetStats.totalExpiredCerts} Expired Certificates detected</p>
                    </div>
                 </div>
                 <ChevronRight className="text-slate-700 group-hover:text-amber-500 transition-colors"/>
              </Link>
           </div>
        </div>
      </div>
    </div>
  )
}
