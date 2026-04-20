'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileBadge, ShieldCheck, PlusCircle, History, Clock, CheckCircle2, AlertTriangle, ChevronRight, Package } from 'lucide-react'
import Link from 'next/link'

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [personalStats, setPersonalStats] = useState({
    certProgress: 0,
    expiredCerts: 0,
    suitQuota: 0,
    bootQuota: 0,
    lastRequestStatus: 'No Request'
  })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    fetchData(u)
  }, [])

  async function fetchData(u: any) {
    // 1. คำนวณ Cert Progress
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    
    let progress = 0; let expired = 0;
    if (matrix && myCerts) {
      const required = matrix.filter(m => m[u.position] === 'P')
      const okCerts = myCerts.filter(c => new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31').length
      expired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      progress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }

    // 2. คำนวณ PPE Quota & Last Status
    const currentYear = new Date().getFullYear()
    const { data: reqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).gte('created_at', `${currentYear}-01-01`)
    
    let suitCount = 0; let bootCount = 0; let lastStatus = 'No data';
    if (reqs && reqs.length > 0) {
      lastStatus = reqs[0].status
      reqs.forEach(r => {
        if (r.status !== 'rejected') {
          r.items?.forEach((i: any) => {
            if (i.item_name.toLowerCase().includes('suit')) suitCount++
            if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bootCount++
          })
        }
      })
    }

    setPersonalStats({
      certProgress: progress,
      expiredCerts: expired,
      suitQuota: suitCount,
      bootQuota: bootCount,
      lastRequestStatus: lastStatus
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">Accessing Portal...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white">
      <div className="mb-10">
        <h1 className="text-3xl font-black uppercase italic leading-none">My Dashboard</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Welcome back, {user?.full_name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* --- My Certificate Status --- */}
        <Link href="/certificates" className="bg-slate-900 border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6 hover:border-blue-500 transition-all group">
          <div className="flex justify-between items-start">
             <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500"><FileBadge size={28}/></div>
             <div className="text-right">
                <p className="text-3xl font-black">{personalStats.certProgress}%</p>
                <p className="text-[10px] font-black uppercase text-slate-500">Readiness</p>
             </div>
          </div>
          <div className="space-y-2">
             <p className="text-sm font-bold uppercase italic">Certificate Compliance</p>
             <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${personalStats.certProgress}%` }}></div>
             </div>
             {personalStats.expiredCerts > 0 && <p className="text-[10px] font-black text-red-500 animate-pulse uppercase">⚠️ {personalStats.expiredCerts} Expired Documents</p>}
          </div>
        </Link>

        {/* --- My PPE Status --- */}
        <div className="bg-slate-900 border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6">
           <div className="flex justify-between items-center">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500"><ShieldCheck size={28}/></div>
              <div className="text-right">
                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                   personalStats.lastRequestStatus === 'pending' ? 'bg-amber-500 text-black' : 
                   personalStats.lastRequestStatus === 'approved' ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-500'
                 }`}>{personalStats.lastRequestStatus}</span>
              </div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Boiler Suit</p>
                 <p className="text-xl font-black">{personalStats.suitQuota} <span className="text-[10px] text-slate-600">/ 2</span></p>
              </div>
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Safety Boots</p>
                 <p className="text-xl font-black">{personalStats.bootQuota} <span className="text-[10px] text-slate-600">/ 1</span></p>
              </div>
           </div>
           <Link href="/ppe" className="block w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest transition-all">Request New PPE</Link>
        </div>
      </div>
    </div>
  )
}
