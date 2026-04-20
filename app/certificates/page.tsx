'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileCheck, Clock, Upload, ChevronRight, Eye, ShieldCheck, RefreshCcw, AlertTriangle, Search, Filter } from 'lucide-react'

function CertificatesContent() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // 🎯 Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterExp, setFilterExp] = useState('all') // all, missing, 180, 90, 60, 30, 7, expired

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    
    async function fetchData() {
      const { data: m } = await supabase.from('cert_matrix').select('*').ilike('position', u.position)
      const { data: c } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
      const { data: r } = await supabase.from('cert_rules').select('*')
      if (m) setMatrix(m); if (c) setMyCerts(c); if (r) setRules(r);
      setLoading(false)
    }
    fetchData()
  }, [router])

  const certStatusList = useMemo(() => {
    if (!user || !matrix.length) return []
    let required = matrix.filter(row => row.requirement_type === 'P').map(row => ({ ...row, is_mandatory: true }))
    
    const optional = matrix.filter(row => row.requirement_type === 'O')
    optional.forEach(oc => { if (myCerts.some(c => c.cert_name === oc.cert_name)) required.push({ ...oc, is_mandatory: false }) })

    rules.forEach(rule => {
      if (myCerts.some(c => c.cert_name === rule.trigger_cert)) {
        if (!required.some(req => req.cert_name === rule.required_cert)) {
          required.push({ cert_name: rule.required_cert, is_mandatory: true, category: 'Triggered' })
        }
      }
    })

    const today = new Date()
    return required.map(req => {
      const uploaded = myCerts.find(c => c.cert_name === req.cert_name)
      let status = 'missing'
      let daysLeft = -1
      
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
    }).filter(item => {
      // 🎯 Apply Filters
      if (searchTerm && !item.cert_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterExp === 'missing' && item.status !== 'missing') return false;
      if (filterExp === 'expired' && item.status !== 'expired') return false;
      if (filterExp === '7' && (item.daysLeft > 7 || item.daysLeft < 0)) return false;
      if (filterExp === '30' && (item.daysLeft > 30 || item.daysLeft < 0)) return false;
      if (filterExp === '60' && (item.daysLeft > 60 || item.daysLeft < 0)) return false;
      if (filterExp === '90' && (item.daysLeft > 90 || item.daysLeft < 0)) return false;
      if (filterExp === '180' && (item.daysLeft > 180 || item.daysLeft < 0)) return false;
      return true;
    }).sort((a, b) => a.daysLeft - b.daysLeft)
  }, [user, matrix, myCerts, rules, searchTerm, filterExp])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">VAULT ACCESSING...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-8">
         <h1 className="text-3xl font-black italic flex items-center gap-3"><ShieldCheck className="text-blue-500" size={32}/> Certificates</h1>
         <p className="text-slate-500 tracking-widest mt-2 uppercase">Compliance Records for {user?.full_name}</p>
      </div>

      {/* 🎯 Advanced Filtering Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-slate-900/50 p-4 rounded-[28px] border border-white/5">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
          <input type="text" placeholder="Search certificates..." className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-blue-500" onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
          <select className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none appearance-none" value={filterExp} onChange={(e) => setFilterExp(e.target.value)}>
            <option value="all">All Status</option>
            <option value="missing">Missing Certs</option>
            <option value="expired">Expired</option>
            <option value="7">Expires in 7 Days</option>
            <option value="30">Expires in 30 Days</option>
            <option value="60">Expires in 60 Days</option>
            <option value="90">Expires in 90 Days</option>
            <option value="180">Expires in 180 Days</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {certStatusList.length === 0 && (
          <div className="py-20 text-center bg-slate-900/50 border border-dashed border-white/10 rounded-[32px] space-y-4">
             <AlertTriangle className="mx-auto text-slate-700" size={48}/>
             <p className="text-slate-500">No certificates match your filter.</p>
          </div>
        )}
        {certStatusList.map((item, idx) => (
          <div key={idx} className={`bg-slate-900 border ${item.status === 'missing' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between transition-all hover:border-blue-500/30`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
                {item.status === 'missing' ? <Clock size={22}/> : <FileCheck size={22}/>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{item.category}</p>
                  {item.daysLeft > 0 && item.daysLeft <= 180 && <span className={`px-2 py-0.5 rounded-md text-[7px] ${item.daysLeft <= 30 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{item.daysLeft} Days Left</span>}
                </div>
                <h3 className="text-white text-sm leading-tight uppercase">{item.cert_name}</h3>
                {item.uploaded && <p className={`text-[9px] mt-1 ${item.status === 'expired' ? 'text-red-500' : 'text-blue-500'}`}>Exp: {item.uploaded.expiry_date === '2099-12-31' ? 'Indefinite' : item.uploaded.expiry_date}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {item.uploaded ? (
                <>
                  <a href={item.uploaded.file_url} target="_blank" className="p-2.5 bg-white/5 text-slate-400 rounded-xl hover:text-white transition-all border border-white/5"><Eye size={16}/></a>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="p-2.5 bg-blue-600/10 text-blue-500 rounded-xl border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all"><RefreshCcw size={16}/></button>
                </>
              ) : (
                <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[9px] shadow-lg shadow-blue-600/20 active:scale-95">Upload</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CertificatesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CertificatesContent />
    </Suspense>
  )
}
