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
  const [personal, setPersonal] = useState<any>({ progress: 0, expired: 0, warning: 0, suit: 0, boot: 0, lastStatus: 'None' })
  const [vessel, setVessel] = useState<any>({ pending: 0, lowStock: 0, vesselExpired: 0, compliance: 0 })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) {
      const u = JSON.parse(uStr)
      setUser(u)
      fetchStats(u)
    }
  }, [])

  async function fetchStats(u: any) {
    // --- 1. My Personal Data ---
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).order('created_at', { ascending: false })
    
    let progress = 0; let expired = 0; let warning = 0; let suit = 0; let boot = 0;
    
    if (matrix && matrix.length > 0 && myCerts) {
      const posKey = Object.keys(matrix[0]).find(k => k.toLowerCase().trim() === u.position?.toLowerCase().trim())
      const required = matrix.filter(m => posKey ? m[posKey] === 'P' : false)
      const okCerts = myCerts.filter(c => new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31').length
      expired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      warning = myCerts.filter(c => {
         const diff = (new Date(c.expiry_date).getTime() - new Date().getTime()) / 86400000
         return diff > 0 && diff <= 90
      }).length
      progress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }

    // คำนวณโควต้า PPE ส่วนตัว
    myReqs?.filter(r => r.status !== 'rejected').forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    setPersonal({ progress, expired, warning, suit, boot, lastStatus: myReqs?.[0]?.status || 'No Request' })

    // --- 2. My Vessel Data ---
    const { count: pending } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold')
    const { data: allCerts } = await supabase.from('crew_certs').select('expiry_date')
    
    const lowStock = inventory?.filter(i => i.quantity <= i.threshold).length || 0
    const vesselExpired = allCerts?.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length || 0

    setVessel({ pending, lowStock, vesselExpired, compliance: 85 })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">ADMIN PORTAL LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32 pt-2 md:pt-6 font-sans text-white uppercase font-bold text-[10px]">
      
      {/* SECTION: MY PERSONAL STATUS */}
      <div className="mb-12">
         <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-6"><User size={16}/> My Personal Status</h2>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cert Card */}
            <Link href="/certificates" className="md:col-span-2 bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl flex items-center justify-between hover:border-blue-500 transition-all">
               <div className="flex items-center gap-8">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (personal.progress/100)*276} className="text-blue-500 transition-all duration-1000"/></svg>
                    <span className="absolute text-xl font-black">{personal.progress}%</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black italic">My Certificates</h3>
                    <p className="text-slate-500 mt-1">Status: <span className={personal.expired > 0 ? 'text-red-500' : 'text-emerald-500'}>{personal.expired > 0 ? 'Action Required' : 'Ready'}</span></p>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="text-center"><p className="text-red-500 text-lg">{personal.expired}</p><p className="text-[8px] text-slate-600 uppercase">Expired</p></div>
                  <div className="text-center"><p className="text-amber-500 text-lg">{personal.warning}</p><p className="text-[8px] text-slate-600 uppercase">Soon</p></div>
               </div>
            </Link>

            {/* PPE Quota & Last Status */}
            <div className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between space-y-4">
               <div className="flex justify-between items-center">
                  <p className="text-slate-500">PPE Status</p>
                  <span className="px-3 py-1 bg-blue-600 text-[8px] rounded-full">{personal.lastStatus}</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                     <p className="text-[7px] text-slate-500 mb-1">BOILER SUIT</p>
                     <p className="text-sm font-black">{personal.suit}/2</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                     <p className="text-[7px] text-slate-500 mb-1">BOOTS</p>
                     <p className="text-sm font-black">{personal.boot}/1</p>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* SECTION: MY VESSEL OVERSIGHT (ADMIN ONLY) */}
      <div>
         <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-6"><ShieldCheck size={16}/> My Vessel Oversight</h2>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/20 p-6 rounded-[32px] hover:border-amber-500 transition-all flex flex-col justify-between h-44">
               <Clock className="text-amber-500" size={24}/>
               <div><p className="text-4xl font-black">{vessel.pending}</p><p className="text-slate-600 mt-1 uppercase">Pending Approvals</p></div>
            </Link>
            <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/20 p-6 rounded-[32px] hover:border-red-500 transition-all flex flex-col justify-between h-44">
               <AlertTriangle className="text-red-500" size={24}/>
               <div><p className="text-4xl font-black">{vessel.lowStock}</p><p className="text-slate-600 mt-1 uppercase">Low Stock Alerts</p></div>
            </Link>
            <div className="bg-slate-900 border border-purple-500/20 p-8 rounded-[40px] col-span-2 flex items-center justify-between shadow-2xl">
               <div>
                  <Activity className="text-purple-500 mb-4" size={24}/>
                  <p className="text-3xl font-black">{vessel.compliance}%</p>
                  <p className="text-slate-600 mt-1 uppercase">Vessel Compliance</p>
               </div>
               <div className="text-right">
                  <p className="text-red-500 text-xl font-black">{vessel.vesselExpired}</p>
                  <p className="text-slate-600 uppercase">Certs Expired</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
