'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileCheck, Clock, ChevronRight, Eye, ShieldCheck, RefreshCcw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

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
      const [m, c, r] = await Promise.all([
        supabase.from('cert_matrix').select('*'),
        supabase.from('crew_certs').select('*').eq('crew_id', u.id),
        supabase.from('cert_rules').select('*')
      ]);
      if (m.data) setMatrix(m.data); if (c.data) setMyCerts(c.data); if (r.data) setRules(r.data);
      setLoading(false)
    }
    fetchData()
  }, [router])

  const certList = useMemo(() => {
    if (!user || !matrix.length) return []
    const uPosNorm = normalize(user.position);
    
    // 🎯 1. ดึงรายการทั้งหมดที่เป็นของตำแหน่งนี้ (ทั้ง P และ O) มาแสดงตั้งแต่แรก
    let myMatrixRows = matrix.filter(row => normalize(row.position) === uPosNorm && (row.requirement_type === 'P' || row.requirement_type === 'O'))
      .map(row => ({
        cert_name: row.cert_name,
        category: row.category,
        is_mandatory: row.requirement_type === 'P'
      }));

    // 🎯 2. Trigger Rules Logic
    rules.forEach(rule => {
      const hasTrigger = myCerts.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))
      if (hasTrigger) {
        const alreadyInListIdx = myMatrixRows.findIndex(m => normalize(m.cert_name) === normalize(rule.required_cert));
        if (alreadyInListIdx === -1) {
           const certInfo = matrix.find(m => normalize(m.cert_name) === normalize(rule.required_cert));
           myMatrixRows.push({ cert_name: rule.required_cert, category: certInfo?.category || 'Additional', is_mandatory: true });
        } else {
           myMatrixRows[alreadyInListIdx].is_mandatory = true; // อัปเกรดเป็น Mandatory ถ้ามีใบ Trigger
        }
      }
    })

    const today = new Date()
    return myMatrixRows.map(req => {
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
      } else {
        status = req.is_mandatory ? 'missing' : 'optional';
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

  const filteredList = certList.filter(c => filter === 'all' ? true : (filter === 'ok' ? c.status === 'ok' : c.status === filter))

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">VAULT LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <h1 className="text-3xl font-black italic flex items-center gap-3 mb-8"><ShieldCheck className="text-blue-500" size={32}/> Certificates</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
         {[{id:'all',l:'ทั้งหมด',v:stats.total,c:'border-blue-500'},{id:'ok',l:'ครบถ้วน',v:stats.ok,c:'border-emerald-500'},{id:'warning',l:'ใกล้หมด',v:stats.warning,c:'border-orange-500'},{id:'expired',l:'หมดแล้ว',v:stats.expired,c:'border-red-500'},{id:'missing',l:'ยังไม่มี',v:stats.missing,c:'border-slate-500'}].map(t => (
           <button key={t.id} onClick={() => setFilter(t.id)} className={`bg-slate-900 p-4 rounded-2xl border-t-4 ${t.c} flex flex-col items-center justify-center transition-all active:scale-95 ${filter === t.id ? 'opacity-100 ring-2 ring-white/20' : 'opacity-50'}`}>
              <span className="text-xl font-black">{t.v}</span><span className="text-[8px] mt-1">{t.l}</span>
           </button>
         ))}
      </div>
      <div className="space-y-3">
        {filteredList.map((item, idx) => (
          <div key={idx} className={`bg-slate-900 border ${item.status === 'missing' ? 'border-red-500/20 shadow-lg shadow-red-500/5' : item.status === 'optional' ? 'border-white/5 opacity-40' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between hover:border-blue-500/30 transition-all`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
                {item.status === 'missing' ? <AlertTriangle size={22}/> : item.status === 'expired' ? <XCircle size={22}/> : item.status === 'optional' ? <Clock size={22}/> : <CheckCircle2 size={22}/>}
              </div>
              <div>
                <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${item.is_mandatory ? 'text-blue-500' : 'text-slate-500'}`}>{item.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}</p>
                <h3 className="text-white text-sm leading-tight uppercase">{item.cert_name}</h3>
                {item.uploaded && <p className={`text-[9px] mt-1 ${item.status === 'expired' ? 'text-red-500' : 'text-blue-500'}`}>Exp: {item.uploaded.expiry_date === '2099-12-31' ? 'Indefinite' : item.uploaded.expiry_date}</p>}
              </div>
            </div>
            <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${item.uploaded ? 'bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 active:scale-90'}`}>
              {item.uploaded ? 'Update' : 'Upload'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CertificatesPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
