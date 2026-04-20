'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileBadge, AlertCircle, ChevronRight, ShieldCheck, PlusCircle, History, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [certStats, setCertStats] = useState({ progress: 0, expiredCount: 0, missingCount: 0 })

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    if (!u.id) { router.push('/login'); return; }
    setUser(u)
    fetchDashboardData(u)
  }, [])

  async function fetchDashboardData(u: any) {
    // 1. ดึง Matrix และ Cert ของตัวเอง
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    
    if (matrix && myCerts) {
      const required = matrix.filter(m => m[u.position] === 'P')
      const totalReq = required.length
      const today = new Date()
      let expired = 0; let okCount = 0;

      required.forEach(req => {
        const uploaded = myCerts.find(c => c.cert_name === req.cert_name)
        if (uploaded) {
          const expDate = new Date(uploaded.expiry_date)
          if (expDate < today && uploaded.expiry_date !== '2099-12-31') expired++
          else okCount++
        }
      })

      setCertStats({
        progress: totalReq > 0 ? Math.round((okCount / totalReq) * 100) : 0,
        expiredCount: expired,
        missingCount: totalReq - (myCerts.length)
      })
    }
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">CREW PORTAL...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 pt-2 md:pt-6 font-sans">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black uppercase italic text-white tracking-tight">Crew Dashboard</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Status Overview for <span className="text-blue-400">{user?.full_name}</span></p>
        </div>
      </div>

      {/* 🎯 Certificate Status Tile */}
      <Link href="/certificates" className="block bg-slate-900 border border-white/10 rounded-[40px] p-8 mb-6 shadow-2xl relative overflow-hidden active:scale-[0.98] transition-all">
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative w-32 h-32 flex items-center justify-center">
             <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (certStats.progress / 100) * 364.4} className="text-blue-500 transition-all duration-1000" />
             </svg>
             <span className="absolute text-2xl font-black text-white">{certStats.progress}%</span>
          </div>
          <div className="text-center md:text-left">
             <h2 className="text-xl font-black uppercase italic text-white mb-2">Certificate Readiness</h2>
             <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <span className={`px-3 py-1.5 rounded-full text-[10px] font-black ${certStats.expiredCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-slate-400'}`}>{certStats.expiredCount} Expired</span>
                <span className="px-3 py-1.5 bg-white/5 text-slate-400 rounded-full text-[10px] font-black">{certStats.missingCount} Missing</span>
             </div>
             <p className="mt-4 text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">Manage All Certificates <ChevronRight size={14}/></p>
          </div>
        </div>
        <FileBadge size={120} className="absolute -top-4 -right-4 text-white opacity-[0.02]" />
      </Link>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/ppe" className="bg-slate-900 border border-emerald-500/20 p-6 rounded-[32px] space-y-4 hover:border-emerald-500 transition-all active:scale-95">
           <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500"><PlusCircle size={24}/></div>
           <p className="text-xs font-black uppercase text-white">Request PPE</p>
        </Link>
        <Link href="/my-requests" className="bg-slate-900 border border-blue-500/20 p-6 rounded-[32px] space-y-4 hover:border-blue-500 transition-all active:scale-95">
           <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500"><History size={24}/></div>
           <p className="text-xs font-black uppercase text-white">My History</p>
        </Link>
      </div>
    </div>
  )
}
