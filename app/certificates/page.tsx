'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileCheck, Clock, ChevronRight, Eye, ShieldCheck, RefreshCcw, AlertTriangle } from 'lucide-react'

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
      if (m) setMatrix(m); if (c) setMyCerts(c);
      setLoading(false)
    }
    fetchData()
  }, [router])

  const certStatusList = useMemo(() => {
    if (!user || !matrix.length) return []
    
    // 🎯 Logic ค้นหาคอลัมน์แบบสุดยอดความยืดหยุ่น:
    // 1. แปลงชื่อตำแหน่งของลูกเรือให้ลบช่องว่างหน้า/หลัง และตัวเล็กหมด
    const userPos = user.position ? user.position.trim().toLowerCase() : "";
    
    // 2. กรองหาใบเซอร์ที่ต้องใช้ (P)
    const required = matrix.filter(row => {
      // ค้นหาหัวคอลัมน์ใน DB ที่ชื่อเหมือนตำแหน่งเป๊ะๆ (โดยไม่สนใจช่องว่างซ่อนรูปหรือตัวเล็ก/ใหญ่)
      const colKey = Object.keys(row).find(k => k.trim().toLowerCase() === userPos);
      
      // ถ้าหาเจอ และคอลัมน์นั้นมีค่าเป็น 'P' หรือ 'p' (บางทีแอดมินพิมพ์ P เล็กใน DB) ให้ดึงมา
      if (colKey && String(row[colKey]).toUpperCase() === 'P') return true;
      return false;
    })
    
    const today = new Date()
    return required.map(req => {
      // 🎯 หาไฟล์ที่อัปโหลดมาแล้ว (Trim ชื่อกันเหนียว)
      const uploaded = myCerts.find(c => c.cert_name.trim().toLowerCase() === req.cert_name.trim().toLowerCase())
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">VAULT ACCESSING...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 pt-20 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-black italic flex items-center gap-3"><ShieldCheck className="text-blue-500" size={32}/> Certificates</h1>
           <p className="text-slate-500 tracking-widest mt-2">Compliance Vault for {user?.full_name}</p>
        </div>
      </div>

      <div className="space-y-3">
        {certStatusList.length === 0 && (
          <div className="py-20 text-center bg-slate-900/50 border border-dashed border-white/10 rounded-[32px] space-y-4">
             <AlertTriangle className="mx-auto text-slate-700" size={48}/>
             <p className="text-slate-500">No mandatory certificates found for position: {user?.position}</p>
          </div>
        )}
        {certStatusList.map((item, idx) => (
          <div key={idx} className={`bg-slate-900 border ${item.status === 'missing' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between transition-all hover:border-blue-500/30`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
                {item.status === 'missing' ? <Clock size={22}/> : <FileCheck size={22}/>}
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-600 mb-1">{item.category}</p>
                <h3 className="text-white text-sm leading-tight">{item.cert_name}</h3>
                {item.uploaded && <p className="text-[9px] mt-1 text-blue-500">Exp: {item.uploaded.expiry_date === '2099-12-31' ? 'Indefinite' : item.uploaded.expiry_date}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {item.uploaded ? (
                <>
                  <a href={item.uploaded.file_url} target="_blank" className="p-2.5 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all border border-white/5"><Eye size={16}/></a>
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
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse text-xs uppercase tracking-widest">LOADING...</div>}>
      <CertificatesContent />
    </Suspense>
  )
}
