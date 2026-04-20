'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User, FileBadge, ChevronRight, ShieldCheck, Clock, PlusCircle, History, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [certList, setCertList] = useState<any[]>([])
  const [stats, setStats] = useState<any>({ progress: 0, missing: 0, suit: 0, boot: 0, lastStatus: 'None' })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    fetchPersonalStats(u)
  }, [router])

  async function fetchPersonalStats(u: any) {
    const { data: matrix } = await supabase.from('cert_matrix').select('*').ilike('position', u.position)
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).order('created_at', { ascending: false })

    let progress = 0; let missing = 0; let suit = 0; let boot = 0;
    
    if (matrix && myCerts) {
      const required = matrix.filter(m => m.requirement_type === 'P')
      const today = new Date()
      
      const mappedCerts = required.map(req => {
        const uploaded = myCerts.find(c => c.cert_name === req.cert_name)
        let daysLeft = -1
        let status = 'missing'
        if (uploaded) {
          if (uploaded.expiry_date === '2099-12-31') {
            status = 'ok'
            daysLeft = 9999
          } else {
            const expDate = new Date(uploaded.expiry_date)
            daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / 86400000)
            if (daysLeft <= 0) status = 'expired'
            else if (daysLeft <= 90) status = 'warning'
            else status = 'ok'
          }
        }
        return { ...req, uploaded, status, daysLeft }
      })
      setCertList(mappedCerts)

      const okCerts = mappedCerts.filter(c => c.status === 'ok' || c.status === 'warning').length
      missing = required.length - okCerts
      progress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
    }

    myReqs?.filter(r => r.status !== 'rejected').forEach(r => {
      r.items?.forEach((i: any) => {
        if (i.item_name.toLowerCase().includes('suit')) suit++
        if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) boot++
      })
    })

    setStats({ progress, missing, suit, boot, lastStatus: myReqs?.[0]?.status || 'None' })
    setLoading(false)
  }

  // แยกประเภท Alert
  const alerts = useMemo(() => {
    return certList.filter(c => c.status === 'expired' || c.status === 'warning').sort((a, b) => a.daysLeft - b.daysLeft)
  }, [certList])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">CREW HUB LOADING...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10"><h1 className="text-3xl font-black italic leading-none">My Dashboard</h1><p className="text-slate-500 mt-2">Personal Compliance Hub</p></div>
      
      <div className="space-y-6">
        {/* --- Cert Progress --- */}
        <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between hover:border-blue-500 transition-all gap-6">
          <div className="flex items-center gap-8 w-full md:w-auto">
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (stats.progress/100)*276} className="text-blue-500 transition-all duration-1000"/></svg>
              <span className="absolute text-xl font-black">{stats.progress}%</span>
            </div>
            <div>
              <h3 className="text-lg font-black italic">My Readiness</h3>
              <p className="text-slate-500 mt-1">Need {stats.missing} more to complete</p>
            </div>
          </div>
          
          <div className="w-full md:w-auto flex flex-col gap-2">
            {alerts.slice(0, 2).map((a, idx) => (
              <div key={idx} className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${a.status === 'expired' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                <AlertTriangle size={14}/>
                <span className="truncate max-w-[120px] md:max-w-[180px]">{a.cert_name}</span>
                <span className="ml-auto font-black">{a.status === 'expired' ? 'EXPIRED' : `${a.daysLeft}D`}</span>
              </div>
            ))}
            {alerts.length > 2 && <p className="text-slate-500 text-right">+ {alerts.length - 2} more alerts</p>}
          </div>
        </Link>

        {/* --- PPE Grid --- */}
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
