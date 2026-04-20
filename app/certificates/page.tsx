'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileCheck, Clock, Upload, ChevronRight, Eye, ShieldCheck, AlertCircle, RefreshCcw } from 'lucide-react'

function CertificatesContent() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    if (!u.id) { router.push('/login'); return; }
    setUser(u)
    async function fetchData() {
      const { data: matrixData } = await supabase.from('cert_matrix').select('*')
      const { data: certData } = await supabase.from('crew_certs').select('*').eq('crew_id', u.id)
      if (matrixData) setMatrix(matrixData); if (certData) setMyCerts(certData);
      setLoading(false)
    }
    fetchData()
  }, [])

  const certStatusList = useMemo(() => {
    if (!user || !matrix.length) return []
    const required = matrix.filter(m => m[user.position] === 'P')
    const today = new Date()
    return required.map(req => {
      const uploaded = myCerts.find(c => c.cert_name === req.cert_name)
      let status = 'missing'
      if (uploaded) {
        const expDate = new Date(uploaded.expiry_date)
        if (uploaded.expiry_date === '2099-12-31') status = 'ok'
        else if (expDate < today) status = 'expired'
        else if ((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 90) status = 'warning'
        else status = 'ok'
      }
      return { ...req, uploaded, status }
    })
  }, [user, matrix, myCerts])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING CERTS...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 pt-2 md:pt-6 font-sans">
      <h1 className="text-3xl font-black uppercase italic text-white mb-8 flex items-center gap-3">
        <ShieldCheck className="text-blue-500" size={32}/> Certificates
      </h1>

      <div className="space-y-4">
        {certStatusList.map((item, idx) => (
          <div key={idx} className={`bg-slate-900 border ${item.status === 'missing' ? 'border-white/5' : 'border-white/10'} rounded-[28px] p-6 flex items-center justify-between transition-all`}>
            <div className="flex items-center gap-5">
              <div className={`p-4 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
                {item.status === 'missing' ? <Clock size={24}/> : <FileCheck size={24}/>}
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.category}</p>
                <h3 className="text-white font-bold text-sm md:text-base leading-tight">{item.cert_name}</h3>
                {item.uploaded && <p className="text-[10px] font-bold uppercase mt-1 text-slate-500">Exp: {item.uploaded.expiry_date === '2099-12-31' ? 'N/A' : item.uploaded.expiry_date}</p>}
              </div>
            </div>

            <div className="flex gap-2">
              {item.uploaded ? (
                <>
                  <a href={item.uploaded.file_url} target="_blank" className="p-3 bg-white/5 text-slate-400 rounded-xl hover:text-white transition-all"><Eye size={18}/></a>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="p-3 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><RefreshCcw size={18}/></button>
                </>
              ) : (
                <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-600/20 active:scale-90">Upload</button>
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
