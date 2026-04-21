'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileCheck, Clock, ChevronRight, Eye, ShieldCheck, RefreshCcw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function CertificatesContent() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, ok, warning, expired, missing

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    
    async function fetchData() {
      const { data: m } = await supabase.from('cert_matrix').select('*')
      const { data: c } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
      const { data: r } = await supabase.from('cert_rules').select('*')
      if (m) setMatrix(m); if (c) setMyCerts(c); if (r) setRules(r);
      setLoading(false)
    }
    fetchData()
  }, [router])

  const certList = useMemo(() => {
    if (!user || !matrix.length) return []
    const userPosNorm = normalize(user.position);
    
    let required = matrix.filter(row => {
      const colKey = Object.keys(row).find(k => normalize(k) === userPosNorm);
      return colKey && String(row[colKey]).toUpperCase() === 'P';
    }).map(m => ({ ...m, is_mandatory: true }))

    const optionals = matrix.filter(row => {
      const colKey = Object.keys(row).find(k => normalize(k) === userPosNorm);
      return colKey && String(row[colKey]).toUpperCase() === 'O';
    })
    
    optionals.forEach(oc => {
       if (myCerts.some(c => normalize(c.cert_name) === normalize(oc.cert_name))) {
          required.push({ ...oc, is_mandatory: false })
       }
    })

    rules.forEach(rule => {
      if (myCerts.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))) {
        if (!required.some(req => normalize(req.cert_name) === normalize(rule.required_cert))) {
          required.push({ cert_name: rule.required_cert, is_mandatory: true, category: 'Additional' })
        }
      }
    })

    const today = new Date()
    return required.map(req => {
      const uploaded = myCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name))
      let status = 'missing'; let daysLeft = -1;
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; daysLeft = 9999; }
        else {
          const expDate = new Date(uploaded.expiry_date)
          daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / 86400000)
          if (daysLeft <= 0) status = 'expired'
          else if (daysLeft <= 90) status = 'warning'
          else status = 'ok'
        }
      }
      return { ...req, uploaded, status, daysLeft }
    }).sort((a, b) => {
       const statWeight: any = { expired: 1, missing: 2, warning: 3, ok: 4 };
       return statWeight[a.status] - statWeight[b.status];
    })
  }, [user, matrix, myCerts, rules])

  // คำนวณสถิติ
  const stats = useMemo(() => {
     return {
        total: certList.length,
        ok: certList.filter(c => c.status === 'ok').length,
        warning: certList.filter(c => c.status === 'warning').length,
        expired: certList.filter(c => c.status === 'expired').length,
        missing: certList.filter(c => c.status === 'missing').length,
     }
  }, [certList])

  // กรองข้อมูล
  const filteredList = certList.filter(c => filter === 'all' ? true : c.status === filter)

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">VAULT ACCESSING...</div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-8"><h1 className="text-3xl font-black italic flex items-center gap-3"><ShieldCheck className="text-blue-500" size={32}/> Certificates</h1><p className="text-slate-500 tracking-widest mt-2 uppercase">Compliance Records</p></div>

      {/* 🎯 Mini Dashboard (Filters) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
         <button onClick={() => setFilter('all')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'all' ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-white/5'}`}>
            <span className="text-2xl font-black">{stats.total}</span><span>ALL CERTS</span>
         </button>
         <button onClick={() => setFilter('ok')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'ok' ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'}`}>
            <span className="text-2xl font-black">{stats.ok}</span><span>READY</span>
         </button>
         <button onClick={() => setFilter('warning')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'warning' ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20' : 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20'}`}>
            <span className="text-2xl font-black">{stats.warning}</span><span>90 DAYS</span>
         </button>
         <button onClick={() => setFilter('expired')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'expired' ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20' : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'}`}>
            <span className="text-2xl font-black">{stats.expired}</span><span>EXPIRED</span>
         </button>
         <button onClick={() => setFilter('missing')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'missing' ? 'bg-slate-700 border-slate-500 text-white shadow-lg' : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'}`}>
            <span className="text-2xl font-black">{stats.missing}</span><span>MISSING</span>
         </button>
      </div>

      <div className="space-y-3">
        {filteredList.length === 0 && (
          <div className="py-20 text-center bg-slate-900/50 border border-dashed border-white/10 rounded-[32px] space-y-4"><AlertTriangle className="mx-auto text-slate-700" size={48}/><p className="text-slate-500">No certificates found in this category.</p></div>
        )}
        {filteredList.map((item, idx) => (
          <div key={idx} className={`bg-slate-900 border ${item.status === 'missing' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between transition-all hover:border-blue-500/30`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
                {item.status === 'missing' ? <Clock size={22}/> : item.status === 'expired' ? <XCircle size={22}/> : <FileCheck size={22}/>}
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-600 mb-1">{item.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}</p>
                <h3 className="text-white text-sm leading-tight uppercase">{item.cert_name}</h3>
                {item.uploaded && <p className={`text-[9px] mt-1 ${item.status === 'expired' ? 'text-red-500' : item.status === 'warning' ? 'text-amber-500' : 'text-blue-500'}`}>Exp: {item.uploaded.expiry_date === '2099-12-31' ? 'Indefinite' : item.uploaded.expiry_date}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {item.uploaded ? (
                <>
                  <a href={item.uploaded.file_url} target="_blank" className="p-2.5 bg-white/5 text-slate-400 rounded-xl hover:text-white transition-all"><Eye size={16}/></a>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="p-2.5 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><RefreshCcw size={16}/></button>
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
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
