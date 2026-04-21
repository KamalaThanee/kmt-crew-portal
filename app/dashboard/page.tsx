'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User, FileBadge, ChevronRight, ShieldCheck, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import Link from 'next/link'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({ 
    progress: 0, okCount: 0, reqCount: 0, 
    expired: 0, warning: 0, missing: 0, 
    suit: 0, boot: 0, lastStatus: 'None' 
  })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    fetchPersonalStats(u)
  }, [router])

  async function fetchPersonalStats(u: any) {
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).order('created_at', { ascending: false })
    const { data: rules } = await supabase.from('cert_rules').select('*')

    let okCount = 0; let expired = 0; let warning = 0; let suit = 0; let boot = 0;
    
    if (matrix && myCerts) {
      const userPosNorm = normalize(u.position);
      
      // 1. หาใบที่ต้องมี (P)
      let required = matrix.filter(row => {
        const colKey = Object.keys(row).find(k => normalize(k) === userPosNorm);
        return colKey && String(row[colKey]).toUpperCase() === 'P';
      }).map(m => ({ cert_name: m.cert_name }));

      // 2. ถ้าอัปโหลดใบ O มา ให้นับรวมด้วย
      const optionals = matrix.filter(row => {
        const colKey = Object.keys(row).find(k => normalize(k) === userPosNorm);
        return colKey && String(row[colKey]).toUpperCase() === 'O';
      });
      optionals.forEach(oc => {
         if (myCerts.some(c => normalize(c.cert_name) === normalize(oc.cert_name))) {
            required.push({ cert_name: oc.cert_name })
         }
      })

      // 3. Trigger Rules (เช่น OHLO)
      rules?.forEach(rule => {
        if (myCerts.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))) {
          if (!required.some(req => normalize(req.cert_name) === normalize(rule.required_cert))) {
            required.push({ cert_name: rule.required_cert })
          }
        }
      })

      const today = new Date()
      required.forEach(req => {
        const uploaded = myCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name))
        if (uploaded) {
          if (uploaded.expiry_date === '2099-12-31') { okCount++; }
          else {
            const expDate = new Date(uploaded.expiry_date)
            const daysLeft = (expDate.getTime() - today.getTime()) / 86400000;
            if (daysLeft < 0) expired++;
            else if (daysLeft <= 90) { warning++; okCount++; }
            else okCount++;
          }
        }
      })
      const progress = required.length > 0 ? Math.round((okCount / required.length) * 100) : 0;
      const missing = required.length - (okCount + expired - warning); // คร่าวๆ

      myReqs?.filter(r => r.status !== 'rejected').forEach(r => {
        r.items?.forEach((i: any) => {
          if (i.item_name.toLowerCase().includes('suit')) suit++
          if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
        })
      })

      setStats({ progress, okCount, reqCount: required.length, expired, warning, missing: required.length - okCount, suit, boot, lastStatus: myReqs?.[0]?.status || 'None' })
    }
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">PORTAL LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10"><h1 className="text-3xl font-black italic leading-none">My Dashboard</h1><p className="text-slate-500 mt-2">Personal Compliance Hub</p></div>
      
      <div className="space-y-6">
        {/* 🎯 Cert Readiness Card (Added X/Y count and Stat chips) */}
        <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl hover:border-blue-500 transition-all group">
          <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90"><circle cx="56" cy="56" r="52" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5"/><circle cx="56" cy="56" r="52" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="326" strokeDashoffset={326 - (stats.progress/100)*326} className="text-blue-500 transition-all duration-1000"/></svg>
              <div className="absolute flex flex-col items-center">
                 <span className="text-2xl font-black leading-none">{stats.progress}%</span>
              </div>
            </div>
            <div className="text-center md:text-left w-full">
              <h3 className="text-xl font-black italic text-white">My Readiness</h3>
              <p className="text-blue-400 mt-1 mb-4">{stats.okCount} / {stats.reqCount} Certificates Valid</p>
              
              {/* 🎯 สถิติ 4 ช่องแบบที่คุณต้องการ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-center"><p className="text-emerald-500 text-lg leading-none">{stats.okCount}</p><p className="text-[8px] text-emerald-400/70 mt-1">OK</p></div>
                 <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl text-center"><p className="text-amber-500 text-lg leading-none">{stats.warning}</p><p className="text-[8px] text-amber-400/70 mt-1">90 DAYS</p></div>
                 <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-xl text-center"><p className="text-red-500 text-lg leading-none">{stats.expired}</p><p className="text-[8px] text-red-400/70 mt-1">EXPIRED</p></div>
                 <div className="bg-slate-800 border border-white/5 p-2 rounded-xl text-center"><p className="text-slate-400 text-lg leading-none">{stats.missing}</p><p className="text-[8px] text-slate-500 mt-1">MISSING</p></div>
              </div>
            </div>
          </div>
          <p className="text-slate-500 text-center md:text-right group-hover:text-blue-400 transition-colors flex items-center justify-center md:justify-end gap-1">Manage Certificates <ChevronRight size={14}/></p>
        </Link>

        {/* PPE Quota */}
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
