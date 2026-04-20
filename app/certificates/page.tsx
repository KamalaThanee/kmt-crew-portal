'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileCheck, Clock, Upload, ChevronRight, Eye, ShieldCheck, RefreshCcw } from 'lucide-react'

function CertificatesContent() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)

    async function fetchData() {
      const { data: m } = await supabase.from('cert_matrix').select('*')
      const { data: c } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
      if (m) setMatrix(m);
      if (c) setMyCerts(c);
      setLoading(false)
    }
    fetchData()
  }, [router])

  const certStatusList = useMemo(() => {
    if (!user || !matrix.length) return []
    
    // ดึงชื่อตำแหน่งของ User และแปลงเป็นตัวเล็กเพื่อป้องกัน Case-sensitive
    const pos = user.position || ""
    
    // กรองหาใบเซอร์ที่ Matrix ระบุว่าเป็น P (บังคับ) สำหรับตำแหน่งนี้
    const required = matrix.filter(m => m[pos] === 'P')
    
    const today = new Date()
    return required.map(req => {
      const uploaded = myCerts.find(c => c.cert_name === req.cert_name)
      let status = 'missing'
      
      if (uploaded) {
        const expDate = new Date(uploaded.expiry_date)
        if (uploaded.expiry_date === '2099-12-31') status = 'ok'
        else if (expDate < today) status = 'expired'
        else if ((expDate.getTime() - today.getTime()) / 86400000 <= 90) status = 'warning'
        else status = 'ok'
      }
      return { ...req, uploaded, status }
    })
  }, [user, matrix, myCerts])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">VAULT INITIALIZING...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white">
      <div className="mb-10">
        <h1 className="text-3xl font-black uppercase italic flex items-center gap-3"><ShieldCheck className="text-blue-500" size={32}/> Certificates</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Compliance Documents for {user?.full_name}</p>
      </div>

      <div className="space-y-3">
        {certStatusList.length === 0 && <p className="text-center py-20 text-slate-600 font-bold uppercase text-xs">No required certificates found for this position.</p>}
        {certStatusList.map((item, idx) => (
          <div key={idx} className={`bg-slate-900 border ${item.status === 'missing' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between transition-all shadow-xl`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
                {item.status === 'missing' ? <Clock size={22}/> : <FileCheck size={22}/>}
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">{item.category}</p>
                <h3 className="text-white font-bold text-xs md:text-sm leading-tight uppercase">{item.cert_name}</h3>
                {item.uploaded && <p className="text-[9px] font-bold uppercase mt-1 text-blue-400/60 tracking-tighter text-blue-500">Exp: {item.uploaded.expiry_date === '2099-12-31' ? 'Indefinite' : item.uploaded.expiry_date}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {item.uploaded ? (
                <>
                  <a href={item.uploaded.file_url} target="_blank" className="p-2.5 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all border border-white/5"><Eye size={16}/></a>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="p-2.5 bg-blue-600/10 text-blue-500 rounded-xl border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all"><RefreshCcw size={16}/></button>
                </>
              ) : (
                <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-600/20 active:scale-95 transition-all">Upload</button>
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
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse">VAULT LOADING...</div>}>
      <CertificatesContent />
    </Suspense>
  )
}
