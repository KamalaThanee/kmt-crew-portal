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
    
    // 1. หาใบเซอร์หลัก (P) และ ตัวเลือก (O) จาก Matrix
    let required = matrix.filter(row => normalize(row.position) === uPosNorm && row.requirement_type === 'P')
      .map(m => ({ ...m, is_mandatory: true }))

    const optionals = matrix.filter(row => normalize(row.position) === uPosNorm && row.requirement_type === 'O')
      .map(m => ({ ...m, is_mandatory: false }))

    // 2. Trigger Rules Logic (ถ้ามีใบ O บางใบที่อัปโหลดแล้วเป็น Trigger ให้ดีดใบที่ต้องการขึ้นเป็น P)
    rules.forEach(rule => {
      const hasTrigger = myCerts.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))
      if (hasTrigger) {
        // ถ้าเข้าเงื่อนไข ให้ไปหาใบที่ต้องมีเพิ่ม (Required Cert)
        if (!required.some(req => normalize(req.cert_name) === normalize(rule.required_cert))) {
           const certInfo = matrix.find(m => normalize(m.cert_name) === normalize(rule.required_cert))
           required.push({ 
             cert_name: rule.required_cert, 
             category: certInfo?.category || 'Safety', 
             is_mandatory: true // 🎯 กลายเป็นใบเซอร์บังคับทันที!
           })
        }
      }
    })

    // รวมลิสต์ทั้งหมด (P + O)
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
        status = 'optional'; // 🎯 สถานะพิเศษสำหรับใบเลือกที่ยังไม่อัปโหลด
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
    warn: certList.filter(c => c.status === 'warning').length,
    exp: certList.filter(c => c.status === 'expired').length,
    miss: certList.filter(c => c.status === 'missing').length
  }), [certList])

  const filteredList = certList.filter(c => filter === 'all' ? true : c.status === filter)

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">VAULT OPENING...</div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <h1 className="text-3xl font-black italic flex items-center gap-3 mb-8"><ShieldCheck className="text-blue-500" size={32}/> Certificates</h1>

      {/* Mini Dashboard Filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
         <button onClick={() => setFilter('all')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'all' ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-900 border-white/5 text-slate-400'}`}>
            <span className="text-2xl font-black">{stats.total}</span><span>ALL</span>
         </button>
         <button onClick={() => setFilter('ok')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'ok' ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
            <span className="text-2xl font-black">{stats.ok}</span><span>READY</span>
         </button>
         <button onClick={() => setFilter('warning')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'warning' ? 'bg-amber-500 border-amber-400 text-white shadow-lg' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
            <span className="text-2xl font-black">{stats.warning}</span><span>90 DAYS</span>
         </button>
         <button onClick={() => setFilter('expired')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'expired' ? 'bg-red-500 border-red-400 text-white shadow-lg' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            <span className="text-2xl font-black">{stats.expired}</span><span>EXPIRED</span>
         </button>
         <button onClick={() => setFilter('missing')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${filter === 'missing' ? 'bg-slate-600 border-slate-500 text-white shadow-lg' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
            <span className="text-2xl font-black">{stats.miss}</span><span>MISSING</span>
         </button>
      </div>

      <div className="space-y-3">
        {filteredList.map((item, idx) => (
          <div key={idx} className={`bg-slate-900 border ${item.status === 'missing' ? 'border-red-500/20' : item.status === 'optional' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${
                item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 
                item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 
                item.status === 'expired' ? 'bg-red-500/10 text-red-500' : 
                item.status === 'optional' ? 'bg-slate-800 text-slate-600' : 'bg-slate-800 text-red-400'
              }`}>
                {item.status === 'missing' ? <AlertTriangle size={22}/> : item.status === 'optional' ? <Clock size={22}/> : <CheckCircle2 size={22}/>}
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
                  <a href={item.uploaded.file_url} target="_blank" className="p-2.5 bg-white/5 text-slate-400 rounded-xl hover:text-white border border-white/5"><Eye size={16}/></a>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="p-2.5 bg-blue-600/10 text-blue-500 rounded-xl border border-blue-500/20 hover:bg-blue-600"><RefreshCcw size={16}/></button>
                </>
              ) : (
                <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[9px] active:scale-95">Upload</button>
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
