'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  ShieldCheck, FileBadge, User, Ship, ChevronRight, ChevronDown, Eye, RefreshCcw, 
  AlertTriangle, Clock, CheckCircle2, XCircle, Search, Filter, Plus, Users
} from 'lucide-react'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

function CertificatesContent() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('personal')
  const [loading, setLoading] = useState(true)
  
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [allCerts, setAllCerts] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  
  // States
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState('all') 
  const [personalFilter, setPersonalFilter] = useState('all') // 🎯 สำหรับ Filter ใบเซอร์ส่วนตัว
  const [expandedCrews, setExpandedCrews] = useState<string[]>([]) // 🎯 สำหรับ Accordion

  const isAdmin = useMemo(() => 
    ["safety officer", "chief officer", "barge master"].includes((currentUser?.position || "").toLowerCase())
  , [currentUser]);

  const fetchData = async () => {
    const [m, c, crewsRes, allC, r] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crew_certs').select('*').eq('crew_id', currentUser?.id),
      supabase.from('crews').select('*').order('full_name'),
      supabase.from('crew_certs').select('*'),
      supabase.from('cert_rules').select('*')
    ]);
    if (m.data) setMatrix(m.data);
    if (c.data) setMyCerts(c.data);
    if (crewsRes.data) setCrews(crewsRes.data);
    if (allC.data) setAllCerts(allC.data);
    if (r.data) setRules(r.data);
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

  const calculateCerts = (targetCrew: any, crewCertList: any[]) => {
    if (!matrix.length) return { progress: 0, ok: 0, expired: 0, warning: 0, missing: 0, list: [] };
    const uPos = normalize(targetCrew.position);
    let required = matrix.filter(row => normalize(row.position) === uPos && (row.requirement_type === 'P' || row.requirement_type === 'O'))
      .map(m => ({ ...m, is_mandatory: m.requirement_type === 'P' }));
    
    (rules || []).forEach(rule => {
      if (crewCertList.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))) {
        const idx = required.findIndex(req => normalize(req.cert_name) === normalize(rule.required_cert));
        if (idx === -1) {
          const info = matrix.find(m => normalize(m.cert_name) === normalize(rule.required_cert));
          required.push({ cert_name: rule.required_cert, is_mandatory: true, category: info?.category || 'Additional' });
        } else { required[idx].is_mandatory = true; }
      }
    });

    const today = new Date();
    let ok = 0, expired = 0, warning = 0, missing = 0, mandatoryTotal = 0;

    const list = required.map(req => {
      if (req.is_mandatory) mandatoryTotal++;
      const uploaded = crewCertList.find(c => normalize(c.cert_name) === normalize(req.cert_name));
      let status = req.is_mandatory ? 'missing' : 'optional';
      let daysLeft = -1;
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; ok++; daysLeft = 9999; }
        else {
          const expDate = new Date(uploaded.expiry_date);
          daysLeft = Math.floor((expDate.getTime() - today.getTime()) / 86400000);
          if (daysLeft < 0) { status = 'expired'; expired++; }
          else if (daysLeft <= 90) { status = 'warning'; warning++; ok++; }
          else { status = 'ok'; ok++; }
        }
      } else if (req.is_mandatory) missing++;
      return { ...req, uploaded, status, daysLeft };
    });

    return { 
      list, 
      progress: mandatoryTotal > 0 ? Math.round((ok / mandatoryTotal) * 100) : 0, 
      ok, expired, warning, missing 
    };
  }

  const myCertData = useMemo(() => calculateCerts(currentUser || {}, myCerts), [currentUser, myCerts, matrix, rules]);

  // --- Filtered Personal List ---
  const filteredMyList = useMemo(() => {
    return myCertData.list.filter(c => personalFilter === 'all' ? true : c.status === personalFilter);
  }, [myCertData, personalFilter]);

  // --- Filtered Crew List for Admin ---
  const filteredCrews = useMemo(() => {
    return crews.map(c => ({ ...c, certData: calculateCerts(c, allCerts.filter(ac => ac.crew_id === c.id)) }))
    .filter(c => {
      const matchSearch = c.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      let matchMode = true;
      if (filterMode === 'ready') matchMode = c.certData.progress === 100 && c.certData.expired === 0;
      if (filterMode === 'warning') matchMode = c.certData.warning > 0 && c.certData.expired === 0;
      if (filterMode === 'expired') matchMode = c.certData.expired > 0;
      if (filterMode === 'action') matchMode = c.certData.progress < 100 || c.certData.expired > 0;
      return matchSearch && matchMode;
    })
  }, [crews, allCerts, matrix, searchTerm, filterMode, rules]);

  if (loading || !currentUser) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse uppercase text-xs">VAULT ACCESSING...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div><h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3"><ShieldCheck className="text-orange-500" size={36}/> Certificate Hub</h1></div>
        {isAdmin && (
          <div className="flex bg-zinc-900 p-1 rounded-2xl border border-white/5 w-fit shadow-2xl">
            {['personal', 'crew'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-8 py-3 rounded-xl transition-all ${activeTab === t ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}>{t === 'personal' ? 'My Certs' : 'Crew Oversight'}</button>
            ))}
          </div>
        )}
      </div>

      {/* --- TAB 1: MY PERSONAL --- */}
      {activeTab === 'personal' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="bg-zinc-900 border border-orange-500/20 p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-8">
                 <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (myCertData.progress/100)*276} className="text-orange-500 transition-all duration-1000"/></svg>
                    <span className="absolute text-xl font-black">{myCertData.progress}%</span>
                 </div>
                 <div><h2 className="text-2xl font-black italic uppercase">My Compliance</h2><p className="text-zinc-500 mt-1 uppercase text-[10px] tracking-widest">{myCertData.ok} / {myCertData.list.filter(c => c.is_mandatory).length} Valid Documents</p></div>
              </div>

              {/* 🎯 Personal Status Filter Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                 {[
                   { id: 'ok', label: 'Ready', val: myCertData.ok, color: 'border-emerald-500', text: 'text-emerald-500' },
                   { id: 'warning', label: '90 Days', val: myCertData.warning, color: 'border-orange-500', text: 'text-orange-500' },
                   { id: 'expired', label: 'Expired', val: myCertData.expired, color: 'border-red-500', text: 'text-red-500' },
                   { id: 'missing', label: 'Missing', val: myCertData.missing, color: 'border-zinc-700', text: 'text-zinc-500' }
                 ].map(tile => (
                   <button key={tile.id} onClick={() => setPersonalFilter(personalFilter === tile.id ? 'all' : tile.id)} className={`bg-black/40 p-3 rounded-2xl border-t-2 ${tile.color} transition-all ${personalFilter === tile.id ? 'bg-zinc-800 ring-2 ring-white/10' : 'opacity-60'}`}>
                      <p className={`text-lg font-black ${tile.text}`}>{tile.val}</p>
                      <p className="text-[7px] text-zinc-500">{tile.label}</p>
                   </button>
                 ))}
              </div>
           </div>

           <div className="space-y-3">
              {filteredMyList.map((item, idx) => (
                <div key={idx} className={`bg-zinc-900 border ${item.status === 'missing' ? 'border-red-500/20' : item.status === 'optional' ? 'border-white/5 opacity-40' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between transition-all shadow-xl`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>{item.status === 'ok' ? <CheckCircle2 size={22}/> : <Clock size={22}/>}</div>
                    <div><p className={`text-[8px] font-black ${item.is_mandatory ? 'text-blue-500' : 'text-zinc-600'}`}>{item.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}</p><h3 className="text-white text-xs md:text-sm font-black uppercase tracking-tight">{item.cert_name}</h3>{item.uploaded && <p className="text-[9px] mt-1 text-blue-500 font-black">Exp: {item.uploaded.expiry_date}</p>}</div>
                  </div>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="px-5 py-2.5 bg-orange-600 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Upload</button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* --- TAB 2: CREW CERTS (Accordion) --- */}
      {activeTab === 'crew' && (
        <div className="space-y-8 animate-in fade-in">
           {/* Summary Tiles */}
           <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { id: 'all', label: 'ทั้งหมด', val: crews.length, color: 'border-blue-500' },
                { id: 'ready', label: 'ครบถ้วน', val: filteredCrews.filter(c => c.certData.progress === 100).length, color: 'border-emerald-500' },
                { id: 'warning', label: 'ใกล้หมด', val: filteredCrews.filter(c => c.certData.warning > 0).length, color: 'border-orange-500' },
                { id: 'expired', label: 'หมดแล้ว', val: filteredCrews.filter(c => c.certData.expired > 0).length, color: 'border-red-500' },
                { id: 'action', label: 'ต้องดำเนินการ', val: filteredCrews.filter(c => c.certData.progress < 100 || c.certData.expired > 0).length, color: 'border-red-600' }
              ].map(tile => (
                <button key={tile.id} onClick={() => setFilterMode(tile.id)} className={`bg-zinc-900 border-t-4 ${tile.color} p-6 rounded-3xl flex flex-col items-center transition-all ${filterMode === tile.id ? 'bg-zinc-800 ring-2 ring-white/10' : 'opacity-50'}`}>
                   <p className="text-2xl font-black">{tile.val}</p>
                   <p className="text-[8px] mt-2 text-zinc-500 uppercase">{tile.label}</p>
                </button>
              ))}
           </div>

           <div className="relative mb-6">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input type="text" placeholder="Search crew name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-5 pl-14 rounded-[28px] outline-none focus:border-orange-500 text-sm font-bold" />
           </div>

           {/* 🎯 Accordion List */}
           <div className="space-y-4">
              {filteredCrews.map(crew => {
                const isExpanded = expandedCrews.includes(crew.id);
                return (
                  <div key={crew.id} className={`bg-zinc-900 border rounded-[32px] overflow-hidden transition-all ${isExpanded ? 'border-orange-500/30 shadow-2xl' : 'border-white/5 hover:border-white/20'}`}>
                     <button onClick={() => setExpandedCrews(prev => prev.includes(crew.id) ? prev.filter(id => id !== crew.id) : [...prev, crew.id])} className="w-full p-6 md:p-8 flex items-center justify-between outline-none">
                        <div className="flex items-center gap-6 text-left">
                           <div className="relative w-14 h-14 shrink-0">
                              <svg className="w-full h-full transform -rotate-90"><circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5"/><circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="151" strokeDashoffset={151 - (crew.certData.progress/100)*151} className={crew.certData.progress === 100 ? 'text-emerald-500' : 'text-orange-500'}/></svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{crew.certData.progress}%</span>
                           </div>
                           <div><p className="text-sm font-black text-white">{crew.full_name}</p><p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">{crew.position}</p></div>
                        </div>
                        <div className="flex items-center gap-4">
                           {crew.certData.expired > 0 && <span className="hidden md:block bg-red-500/20 text-red-500 text-[8px] px-3 py-1 rounded-full font-black animate-pulse">EXP {crew.certData.expired}</span>}
                           {isExpanded ? <ChevronDown className="text-orange-500" /> : <ChevronRight className="text-zinc-700" />}
                        </div>
                     </button>
                     
                     {isExpanded && (
                       <div className="p-6 md:p-8 pt-0 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                             {crew.certData.list.map((c: any, i: number) => (
                               <div key={i} className={`flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border-l-4 ${c.status === 'ok' ? 'border-l-emerald-500' : c.status === 'expired' ? 'border-l-red-500' : c.status === 'warning' ? 'border-l-amber-500' : 'border-l-zinc-700'}`}>
                                  <div>
                                     <p className="text-white text-[11px] font-black leading-tight uppercase">{c.cert_name}</p>
                                     <p className={`text-[8px] mt-1 font-bold ${c.status === 'ok' ? 'text-emerald-500/70' : c.status === 'expired' ? 'text-red-500' : 'text-zinc-600'}`}>{c.uploaded ? `Expiry: ${c.uploaded.expiry_date}` : 'Document Missing'}</p>
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                     {c.uploaded && <a href={c.uploaded.file_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-lg text-orange-500"><Eye size={16}/></a>}
                                     <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(c.cert_name)}&crewId=${crew.id}`)} className="p-2 bg-orange-600 rounded-lg text-white"><RefreshCcw size={16}/></button>
                                  </div>
                               </div>
                             ))}
                          </div>
                          <button onClick={() => router.push(`/admin/settings?tab=crews&id=${crew.id}`)} className="w-full py-4 mt-6 bg-zinc-800 border border-white/5 rounded-2xl text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2">Manage Full Profile Data <ChevronRight size={14}/></button>
                       </div>
                     )}
                  </div>
                )
              })}
           </div>
        </div>
      )}
    </div>
  )
}

export default function CertificatesPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
