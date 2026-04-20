'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User, FileBadge, ChevronRight, ShieldCheck, Clock, PlusCircle, History } from 'lucide-react'
import Link from 'next/link'

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({ progress: 0, expired: 0, suit: 0, boot: 0, lastStatus: 'None' })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) {
      const u = JSON.parse(uStr)
      setUser(u)
      fetchPersonalStats(u)
    }
  }, [router])

  async function fetchPersonalStats(u: any) {
    // 🎯 ดึงเฉพาะ Matrix ของตัวเอง
    const { data: matrix } = await supabase.from('cert_matrix').select('*').ilike('position', u.position)
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).order('created_at', { ascending: false })

    let progress = 0; let expired = 0; let suit = 0; let boot = 0;
    
    if (matrix && myCerts) {
      const required = matrix.filter(m => m.requirement_type === 'P')
      const okCerts = myCerts.filter(c => new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31').length
      expired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      progress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }

    myReqs?.filter(r => r.status !== 'rejected').forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    setStats({ progress, expired, suit, boot, lastStatus: myReqs?.[0]?.status || 'None' })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">CREW HUB LOADING...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10"><h1 className="text-3xl font-black italic leading-none">My Dashboard</h1><p className="text-slate-500 mt-2">Personal Compliance Hub</p></div>
      <div className="space-y-6">
        <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl flex items-center justify-between hover:border-blue-500 transition-all">
          <div className="flex items-center gap-8">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (stats.progress/100)*276} className="text-blue-500 transition-all duration-1000"/></svg>
              <span className="absolute text-xl font-black">{stats.progress}%</span>
            </div>
            <div><h3 className="text-lg font-black italic">My Readiness</h3><p className="text-slate-500 mt-1">Status: <span className={stats.expired > 0 ? 'text-red-500' : 'text-emerald-500'}>{stats.expired > 0 ? 'Action Required' : 'Ready'}</span></p></div>
          </div>
          {stats.expired > 0 && <div className="hidden md:block bg-red-500/20 text-red-500 px-4 py-2 rounded-2xl animate-pulse">⚠️ {stats.expired} Expired</div>}
          <ChevronRight className="text-slate-700 md:hidden"/>
        </Link>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between shadow-xl">
             <div className="flex justify-between items-center"><p className="text-slate-500">PPE Usage</p><ShieldCheck className="text-emerald-500" size={20}/></div>
             <div className="grid grid-cols-2 gap-2 my-4">
                <div className="text-center bg-black/30 p-2 rounded-xl border border-white/5"><p className="text-[7px] text-slate-600">SUIT</p><p className="text-sm font-black">{stats.suit}/2</p></div>
                <div className="text-center bg-black/30 p-2 rounded-xl border border-white/5"><p className="text-[7px] text-slate-600">BOOTS</p><p className="text-sm font-black">{stats.boot}/1</p></div>
             </div>
             <Link href="/ppe" className="text-emerald-400 flex items-center gap-1 hover:underline">Request New <ChevronRight size={12}/></Link>
          </div>
          <Link href="/my-requests" className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between h-44 shadow-xl hover:border-blue-500 transition-all">
            <Clock className="text-blue-500" size={32}/>
            <div><p className="text-xs uppercase">Last Request</p><p className="text-lg font-black text-blue-400">{stats.lastStatus}</p></div>
          </Link>
        </div>
      </div>
    </div>
  )
}
