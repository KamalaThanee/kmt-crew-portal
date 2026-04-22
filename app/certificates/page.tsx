'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileCheck, Clock, ChevronRight, Eye, ShieldCheck, RefreshCcw, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function CertificatesContent() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr); setUser(u);
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
    const uPosNorm = normalize(user.position);
    
    let required = matrix.filter(row => normalize(row.position) === uPosNorm && row.requirement_type === 'P')
      .map(m => ({ ...m, is_mandatory: true }))

    const optionals = matrix.filter(row => normalize(row.position) === uPosNorm && row.requirement_type === 'O')
      .map(m => ({ ...m, is_mandatory: false }))

    rules.forEach(rule => {
      if (myCerts.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))) {
        if (!required.some(req => normalize(req.cert_name) === normalize(rule.required_cert))) {
           const certInfo = matrix.find(m => normalize(m.cert_name) === normalize(rule.required_cert))
           required.push({ 
             cert_name: rule.required_cert, 
             category: certInfo?.category || 'Safety', 
             is_mandatory: true 
           })
        }
      }
    })

    const allExpected = [...required, ...optionals];
    const today = new Date()

    return allExpected.map(req => {
      const uploaded = myCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name))
      let status = 'missing'; let daysLeft = -1;
      
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; daysLeft = 9999; }
        else {
          const expDate = new Date(uploaded.expiry_date)
          daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / 86400000)
          if (daysLeft < 0) status = 'expired'
          else if (daysLeft <= 90) status = 'warning'
          else status = 'ok'
        }
      } else if (!req.is_mandatory) {
        status = 'optional'; 
      }
      
      return { ...req, uploaded, status, daysLeft }
    }).sort((a, b) => {
       const weight: any = { expired: 1, missing: 2, warning: 3, ok: 4, optional: 5 };
       return weight[a.status] - weight[b.status];
    })
  }, [user, matrix, myCerts, rules])

  const stats = useMemo(() => ({
    total: certList.length,
    ok: certList.filter(c => c.status === 'ok').length,
    warning: certList.filter(c => c.status === 'warning').length,
    expired: certList.filter(c => c.status === 'expired').length,
    missing: certList.filter(c => c.status === 'missing').length
  }), [certList])

  const filteredList = certList.filter(c => filter === 'all' ? true : c.status === filter)

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse text-xs">LOADING VAULT...</div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <h1 className="text-3xl font-black italic flex items-center gap-3 mb-8"><ShieldCheck className="text-blue-500" size={32}/> Certificates</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
         {[
           { id: 'all', label: 'ทั้งหมด', val: stats.total, color: 'border-blue-500' },
           { id: 'ok', label: 'ครบถ้วน', val: stats.ok, color: 'border-emerald-500' },
           { id: 'warning', label: 'ใกล้หมด', val: stats.warning, color: 'border-orange-500' },
           { id: 'expired', label: 'หมดแล้ว', val: stats.expired, color: 'border-red-500' },
           { id: 'missing', label: 'ยังไม่มี', val: stats.missing, color: 'border-slate-500' }
         ].map(t => (
           <button key={t.id} onClick={() => setFilter(t.id)} className={`bg-slate-900 p-4 rounded-2xl border-t-4 ${t.color} flex flex-col items-center justify-center transition-all active:scale-95 ${filter === t.id ? 'opacity-100 ring-2 ring-white/20' : 'opacity-50'}`}>
              <span className="text-xl font-black">{t.val}</span><span className="text-[8px] mt-1">{t.label}</span>
           </button>
         ))}
      </div>

      <div className="space-y-3">
        {filteredList.map((item, idx) => (
          <div key={idx} className={`bg-slate-900 border ${item.status === 'missing' ? 'border-red-500/20' : item.status === 'optional' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between transition-all hover:border-blue-500/30`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${
                item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 
                item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 
                item.status === 'expired' ? 'bg-red-500/10 text-red-500' : 
                'bg-slate-800 text-slate-500'
              }`}>
                {item.status === 'missing' ? <AlertTriangle size={22}/> : item.status === 'expired' ? <XCircle size={22}/> : <CheckCircle2 size={22}/>}
              </div>
              <div>
                <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${item.is_mandatory ? 'text-blue-500' : 'text-slate-500'}`}>
                  {item.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}
                </p>
                <h3 className="text-white text-sm leading-tight uppercase">{item.cert_name}</h3>
                {item.uploaded && <p className={`text-[9px] mt-1 ${item.status === 'expired' ? 'text-red-500' : 'text-blue-500'}`}>Exp: {item.uploaded.expiry_date === '2099-12-31' ? 'Indefinite' : item.uploaded.expiry_date}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {item.uploaded ? (
                <>
                  <a href={item.uploaded.file_url} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white/5 text-slate-400 rounded-xl hover:text-white border border-white/5"><Eye size={16}/></a>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="p-2.5 bg-blue-600/10 text-blue-500 rounded-xl border border-blue-500/20 hover:bg-blue-600"><RefreshCcw size={16}/></button>
                </>
              ) : (
                <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[9px] active:scale-95 shadow-lg shadow-blue-600/20">Upload</button>
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
