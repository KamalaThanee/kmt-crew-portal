'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatExpiryLabel, isNoExpiryDate } from '@/lib/certificates'
import { isAdminRole } from '@/lib/roles'
import { toast } from 'sonner'
import { 
  ShieldCheck, FileBadge, User, Ship, ChevronRight, ChevronDown, Eye, RefreshCcw, 
  AlertTriangle, Clock, CheckCircle2, XCircle, Search, Filter, Plus, Users
} from 'lucide-react'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

function CertificatesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('personal')
  const [loading, setLoading] = useState(true)
  
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [allCerts, setAllCerts] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState('all') 
  const [filterPos, setFilterPos] = useState('All')
  const [filterSpecificCert, setFilterSpecificCert] = useState('All')
  const [personalFilter, setPersonalFilter] = useState('all') 
  const [expandedCrews, setExpandedCrews] = useState<string[]>([])

  const isAdmin = useMemo(() => isAdminRole(currentUser?.position), [currentUser]);

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
    const tab = searchParams.get('tab')
    const crewFilter = searchParams.get('filter')
    const personal = searchParams.get('personal')

    if (tab === 'crew' && isAdmin) setActiveTab('crew')
    if (tab === 'personal') setActiveTab('personal')
    if (tab === 'ship' && isAdmin) setActiveTab('ship')

    if (crewFilter && ['all', 'ready', 'warning', 'expired', 'action'].includes(crewFilter)) {
      setFilterMode(crewFilter)
    }

    if (personal && ['all', 'ok', 'warning', 'expired', 'missing'].includes(personal)) {
      setPersonalFilter(personal)
    }
  }, [isAdmin, searchParams])

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
        if (isNoExpiryDate(uploaded.expiry_date)) { status = 'ok'; ok++; daysLeft = 9999; }
        else {
          const expDate = new Date(uploaded.expiry_date);
          daysLeft = Math.floor((expDate.getTime() - today.getTime()) / 86400000);
          if (daysLeft < 0) { status = 'expired'; expired++; }
          else if (daysLeft <= 90) { status = 'warning'; warning++; ok++; }
          else { status = 'ok'; ok++; }
        }
      } else if (req.is_mandatory) missing++;
      return { ...req, uploaded, status, daysLeft };
    }).sort((a, b) => {
       const weight: any = { expired: 1, missing: 2, warning: 3, ok: 4, optional: 5 };
       return weight[a.status] - weight[b.status];
    });

    return { 
      list, 
      progress: mandatoryTotal > 0 ? Math.round((ok / mandatoryTotal) * 100) : 0, 
      ok, expired, warning, missing 
    };
  }

  const myCertData = useMemo(() => calculateCerts(currentUser || {}, myCerts), [currentUser, myCerts, matrix, rules]);

  const allPositions = useMemo(() => ['All', ...new Set(crews.map(c => c.position))].sort(), [crews]);
  const allCertTypes = useMemo(() => ['All', ...new Set(matrix.map(m => m.cert_name))].sort(), [matrix]);

  const enhancedCrews = useMemo(() => {
    return crews.map(c => ({ ...c, certData: calculateCerts(c, allCerts.filter(ac => ac.crew_id === c.id)) }))
    .filter(crew => {
      const matchSearch = crew.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPos = filterPos === 'All' || crew.position === filterPos;
      let matchCert = true;
      if (filterSpecificCert !== 'All') {
        matchCert = crew.certData.list.some((cert: any) => normalize(cert.cert_name) === normalize(filterSpecificCert) && cert.status !== 'missing' && cert.status !== 'optional');
      }
      return matchSearch && matchPos && matchCert;
    });
  }, [crews, allCerts, matrix, rules, searchTerm, filterPos, filterSpecificCert]);

  const crewSummary = useMemo(() => {
    return {
      total: enhancedCrews.length,
      ready: enhancedCrews.filter(c => c.certData.progress === 100 && c.certData.expired === 0).length, // 🎯 ใช้ 'ready'
      warning: enhancedCrews.filter(c => c.certData.warning > 0 && c.certData.expired === 0).length,
      expired: enhancedCrews.filter(c => c.certData.expired > 0).length,
      action: enhancedCrews.filter(c => c.certData.progress < 100 || c.certData.expired > 0).length
    }
  }, [enhancedCrews]);

  const finalDisplayCrews = useMemo(() => {
    return enhancedCrews.filter(c => {
      if (filterMode === 'all') return true;
      if (filterMode === 'ready') return c.certData.progress === 100 && c.certData.expired === 0;
      if (filterMode === 'warning') return c.certData.warning > 0 && c.certData.expired === 0;
      if (filterMode === 'expired') return c.certData.expired > 0;
      if (filterMode === 'action') return c.certData.progress < 100 || c.certData.expired > 0;
      return true;
    });
  }, [enhancedCrews, filterMode]);

  if (loading || !currentUser) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse">VAULT ACCESSING...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3"><ShieldCheck className="text-orange-500" size={36}/> Certificate Hub</h1>
           <p className="text-zinc-500 mt-1 tracking-widest">Enterprise Compliance Dashboard</p>
        </div>
        
        {isAdmin && (
          <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-white/5 w-fit shadow-2xl">
            <button onClick={() => setActiveTab('personal')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'personal' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-white'}`}>My Certs</button>
            <button onClick={() => setActiveTab('crew')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'crew' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-white'}`}>Crew Certificates</button>
            <button onClick={() => setActiveTab('ship')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'ship' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-white'}`}>Ship Certs</button>
          </div>
        )}
      </div>

      {activeTab === 'personal' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="bg-zinc-900 border border-orange-500/20 p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-8 w-full md:w-auto">
                 <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (myCertData.progress/100)*276} className="text-orange-500 transition-all duration-1000"/></svg>
                    <span className="absolute text-xl font-black">{myCertData.progress}%</span>
                 </div>
                 <div><h2 className="text-2xl font-black italic uppercase">My Compliance</h2><p className="text-zinc-500 mt-1 uppercase text-[10px] tracking-widest">{myCertData.ok} / {myCertData.list.filter(c => c.is_mandatory).length} Mandatory Valid</p></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                 {[
                   { id: 'ok', label: 'Ready', val: myCertData.ok, color: 'border-emerald-500', text: 'text-emerald-500' },
                   { id: 'warning', label: '90 Days', val: myCertData.warning, color: 'border-orange-500', text: 'text-orange-500' },
                   { id: 'expired', label: 'Expired', val: myCertData.expired, color: 'border-red-500', text: 'text-red-500' },
                   { id: 'missing', label: 'Missing', val: myCertData.missing, color: 'border-zinc-700', text: 'text-zinc-500' }
                 ].map(tile => (
                   <button key={tile.id} onClick={() => setPersonalFilter(personalFilter === tile.id ? 'all' : tile.id)} className={`bg-black/40 p-4 rounded-2xl border-t-2 ${tile.color} transition-all ${personalFilter === tile.id ? 'bg-zinc-800 ring-2 ring-white/10' : 'hover:bg-zinc-800/50'}`}>
                      <p className={`text-xl font-black ${tile.text}`}>{tile.val}</p>
                      <p className="text-[8px] text-zinc-500 mt-1">{tile.label}</p>
                   </button>
                 ))}
              </div>
           </div>

           <div className="space-y-3">
              {(personalFilter === 'all' ? myCertData.list : myCertData.list.filter(c => c.status === personalFilter)).map((item, idx) => (
                <div key={idx} className={`bg-zinc-900 border ${item.status === 'missing' ? 'border-red-500/20' : item.status === 'optional' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between group hover:border-orange-500/30 transition-all shadow-xl`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3.5 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'optional' ? 'bg-slate-800 text-slate-500' : 'bg-red-500/10 text-red-500'}`}>
                      {item.status === 'ok' ? <CheckCircle2 size={24}/> : item.status === 'optional' ? <Clock size={24}/> : <AlertTriangle size={24}/>}
                    </div>
                    <div><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${item.is_mandatory ? 'text-blue-500' : 'text-zinc-600'}`}>{item.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}</p><h3 className="text-white text-xs md:text-sm font-black leading-tight">{item.cert_name}</h3>{item.uploaded && <p className="text-[9px] mt-1 text-blue-500 font-black">Exp: {formatExpiryLabel(item.uploaded.expiry_date)}</p>}</div>
                  </div>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="px-6 py-3 bg-orange-600 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Upload</button>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'crew' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { id: 'all', label: 'ทั้งหมด', val: crewSummary.total, color: 'border-blue-500', icon: <Users size={16}/> },
                { id: 'ready', label: 'ครบถ้วน', val: crewSummary.ready, color: 'border-emerald-500', icon: <CheckCircle2 size={16}/> },
                { id: 'warning', label: 'ใกล้หมด (90D)', val: crewSummary.warning, color: 'border-orange-500', icon: <Clock size={16}/> },
                { id: 'expired', label: 'หมดแล้ว', val: crewSummary.expired, color: 'border-red-500', icon: <XCircle size={16}/> },
                { id: 'action', label: 'ต้องดำเนินการ', val: crewSummary.action, color: 'border-red-600', icon: <AlertTriangle size={16}/> }
              ].map(tile => (
                <button key={tile.id} onClick={() => setFilterMode(tile.id)} className={`bg-zinc-900 border-t-4 ${tile.color} p-6 rounded-3xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-xl ${filterMode === tile.id ? 'opacity-100 ring-2 ring-white/20' : 'opacity-40 hover:opacity-100'}`}>
                   <p className="text-2xl font-black">{tile.val}</p>
                   <p className="text-[8px] mt-2 flex items-center gap-1.5 text-zinc-400">{tile.icon} {tile.label}</p>
                </button>
              ))}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-900/50 p-4 rounded-[28px] border border-white/5">
              <div className="relative md:col-span-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16}/><input type="text" placeholder="Search crew..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-orange-500 text-xs font-bold" /></div>
              <select value={filterPos} onChange={e => setFilterPos(e.target.value)} className="bg-black/50 border border-white/10 p-4 rounded-2xl outline-none text-xs font-bold text-blue-400"><option value="All">All Positions</option>{allPositions.map(p => <option key={p} value={p}>{p}</option>)}</select>
              <select value={filterSpecificCert} onChange={e => setFilterSpecificCert(e.target.value)} className="bg-black/50 border border-white/10 p-4 rounded-2xl outline-none text-xs font-bold text-orange-400"><option value="All">Select Specific Certificate...</option>{allCertTypes.map(c => <option key={c} value={c}>{c}</option>)}</select>
           </div>

           <div className="space-y-4">
              {finalDisplayCrews.map(crew => {
                const isExpanded = expandedCrews.includes(crew.id);
                const pColor = crew.certData.progress === 100 ? 'text-emerald-500' : crew.certData.expired > 0 ? 'text-red-500' : 'text-amber-500';
                return (
                  <div key={crew.id} className={`bg-zinc-900 border rounded-[32px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-orange-500/50 shadow-2xl' : 'border-white/5 hover:border-white/20'}`}>
                     <button onClick={() => setExpandedCrews(prev => prev.includes(crew.id) ? prev.filter(id => id !== crew.id) : [...prev, crew.id])} className="w-full p-6 flex flex-col outline-none">
                        <div className="w-full flex justify-between items-center mb-3">
                           <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500"><User size={20}/></div>
                             <div className="text-left"><p className="font-black text-sm text-white uppercase">{crew.full_name}</p><p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-widest">{crew.position}</p></div>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="text-right hidden md:block"><p className={`text-xl font-black ${pColor}`}>{crew.certData.progress}%</p><p className="text-[8px] text-zinc-600 uppercase">Readiness</p></div>
                              <div className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase ${crew.certData.progress === 100 ? 'bg-emerald-500/10 text-emerald-500' : crew.certData.expired > 0 ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-amber-500/10 text-amber-500'}`}>
                                 {crew.certData.progress === 100 ? '✅ Ready' : crew.certData.expired > 0 ? '🚨 Action Required' : '⚠️ Pending'}
                              </div>
                              {isExpanded ? <ChevronDown className="text-orange-500" size={24}/> : <ChevronRight className="text-zinc-600" size={24}/>}
                           </div>
                        </div>
                     </button>
                     {isExpanded && (
                       <div className="p-6 md:p-8 pt-0 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                             {crew.certData.list.map((c: any, i: number) => (
                               <div key={i} className={`flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border-l-4 ${c.status === 'ok' ? 'border-l-emerald-500' : c.status === 'expired' ? 'border-l-red-500' : c.status === 'warning' ? 'border-l-amber-500' : 'border-l-zinc-700'}`}>
                                  <div>
                                     <p className="text-white text-[11px] font-black leading-tight uppercase">{c.cert_name}</p>
                                     <p className={`text-[8px] mt-1 font-bold uppercase ${c.status === 'ok' ? 'text-emerald-500' : c.status === 'expired' ? 'text-red-500' : 'text-zinc-500'}`}>{c.uploaded ? `Expiry: ${formatExpiryLabel(c.uploaded.expiry_date)}` : 'Document Missing'}</p>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                     {c.uploaded && <a href={c.uploaded.file_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-lg text-orange-500 hover:bg-orange-600 hover:text-white"><Eye size={16}/></a>}
                                     <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(c.cert_name)}&crewId=${crew.id}`)} className="p-2 bg-orange-600/10 text-orange-500 rounded-lg hover:bg-orange-600 hover:text-white"><RefreshCcw size={16}/></button>
                                  </div>
                               </div>
                             ))}
                          </div>
                          <button onClick={() => router.push(`/admin/settings?tab=crews&id=${crew.id}`)} className="w-full py-4 mt-6 bg-zinc-800 border border-white/5 rounded-2xl text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2">Edit Crew Profile <ChevronRight size={14}/></button>
                       </div>
                     )}
                  </div>
                )
              })}
           </div>
        </div>
      )}

      {activeTab === 'ship' && <div className="py-40 text-center animate-pulse text-zinc-700 font-black italic text-xl">COMING SOON: SHIP CERTIFICATES</div>}
    </div>
  )
}

export default function CertificatesPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
