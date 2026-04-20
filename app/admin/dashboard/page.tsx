'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  FileBadge, Users, User, AlertTriangle, ChevronRight, 
  CheckCircle2, ShieldCheck, Package, RefreshCw, Clock, Activity 
} from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [personal, setPersonal] = useState<any>({})
  const [vessel, setVessel] = useState<any>({})

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    setUser(u)
    fetchStats(u)
  }, [])

  async function fetchStats(u: any) {
    // --- 1. My Personal Data ---
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('status, items').eq('crew_id', u.id).order('created_at', { ascending: false }).limit(1)
    
    let progress = 0; let expired = 0; let warning = 0;
    if (matrix && myCerts) {
      const posKey = Object.keys(matrix[0]).find(k => k.toLowerCase().trim() === u.position?.toLowerCase().trim())
      const required = matrix.filter(m => colKey ? m[colKey] === 'P' : false)
      const okCerts = myCerts.filter(c => new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31').length
      expired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      warning = myCerts.filter(c => {
         const diff = (new Date(c.expiry_date).getTime() - new Date().getTime()) / 86400000
         return diff > 0 && diff <= 90
      }).length
      progress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }
    setPersonal({ progress, expired, warning, lastStatus: myReqs?.[0]?.status || 'None' })

    // --- 2. My Vessel Data ---
    const { count: pending } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    const { data: allCerts } = await supabase.from('crew_certs').select('expiry_date')
    
    const lowStock = inventory?.filter(i => i.quantity <= i.threshold).length || 0
    const vesselExpired = allCerts?.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length || 0

    setVessel({ pending, lowStock, vesselExpired, compliance: 85 })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">HUB LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      
      {/* SECTION: MY PERSONAL */}
      <div className="mb-12">
         <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-6"><User size={16}/> My Personal Compliance</h2>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/certificates" className="md:col-span-2 bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl flex items-center justify-between hover:border-blue-500 transition-all">
               <div className="flex items-center gap-8">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (personal.progress/100)*276} className="text-blue-500 transition-all duration-1000"/></svg>
                    <span className="absolute text-xl font-black">{personal.progress}%</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black italic text-white leading-tight">My Readiness</h3>
                    <p className="text-slate-500 mt-1">Status: <span className={personal.expired > 0 ? 'text-red-500' : 'text-emerald-500'}>{personal.expired > 0 ? 'Action Required' : 'All Good'}</span></p>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="text-center"><p className="text-red-500 text-lg">{personal.expired}</p><p className="text-[8px] text-slate-600">Expired</p></div>
                  <div className="text-center"><p className="text-amber-500 text-lg">{personal.warning}</p><p className="text-[8px] text-slate-600">Soon</p></div>
               </div>
            </Link>
            <div className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between">
               <p className="text-slate-500">My Last PPE Request</p>
               <div className="py-2"><span className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[9px]">{personal.lastStatus}</span></div>
               <Link href="/ppe" className="text-blue-400 flex items-center gap-1 hover:underline">New Request <ChevronRight size={14}/></Link>
            </div>
         </div>
      </div>

      {/* SECTION: MY VESSEL (ADMIN ONLY) */}
      <div>
         <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-6"><ShieldCheck size={16}/> My Vessel Oversight</h2>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/20 p-6 rounded-[32px] hover:border-amber-500 transition-all">
               <p className="text-amber-500 mb-4"><Clock size={24}/></p>
               <p className="text-3xl font-black">{vessel.pending}</p>
               <p className="text-slate-600 mt-1">Pending Approvals</p>
            </Link>
            <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/20 p-6 rounded-[32px] hover:border-red-500 transition-all">
               <p className="text-red-500 mb-4"><AlertTriangle size={24}/></p>
               <p className="text-3xl font-black">{vessel.lowStock}</p>
               <p className="text-slate-600 mt-1">Low Stock Alerts</p>
            </Link>
            <div className="bg-slate-900 border border-purple-500/20 p-6 rounded-[32px] col-span-2 flex items-center justify-between">
               <div>
                  <p className="text-purple-500 mb-4"><Activity size={24}/></p>
                  <p className="text-3xl font-black">{vessel.compliance}%</p>
                  <p className="text-slate-600 mt-1">Vessel Compliance</p>
               </div>
               <div className="text-right">
                  <p className="text-red-500 text-lg">{vessel.vesselExpired}</p>
                  <p className="text-slate-600">Crew Certs Expired</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
