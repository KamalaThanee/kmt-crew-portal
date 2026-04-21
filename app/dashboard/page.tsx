'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User, FileBadge, ChevronRight, ShieldCheck, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({ progress: 0, okCount: 0, reqCount: 0, expired: 0, warning: 0, missing: 0, suit: 0, boot: 0, lastStatus: 'None' })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) {
      const u = JSON.parse(uStr)
      setUser(u)
      fetchPersonalStats(u)
    }
  }, [])

  async function fetchPersonalStats(u: any) {
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).neq('status', 'rejected').order('created_at', { ascending: false })
    
    let okCount = 0; let expired = 0; let warning = 0; let suit = 0; let boot = 0;
    const userPosNorm = normalize(u.position);
    
    const requiredRows = matrix?.filter(row => normalize(row.position) === userPosNorm && row.requirement_type === 'P') || [];
    const today = new Date()

    requiredRows.forEach(req => {
      const uploaded = myCerts?.find(c => normalize(c.cert_name) === normalize(req.cert_name))
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') okCount++;
        else {
          const expDate = new Date(uploaded.expiry_date)
          const diff = (expDate.getTime() - today.getTime()) / 86400000;
          if (diff < 0) expired++;
          else if (diff <= 90) { warning++; okCount++; }
          else okCount++;
        }
      }
    });

    myReqs?.forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    setStats({
      progress: requiredRows.length > 0 ? Math.round((okCount / requiredRows.length) * 100) : 0,
      okCount, reqCount: requiredRows.length, expired, warning,
      missing: requiredRows.length - okCount, suit, boot,
      lastStatus: myReqs?.[0]?.status || 'No Request'
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">HUB LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10"><h1 className="text-3xl font-black italic">My Dashboard</h1></div>
      
      <div className="space-y-6">
        <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl hover:border-blue-500 transition-all group">
          <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (stats.progress/100)*276} className="text-blue-500 transition-all duration-1000"/></svg>
              <span className="absolute text-xl font-black">{stats.progress}%</span>
            </div>
            <div className="text-center md:text-left w-full">
              <h3 className="text-xl font-black italic">My Certificates</h3>
              <p className="text-blue-400 mt-1 mb-4">{stats.okCount} / {stats.reqCount} Valid</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 <div className="bg-emerald-500/10 p-2 rounded-xl text-center"><p className="text-emerald-500 text-sm">{stats.okCount}</p><p className="text-[7px] text-emerald-500/50">OK</p></div>
                 <div className="bg-amber-500/10 p-2 rounded-xl text-center"><p className="text-amber-500 text-sm">{stats.warning}</p><p className="text-[7px] text-amber-500/50">90D</p></div>
                 <div className="bg-red-500/10 p-2 rounded-xl text-center"><p className="text-red-500 text-sm">{stats.expired}</p><p className="text-[7px] text-red-500/50">EXP</p></div>
                 <div className="bg-white/5 p-2 rounded-xl text-center"><p className="text-slate-400 text-sm">{stats.missing}</p><p className="text-[7px] text-slate-500">MISS</p></div>
              </div>
            </div>
          </div>
          <p className="text-right text-blue-400">View All Certificates <ChevronRight size={14} className="inline"/></p>
        </Link>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between shadow-xl h-44">
             <div className="flex justify-between items-center"><p className="text-slate-500">PPE Usage</p><ShieldCheck className="text-emerald-500" size={20}/></div>
             <div className="grid grid-cols-2 gap-2 my-2">
                <div className="text-center"><p className="text-[7px] text-slate-600">SUIT</p><p className="text-sm font-black">{stats.suit}/2</p></div>
                <div className="text-center"><p className="text-[7px] text-slate-600">BOOTS</p><p className="text-sm font-black">{stats.boot}/1</p></div>
             </div>
             <Link href="/ppe" className="text-blue-400 flex items-center gap-1">New Request <ChevronRight size={12}/></Link>
          </div>
          <Link href="/my-requests" className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between shadow-xl h-44 hover:border-blue-500 transition-all">
            <Clock className="text-blue-500" size={32}/>
            <div><p className="text-xs uppercase">Last Status</p><p className="text-lg font-black text-blue-400">{stats.lastStatus}</p></div>
          </Link>
        </div>
      </div>
    </div>
  )
}
