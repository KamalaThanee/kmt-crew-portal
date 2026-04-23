'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ShieldCheck, FileBadge, User, Ship, ChevronRight, Eye, RefreshCcw, 
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
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState('all') 
  const [filterPos, setFilterPos] = useState('All')
  const [filterSpecificCert, setFilterSpecificCert] = useState('All')

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
    if (!matrix.length) return { progress: 0, expired: 0, warning: 0, missing: 0, list: [] };
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
    // 🎯 แก้ตัวแปรตรงนี้ให้ตรงกับตอนเรียกใช้ (ok, exp, warning, miss)
    let ok = 0, exp = 0, warning = 0, miss = 0, mandatoryTotal = 0;

    const list = required.map(req => {
      if (req.is_mandatory) mandatoryTotal++;
      const uploaded = crewCertList.find(c => normalize(c.cert_name) === normalize(req.cert_name));
      let status = req.is_mandatory ? 'missing' : 'optional';
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; ok++; }
        else {
          const d = (new Date(uploaded.expiry_date).getTime() - today.getTime()) / 86400000;
          if (d < 0) { status = 'expired'; exp++; }
          else if (d <= 90) { status = 'warning'; warning++; ok++; }
          else { status = 'ok'; ok++; }
        }
      } else if (req.is_mandatory) miss++;
      return { ...req, uploaded, status };
    });

    return { 
      list, 
      progress: mandatoryTotal > 0 ? Math.round((ok / mandatoryTotal) * 100) : 0, 
      ok, exp, warning, miss 
    };
  }

  const myCertData = useMemo(() => calculateCerts(currentUser || {}, myCerts), [currentUser, myCerts, matrix]);

  const allPositions = useMemo(() => ['All', ...new Set(crews.map(c => c.position))].sort(), [crews]);
  const allCertTypes = useMemo(() => ['All', ...new Set(matrix.map(m => m.cert_name))].sort(), [matrix]);

  // 🎯 แก้ชื่อตัวแปรที่ดึงจาก calculateCerts ให้เป๊ะ
  const crewSummary = useMemo(() => {
    const all = crews.map(c => calculateCerts(c, allCerts.filter(ac => ac.crew_id === c.id)));
    return {
      total: crews.length,
      ready: all.filter(a => a.progress === 100 && a.expired === 0).length,
      warning: all.filter(a => a.warning > 0 && a.expired === 0).length,
      expired: all.filter(a => a.expired > 0).length,
      action: all.filter(a => a.progress < 100 || a.expired > 0).length
    }
  }, [crews, allCerts, matrix]);

  const filteredCrews = useMemo(() => {
    return crews.map(c => ({ ...c, certData: calculateCerts(c, allCerts.filter(ac => ac.crew_id === c.id)) }))
    .filter(c => {
      const matchSearch = c.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPos = filterPos === 'All' || c.position === filterPos;
      
      let matchMode = true;
      if (filterMode === 'ready') matchMode = c.certData.progress === 100 && c.certData.expired === 0;
      if (filterMode === 'warning') matchMode = c.certData.warning > 0 && c.certData.expired === 0;
      if (filterMode === 'expired') matchMode = c.certData.expired > 0;
      if (filterMode === 'action') matchMode = c.certData.progress < 100 || c.certData.expired > 0;

      let matchCert = true;
      if (filterSpecificCert !== 'All') {
        matchCert = c.certData.list.some((cert: any) => normalize(cert.cert_name) === normalize(filterSpecificCert) && cert.uploaded);
      }

      return matchSearch && matchPos && matchMode && matchCert;
    })
  }, [crews, allCerts, matrix, searchTerm, filterMode, filterPos, filterSpecificCert]);

  if (loading || !currentUser) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse">VAULT ACCESSING...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl md:text-5xl font-black italic flex items-center gap-4 tracking-tighter"><ShieldCheck className="text-orange-500" size={36}/> Certificate Hub</h1>
           <p className="text-zinc-500 mt-2 tracking-widest ml-1">Enterprise Compliance Dashboard</p>
        </div>
        
        {isAdmin && (
          <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-white/5 w-fit shadow-2xl">
            <button onClick={() => setActiveTab('personal')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'personal' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}>My Certs</button>
            <button onClick={() => setActiveTab('crew')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'crew' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}>Crew Oversight</button>
            <button onClick={() => setActiveTab('ship')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'ship' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}>Ship Certs</button>
          </div>
        )}
      </div>

      {activeTab === 'personal' && (
        <div className="space-y-6 animate-in fade-in">
           <div className="bg-zinc-900 border border-orange-500/20 p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-8 w-full md:w-auto">
                 <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (myCertData.progress/100)*276} className="text-orange-500 transition-all duration-1000"/></svg>
                    <span className="absolute text-xl font-black">{myCertData.progress}%</span>
                 </div>
                 <div><h2 className="text-2xl font-black italic uppercase">My Compliance</h2><p className="text-zinc-500 mt-1 uppercase text-[10px] tracking-widest">{myCertData.ok} / {myCertData.list.filter(c => c.is_mandatory).length} Mandatory Certs Valid</p></div>
              </div>
           </div>

           <div className="space-y-3">
              {myCertData.list.map((item, idx) => (
                <div key={idx} className={`bg-zinc-900 border ${item.status === 'missing' ? 'border-red-500/20' : item.status === 'optional' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[32px] p-6 flex items-center justify-between group hover:border-orange-500/30 transition-all`}>
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'optional' ? 'bg-slate-800 text-slate-500' : 'bg-red-500/10 text-red-500'}`}>
                      {item.status === 'ok' ? <CheckCircle2 size={24}/> : item.status === 'optional' ? <Clock size={24}/> : <AlertTriangle size={24}/>}
                    </div>
                    <div><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${item.is_mandatory ? 'text-blue-500' : 'text-zinc-600'}`}>{item.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}</p><h3 className="text-white text-sm leading-tight">{item.cert_name}</h3>{item.uploaded && <p className="text-[9px] mt-1 text-blue-500 font-black">Exp: {item.uploaded.expiry_date === '2099-12-31' ? 'Indefinite' : item.uploaded.expiry_date}</p>}</div>
                  </div>
                  <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(item.cert_name)}`)} className="px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-orange-600/20 active:scale-95 transition-all">Upload</button>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'crew' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { id: 'all', label: 'ทั้งหมด', val: crewSummary.total, color: 'border-blue-500', icon: <Users size={20}/> },
                { id: 'ready', label: 'ครบถ้วน', val: crewSummary.ready, color: 'border-emerald-500', icon: <CheckCircle2 size={20}/> },
                { id: 'warning', label: 'ใกล้หมด', val: crewSummary.warning, color: 'border-orange-500', icon: <Clock size={20}/> },
                { id: 'expired', label: 'หมดแล้ว', val: crewSummary.expired, color: 'border-red-500', icon: <AlertTriangle size={20}/> },
                { id: 'action', label: 'ต้องดำเนินการ', val: crewSummary.action, color: 'border-red-600', icon: <XCircle size={20}/> }
              ].map(tile => (
                <button key={tile.id} onClick={() => setFilterMode(tile.id)} className={`bg-zinc-900 border-t-4 ${tile.color} p-6 rounded-3xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-xl ${filterMode === tile.id ? 'opacity-100 ring-2 ring-white/20' : 'opacity-40 hover:opacity-100'}`}>
                   <p className="text-3xl font-black">{tile.val}</p>
                   <p className="text-[9px] mt-2 flex items-center gap-1.5 text-zinc-400">{tile.icon} {tile.label}</p>
                </button>
              ))}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-900/50 p-5 rounded-[32px] border border-white/5">
              <div className="relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input type="text" placeholder="Search crew..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black/50 border border-white/10 p-4 pl-14 rounded-2xl outline-none focus:border-orange-500 text-sm font-bold" /></div>
              <select value={filterPos} onChange={e => setFilterPos(e.target.value)} className="bg-black/50 border border-white/10 p-4 rounded-2xl outline-none text-xs font-black text-blue-400"><option value="All">All Positions</option>{allPositions.map(p => <option key={p} value={p}>{p}</option>)}</select>
              <select value={filterSpecificCert} onChange={e => setFilterSpecificCert(e.target.value)} className="bg-black/50 border border-white/10 p-4 rounded-2xl outline-none text-xs font-black text-orange-400"><option value="All">All Certificates Filter</option>{allCertTypes.map(c => <option key={c} value={c}>{c}</option>)}</select>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCrews.map(crew => (
                <div key={crew.id} className="bg-zinc-900 border border-white/5 p-8 rounded-[40px] space-y-6 hover:border-orange-500/50 transition-all shadow-xl group">
                   <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/5 rounded-3xl flex items-center justify-center text-zinc-600 group-hover:bg-orange-600/10 group-hover:text-orange-500 transition-all"><User size={24}/></div>
                        <div><p className="text-white font-black text-sm uppercase leading-tight truncate max-w-[120px]">{crew.full_name}</p><p className="text-zinc-600 text-[9px] mt-1">{crew.position}</p></div>
                      </div>
                      <div className="text-right"><p className={`text-2xl font-black ${crew.certData.progress === 100 ? 'text-emerald-500' : 'text-orange-500'}`}>{crew.certData.progress}%</p><p className="text-zinc-700 text-[8px] uppercase font-bold tracking-widest mt-1">Ready</p></div>
                   </div>
                   
                   <div className="space-y-3 border-t border-white/5 pt-6">
                      {crew.certData.list.slice(0, 4).map((c:any, i:number) => (
                        <div key={i} className="flex justify-between text-[9px] font-bold pb-2 border-b border-white/5 last:border-0 last:pb-0"><span className="text-zinc-500 uppercase truncate max-w-[160px]">{c.cert_name}</span><span className={c.status==='ok'?'text-emerald-500':c.status==='expired'?'text-red-500':'text-amber-500'}>{c.status.toUpperCase()}</span></div>
                      ))}
                      <button onClick={() => router.push(`/admin/settings?tab=crews&id=${crew.id}`)} className="w-full py-4 mt-4 bg-orange-600/10 text-orange-500 rounded-2xl hover:bg-orange-600 hover:text-white transition-all text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-inner border border-orange-500/20">Manage Full Profile <ChevronRight size={16}/></button>
                   </div>
                </div>
              ))}
           </div>
           {filteredCrews.length === 0 && <div className="py-20 text-center text-zinc-700 font-black uppercase tracking-widest italic">No matching crews found.</div>}
        </div>
      )}

      {activeTab === 'ship' && <div className="py-40 text-center animate-pulse text-zinc-700 font-black italic text-xl">COMING SOON: SHIP CERTIFICATES</div>}
    </div>
  )
}

export default function CertificatesPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
