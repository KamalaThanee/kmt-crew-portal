'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User, FileBadge, ChevronRight, ShieldCheck, Clock } from 'lucide-react'
import Link from 'next/link'

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    if (!u.id) { router.push('/login'); return; }
    setUser(u)
    fetchPersonalStats(u)
  }, [router])

  async function fetchPersonalStats(u: any) {
    const { data: matrix } = await supabase.from('cert_matrix').select('*')
    const { data: myCerts } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
    const { data: myReqs } = await supabase.from('ppe_requests').select('status').eq('crew_id', u.id).order('created_at', { ascending: false }).limit(1)

    if (matrix && myCerts) {
      const posKey = Object.keys(matrix[0]).find(k => k.toLowerCase().trim() === u.position?.toLowerCase().trim())
      const required = matrix.filter(m => posKey ? m[posKey] === 'P' : false)
      const okCerts = myCerts.filter(c => new Date(c.expiry_date) >= new Date() || c.expiry_date === '2099-12-31').length
      const expired = myCerts.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length
      const progress = required.length > 0 ? Math.round((okCerts / required.length) * 100) : 0
      setStats({ progress, expired, lastStatus: myReqs?.[0]?.status || 'None' })
    }
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">CREW HUB LOADING...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10"><h1 className="text-3xl font-black italic">My Dashboard</h1><p className="text-slate-500 mt-1">Personal Compliance Hub</p></div>
      <div className="space-y-6">
        <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl flex items-center justify-between hover:border-blue-500 transition-all">
          <div className="flex items-center gap-8">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (stats.progress/100)*276} className="text-blue-500 transition-all duration-1000"/></svg>
              <span className="absolute text-xl font-black">{stats.progress}%</span>
            </div>
            <div><h3 className="text-lg font-black italic">My Readiness</h3><p className="text-slate-500 mt-1">View Certificates <ChevronRight size={12} className="inline"/></p></div>
          </div>
          {stats.expired > 0 && <div className="bg-red-500/20 text-red-500 px-4 py-2 rounded-2xl animate-pulse">⚠️ {stats.expired} Expired</div>}
        </Link>
        <div className="grid grid-cols-2 gap-6">
          <Link href="/ppe" className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between h-44 hover:border-blue-500 transition-all">
            <ShieldCheck className="text-emerald-500" size={32}/><p className="text-sm">Request PPE</p><p className="text-slate-600">Status: {stats.lastStatus}</p>
          </Link>
          <Link href="/my-requests" className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between h-44 hover:border-blue-500 transition-all">
            <Clock className="text-blue-500" size={32}/><p className="text-sm">My History</p><p className="text-slate-600">View past requests</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
