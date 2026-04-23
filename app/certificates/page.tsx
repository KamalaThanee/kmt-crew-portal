'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  ShieldCheck, FileBadge, User, Ship, ChevronRight, Eye, RefreshCcw, 
  AlertTriangle, Clock, CheckCircle2, XCircle, Search, Filter, Plus
} from 'lucide-react'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

function CertificatesContent() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('personal') // personal, crew, ship
  const [loading, setLoading] = useState(true)
  
  // Data States
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [allCerts, setAllCerts] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const isAdmin = useMemo(() => 
    ["safety officer", "chief officer", "barge master"].includes((currentUser?.position || "").toLowerCase())
  , [currentUser]);

  const fetchData = async () => {
    const [m, c, crewsRes, allC] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crew_certs').select('*').eq('crew_id', currentUser?.id),
      supabase.from('crews').select('*').order('full_name'),
      supabase.from('crew_certs').select('*')
    ]);
    if (m.data) setMatrix(m.data);
    if (c.data) setMyCerts(c.data);
    if (crewsRes.data) setCrews(crewsRes.data);
    if (allC.data) setAllCerts(allC.data);
    setLoading(false);
  }

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('kmt_user') || 'null');
    if (!u) { router.push('/login'); return; }
    setCurrentUser(u);
  }, [router]);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser]);

  // --- Logic สำหรับดึงรายการ Cert รายบุคคล (ใช้ทั้ง My Cert และ Admin View) ---
  const calculateCerts = (targetCrew: any, crewCertList: any[]) => {
    const uPos = normalize(targetCrew.position);
    const required = matrix.filter(row => normalize(row.position) === uPos && (row.requirement_type === 'P' || row.requirement_type === 'O'))
      .map(m => ({ ...m, is_mandatory: m.requirement_type === 'P' }));
    
    const today = new Date();
    let ok = 0, exp = 0, warn = 0, miss = 0;

    const list = required.map(req => {
      const uploaded = crewCertList.find(c => normalize(c.cert_name) === normalize(req.cert_name));
      let status = req.is_mandatory ? 'missing' : 'optional';
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; ok++; }
        else {
          const d = (new Date(uploaded.expiry_date).getTime() - today.getTime()) / 86400000;
          if (d < 0) { status = 'expired'; exp++; }
          else if (d <= 90) { status = 'warning'; warn++; ok++; }
          else { status = 'ok'; ok++; }
        }
      } else if (req.is_mandatory) miss++;
      return { ...req, uploaded, status };
    });

    const progress = required.filter(r => r.is_mandatory).length > 0 
      ? Math.round((ok / required.filter(r => r.is_mandatory).length) * 100) : 0;

    return { list, progress, ok, exp, warn, miss };
  }

  // --- 1. My Personal Certs Logic ---
  const myCertData = useMemo(() => calculateCerts(currentUser || {}, myCerts), [currentUser, myCerts, matrix]);

  // --- 2. Crew Oversight Logic (For Admin) ---
  const crewMasterList = useMemo(() => {
    return crews.map(c => ({ ...c, certStatus: calculateCerts(c, allCerts.filter(ac => ac.crew_id === c.id)) }))
    .filter(c => {
      const matchSearch = c.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'expired') return c.certStatus.exp > 0;
      if (statusFilter === 'warning') return c.certStatus.warn > 0 && c.certStatus.exp === 0;
      if (statusFilter === 'ready') return c.certStatus.progress === 100;
      return true;
    });
  }, [crews, allCerts, matrix, searchTerm, statusFilter]);

  if (loading || !currentUser) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse uppercase">Vault Accessing...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl font-black italic flex items-center gap-3"><ShieldCheck className="text-orange-500" size={32}/> Certificate Hub</h1>
           <p className="text-zinc-500 mt-2 tracking-widest uppercase">Personnel & Vessel Compliance</p>
        </div>
        
        {/* 🎯 Tabs Switching (Only for Admin) */}
        {isAdmin && (
          <div className="flex bg-zinc-900 p-1 rounded-2xl border border-white/5 w-fit">
            <button onClick={() => setActiveTab('personal')} className={`px-6 py-2.5 rounded-xl transition-all ${activeTab === 'personal' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>My Certs</button>
            <button onClick={() => setActiveTab('crew')} className={`px-6 py-2.5 rounded-xl transition-all ${activeTab === 'crew' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Crew Certs</button>
            <button onClick={() => setActiveTab('ship')} className={`px-6 py-2.5 rounded-xl transition-all ${activeTab === 'ship' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Ship Certs</button>
          </div>
        )}
      </div>

      {/* --- TAB 1: MY PERSONAL CERTS --- */}
      {activeTab === 'personal' && (
        <div className="space-y-6 animate-in fade-in">
           <div className="bg-zinc-900 border border-orange-500/20 p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-8">
                 <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (myCertData.progress/100)*276} className="text-orange-500 transition-all duration-1000"/></svg>
                    <span className="absolute text-xl font-black">{myCertData.progress}%</span>
                 </div>
                 <div><h2 className="text-2xl font-black italic uppercase">My Compliance</h2><p className="text-zinc-500 mt-1 uppercase text-[10px] tracking-widest">{myCertData.ok} / {myCertData.list.filter(c => c.is_mandatory).length} Mandatory Certs Valid</p></div>
              </div>
           </div>

           <div className="space-y-3">
              {myCertData.list.map((item, idx) => (
                <div key={idx} className={`bg-zinc-900 border ${item.status === 'missing' ? 'border-red-500/20' : 'border-white/5'} rounded-[24px] p-5 flex items-center justify-between hover:border-orange-500/30 transition-all`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                      {item.status === 'ok' ? <CheckCircle2 size={20}/> : <Clock size={20}/>}
                    </div>
                    <div><p className="text-[8px] font-black text-zinc-500 mb-1">{item.category}</p><h3 className="text-white text-xs font-black uppercase">{item.cert_name}</h3></div>
                  </div>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="px-4 py-2 bg-orange-600 rounded-xl text-[9px] font-black uppercase shadow-lg">Upload</button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* --- TAB 2: CREW CERTS (ADMIN ONLY) --- */}
      {activeTab === 'crew' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input type="text" placeholder="Search crew name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-5 pl-12 rounded-[24px] outline-none focus:border-orange-500 font-bold" /></div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-zinc-900 border border-white/10 p-5 rounded-[24px] outline-none text-orange-500 font-black"><option value="all">All Compliance Status</option><option value="expired">Certs Expired</option><option value="warning">Expiring Soon (90D)</option><option value="ready">100% Ready</option></select>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {crewMasterList.map(crew => (
                <div key={crew.id} className="bg-zinc-900 border border-white/5 p-6 rounded-[32px] space-y-6 hover:border-orange-500/40 transition-all shadow-xl">
                   <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500"><User/></div>
                        <div><p className="text-white font-black text-xs uppercase leading-tight">{crew.full_name}</p><p className="text-zinc-600 text-[9px] mt-1">{crew.position}</p></div>
                      </div>
                      <div className="text-right"><p className="text-orange-500 font-black text-lg">{crew.certStatus.progress}%</p><p className="text-zinc-700 text-[8px] uppercase">Ready</p></div>
                   </div>
                   
                   <div className="space-y-2 border-t border-white/5 pt-4">
                      {crew.certStatus.list.slice(0, 3).map((c:any, i:number) => (
                        <div key={i} className="flex justify-between text-[9px] font-bold"><span className="text-zinc-500 uppercase">{c.cert_name.substring(0,25)}...</span><span className={c.status==='ok'?'text-emerald-500':c.status==='expired'?'text-red-500':'text-amber-500'}>{c.status.toUpperCase()}</span></div>
                      ))}
                      <button onClick={() => router.push(`/admin/settings?tab=crews&id=${crew.id}`)} className="w-full py-2.5 mt-2 bg-black/40 text-orange-500 rounded-xl hover:bg-orange-500 hover:text-white transition-all text-[8px] font-black uppercase flex items-center justify-center gap-2">Manage Full Record <ChevronRight size={12}/></button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'ship' && <div className="py-40 text-center animate-pulse text-zinc-600 font-black italic">COMING SOON: VESSEL COMPLIANCE VAULT</div>}
    </div>
  )
}

export default function CertificatesPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
