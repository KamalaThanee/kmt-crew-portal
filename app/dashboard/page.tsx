'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isNoExpiryDate } from '@/lib/certificates'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import { User, FileBadge, ChevronRight, ShieldCheck, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import Link from 'next/link'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({ progress: 0, ok: 0, warn: 0, exp: 0, miss: 0, total: 0, suit: 0, boot: 0, lastStatus: 'None' })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr); setUser(u); fetchStats(u);
  }, [router])

  async function fetchStats(u: any) {
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const reqQuery = await applyPpeRequestUserFilter(
      supabase.from('ppe_requests')
        .select('*')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false }),
      u,
    )
    const { data: myReqs } = await reqQuery
    
    if (matrix && myCerts) {
      const uPos = normalize(u.position);
      const required = matrix.filter(m => normalize(m.position) === uPos && m.requirement_type === 'P')
      const today = new Date();
      let ok = 0, warn = 0, exp = 0;

      required.forEach(req => {
        const c = myCerts.find(mc => normalize(mc.cert_name) === normalize(req.cert_name))
        if (c) {
          if (isNoExpiryDate(c.expiry_date)) ok++;
          else {
            const d = (new Date(c.expiry_date).getTime() - today.getTime()) / 86400000;
            if (d < 0) exp++; else if (d <= 90) warn++; else ok++;
          }
        }
      })

      let sCount = 0, bCount = 0;
      myReqs?.forEach(r => {
        r.items?.forEach((i: any) => {
          if (i.item_name.toLowerCase().includes('suit')) sCount++
          if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bCount++
        })
      })

      setStats({
        total: required.length, ok, warn, exp, miss: required.length - (ok + warn + exp),
        progress: required.length > 0 ? Math.round(((ok + warn) / required.length) * 100) : 0,
        suit: sCount, boot: bCount, lastStatus: myReqs?.[0]?.status || 'No Request'
      })
    }
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10"><h1 className="text-3xl font-black italic">My Dashboard</h1></div>
      
      <div className="space-y-6">
        <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl hover:border-blue-500 transition-all group">
          <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (stats.progress/100)*276} className="text-blue-500 transition-all duration-1000"/></svg>
              <span className="absolute text-xl font-black">{stats.progress}%</span>
            </div>
            <div className="text-center md:text-left flex-1">
              <h3 className="text-xl font-black italic">My Certificates</h3>
              <p className="text-blue-400 mt-1 mb-4">{stats.ok + stats.warn} / {stats.total} Valid Documents</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-center"><p className="text-emerald-500 text-sm">{stats.ok}</p><p className="text-[7px]">READY</p></div>
                 <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl text-center"><p className="text-amber-500 text-sm">{stats.warn}</p><p className="text-[7px]">90 DAYS</p></div>
                 <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-xl text-center"><p className="text-red-500 text-sm">{stats.exp}</p><p className="text-[7px]">EXPIRED</p></div>
                 <div className="bg-white/5 p-2 rounded-xl text-center text-slate-500"><p className="text-sm">{stats.miss}</p><p className="text-[7px]">MISSING</p></div>
              </div>
            </div>
          </div>
          <p className="text-right text-blue-400">Manage Certificates <ChevronRight size={14} className="inline"/></p>
        </Link>

        <div className="grid grid-cols-2 gap-6">
          <Link href="/my-requests" className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between shadow-xl h-44 hover:border-emerald-500 transition-all">
             <div className="flex justify-between items-center"><p className="text-slate-500">PPE Usage</p><ShieldCheck className="text-emerald-500" size={20}/></div>
             <div className="grid grid-cols-2 gap-2 my-2">
                <div className="text-center"><p className="text-[7px] text-slate-600">SUIT</p><p className="text-sm font-black">{stats.suit}/2</p></div>
                <div className="text-center"><p className="text-[7px] text-slate-600">BOOTS</p><p className="text-sm font-black">{stats.boot}/1</p></div>
             </div>
             <p className="text-emerald-400">History & Status <ChevronRight size={12} className="inline"/></p>
          </Link>
          <div className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between shadow-xl h-44">
            <Clock className="text-blue-500" size={32}/>
            <div><p className="text-xs uppercase text-slate-500">Last Req. Status</p><p className="text-lg font-black text-blue-400">{stats.lastStatus}</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}
