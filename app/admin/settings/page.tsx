'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, Search, FileCheck, Clock, Eye, CheckCircle2,
  Loader2, Upload, Edit, RefreshCw, X, Save, AlertTriangle, Box, Plus, ChevronDown, ChevronRight, XCircle
} from 'lucide-react'
import imageCompression from 'browser-image-compression'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('crews');
  const [uploading, setUploading] = useState({ suit: false, boot: false });
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' });
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [crews, setCrews] = useState<any[]>([]);
  const [certMatrix, setCertMatrix] = useState<any[]>([]);
  const [allCrewCerts, setAllCrewCerts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterCert, setFilterCert] = useState('all');

  const [editingCrew, setEditingCrew] = useState<any>(null);
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false);

  const fetchData = async () => {
    const [settingsRes, invRes, crewRes, matrixRes, certsRes, rulesRes] = await Promise.all([
      supabase.from('ppe_settings').select('*').eq('id', 1).single(),
      supabase.from('ppe_inventory').select('*').order('item_name'),
      supabase.from('crews').select('*').order('full_name'),
      supabase.from('cert_matrix').select('*'),
      supabase.from('crew_certs').select('*'),
      supabase.from('cert_rules').select('*')
    ]);

    if (settingsRes.data) setSizeCharts({ suit: settingsRes.data.suit_chart_url || '', boot: settingsRes.data.boot_url || '' });
    if (invRes.data) setInventory(invRes.data);
    if (crewRes.data) setCrews(crewRes.data);
    if (matrixRes.data) setCertMatrix(matrixRes.data);
    if (certsRes.data) setAllCrewCerts(certsRes.data);
    if (rulesRes.data) setRules(rulesRes.data);
    setLoading(false);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user');
      if (!userStr) { router.replace('/login'); return; }
      const user = JSON.parse(userStr);
      const adminRoles = ["safety officer", "chief officer", "barge master"];
      if (!adminRoles.includes((user.position || "").toLowerCase())) { router.replace('/ppe'); return; }
      await fetchData();
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['inventory', 'crews', 'system'].includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  const getCrewCertDetails = (crew: any) => {
    if (!certMatrix.length) return { progress: 0, expired: 0, warning: 0, list: [] };
    const crewPosNorm = normalize(crew.position);
    
    // 🎯 1. ดึงทั้ง P และ O มาทำรายการ
    let required = certMatrix.filter(row => normalize(row.position) === crewPosNorm && (row.requirement_type === 'P' || row.requirement_type === 'O'))
      .map(m => ({ ...m, is_mandatory: m.requirement_type === 'P' }));

    const crewCerts = allCrewCerts.filter(c => String(c.crew_id) === String(crew.id));
    
    // 🎯 2. Trigger Rules Logic
    (rules || []).forEach(rule => {
      if (crewCerts.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))) {
        const idx = required.findIndex(req => normalize(req.cert_name) === normalize(rule.required_cert));
        if (idx === -1) {
          required.push({ cert_name: rule.required_cert, is_mandatory: true, category: 'Triggered' });
        } else {
          required[idx].is_mandatory = true;
        }
      }
    });

    const today = new Date();
    let okCount = 0; let expiredCount = 0; let warningCount = 0; let mandatoryCount = 0;
    
    const detailedList = required.map(req => {
      if (req.is_mandatory) mandatoryCount++;
      const uploaded = crewCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name));
      let status = req.is_mandatory ? 'missing' : 'optional';
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; okCount++; }
        else {
          const expDate = new Date(uploaded.expiry_date);
          const diff = (expDate.getTime() - today.getTime())/86400000;
          if (diff < 0) { status = 'expired'; expiredCount++; }
          else if (diff <= 90) { status = 'warning'; warningCount++; okCount++; }
          else { status = 'ok'; okCount++; }
        }
      }
      return { ...req, uploaded, status };
    });

    // Progress คิดจากใบ Mandatory เท่านั้น
    const progress = mandatoryCount > 0 ? Math.round((okCount / mandatoryCount) * 100) : 0;
    return { progress: Math.min(progress, 100), expired: expiredCount, warning: warningCount, list: detailedList };
  };

  const enhancedCrews = useMemo(() => {
    return crews.map(crew => ({ ...crew, certData: getCrewCertDetails(crew) }))
    .filter(crew => {
      const matchesSearch = crew.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filterCert !== 'all') {
        if (!crew.certData.list.some((c:any) => normalize(c.cert_name) === normalize(filterCert) && c.status !== 'missing' && c.status !== 'optional')) return false;
      }
      if (filterMode === 'all') return true;
      if (filterMode === 'ok') return crew.certData.progress === 100 && crew.certData.expired === 0;
      if (filterMode === 'warning') return crew.certData.warning > 0 && crew.certData.expired === 0;
      if (filterMode === 'action') return crew.certData.progress < 100 || crew.certData.expired > 0;
      if (filterMode === '90days') return crew.certData.warning > 0;
      if (filterMode === 'expired') return crew.certData.expired > 0;
      return true;
    });
  }, [crews, searchTerm, filterMode, filterCert, certMatrix, allCrewCerts, rules]);

  const crewSummary = useMemo(() => {
    const all = crews.map(c => getCrewCertDetails(c));
    return {
      total: crews.length,
      ok: all.filter(c => c.progress === 100 && c.expired === 0).length,
      warning: all.filter(c => c.warning > 0 && c.expired === 0).length,
      action: all.filter(c => c.progress < 100 || c.expired > 0).length,
      days90: all.filter(c => c.warning > 0).length,
      expired: all.filter(c => c.expired > 0).length
    };
  }, [crews, certMatrix, allCrewCerts, rules]);

  const allUniqueCerts = useMemo(() => [...new Set(certMatrix.map(m => m.cert_name))].sort(), [certMatrix]);

  const handleUpdateCrew = async () => {
    if (!editingCrew) return;
    const { error } = await supabase.from('crews').update({
      full_name: editingCrew.full_name, suit_size: editingCrew.suit_size, boot_size: editingCrew.boot_size
    }).eq('id', editingCrew.id);
    if (!error) { toast.success('Updated'); setIsEditCrewOpen(false); fetchData(); }
  };

  const handleResetPin = async (id: string, name: string) => {
    if (confirm(`Reset PIN for ${name}?`)) {
      await supabase.from('crews').update({ pin: null, registered: false }).eq('id', id);
      fetchData(); toast.success('PIN Reset');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8 text-[10px] uppercase font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-black italic flex items-center gap-3"><Settings className="text-blue-500"/> Admin Panel</h1>
          <button onClick={() => router.push('/admin/dashboard')} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><X/></button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}>
                {t === 'inventory' ? <Package size={18}/> : t === 'crews' ? <Users size={18}/> : <SlidersHorizontal size={18}/>} {t} Master
              </button>
            ))}
          </div>

          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 md:p-8 shadow-2xl min-h-[60vh]">
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-8">
                <h2 className="text-xl font-black italic text-white mb-4">Crew Master</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                   {[
                     { id: 'all', label: 'ทั้งหมด', val: crewSummary.total, color: 'border-blue-500', text: 'text-blue-500' },
                     { id: 'ok', label: 'ครบถ้วน', val: crewSummary.ok, color: 'border-emerald-500', text: 'text-emerald-500' },
                     { id: 'warning', label: 'ใกล้หมด', val: crewSummary.warning, color: 'border-orange-500', text: 'text-orange-500' },
                     { id: 'action', label: 'ต้องดำเนินการ', val: crewSummary.action, color: 'border-red-600', text: 'text-red-500' },
                     { id: '90days', label: '90 วัน', val: crewSummary.days90, color: 'border-amber-400', text: 'text-amber-500' },
                     { id: 'expired', label: 'หมดแล้ว', val: crewSummary.expired, color: 'border-red-500', text: 'text-red-500' }
                   ].map(tile => (
                     <button key={tile.id} onClick={() => setFilterMode(tile.id)} className={`bg-black/30 p-4 rounded-2xl border-t-4 ${tile.color} shadow-lg flex flex-col items-center justify-center transition-all active:scale-95 ${filterMode === tile.id ? 'bg-white/10 ring-2 ring-white/20' : 'hover:bg-white/5'}`}>
                        <p className={`text-2xl font-black ${tile.text}`}>{tile.val}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 whitespace-nowrap">{tile.label}</p>
                     </button>
                   ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                    <input type="text" placeholder="Search crew name..." className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <select className="w-full bg-black/50 border border-white/10 p-4 rounded-[24px] outline-none text-blue-400 font-bold" value={filterCert} onChange={(e) => setFilterCert(e.target.value)}>
                     <option value="all">🔍 Filter by Certificate...</option>
                     {allUniqueCerts.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-3">
                  {enhancedCrews.map(crew => (
                    <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group transition-all hover:border-blue-500/50" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                      <div className="flex-1 flex items-center gap-4 cursor-pointer">
                        <div className="relative w-12 h-12 shrink-0">
                           <svg className="w-full h-full transform -rotate-90"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5"/><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="125" strokeDashoffset={125 - (crew.certData.progress/100)*125} className={crew.certData.progress === 100 ? 'text-emerald-500' : 'text-amber-500'}/></svg>
                           <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black">{crew.certData.progress}%</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">{crew.full_name} {crew.certData.expired > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[8px] animate-pulse">EXP</span>}</p>
                          <p className="text-[9px] text-slate-500 tracking-widest mt-1">{crew.position}</p>
                        </div>
                      </div>
                      <ChevronRight className="text-slate-700 group-hover:text-blue-500"/>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'inventory' && <div className="py-20 text-center text-slate-500 font-black">Inventory Section Active</div>}
            {activeTab === 'system' && <div className="py-20 text-center text-slate-500 font-black">System Configuration Active</div>}
          </div>
        </div>
      </div>

      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 p-8 shrink-0">
               <h2 className="text-xl font-black italic">{editingCrew.full_name}</h2>
               <button onClick={() => setIsEditCrewOpen(false)}><X size={24}/></button>
            </div>
            <div className="overflow-y-auto p-8 space-y-8 flex-1">
               <div className="space-y-4">
                  <h3 className="text-blue-500 tracking-widest border-b border-white/5 pb-2">Profile Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-white">
                    <div className="col-span-2 space-y-1"><label className="text-slate-500">Position</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10" value={editingCrew.position} readOnly /></div>
                    <div className="space-y-1"><label className="text-slate-500">Suit Size</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10" value={editingCrew.suit_size || '-'} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}/></div>
                    <div className="space-y-1"><label className="text-slate-500">Boot Size</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10" value={editingCrew.boot_size || '-'} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}/></div>
                  </div>
                  <div className="flex gap-3">
                     <button onClick={handleUpdateCrew} className="flex-1 py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all"><Save size={14} className="inline mr-2"/> Save Profile</button>
                     <button onClick={() => handleResetPin(editingCrew.id, editingCrew.full_name)} className="px-6 py-4 bg-amber-500/10 text-amber-500 rounded-2xl font-black uppercase text-[10px] border border-amber-500/20"><RefreshCw size={14}/></button>
                  </div>
               </div>
               <div className="space-y-4">
                  <h3 className="text-purple-500 tracking-widest border-b border-white/5 pb-2 flex justify-between items-center uppercase">Certificates <span>{editingCrew.certData.progress}%</span></h3>
                  <div className="space-y-2 pb-10">
                     {editingCrew.certData.list.map((cert: any, idx: number) => (
                        <div key={idx} className={`flex justify-between items-center bg-black/30 p-4 rounded-xl border border-white/5 ${cert.status === 'optional' ? 'opacity-40' : ''}`}>
                           <div className="flex items-center gap-3">
                              {cert.status === 'ok' ? <CheckCircle2 size={16} className="text-emerald-500"/> : cert.status === 'warning' ? <Clock size={16} className="text-amber-500"/> : cert.status === 'expired' ? <AlertTriangle size={16} className="text-red-500"/> : cert.status === 'optional' ? <Clock size={16} className="text-slate-600"/> : <XCircle size={16} className="text-slate-600"/>}
                              <div>
                                 <p className="text-white text-[10px] leading-tight flex items-center gap-2">{cert.cert_name} <span className="text-[7px] opacity-50">{cert.is_mandatory ? '(M)' : '(O)'}</span></p>
                                 <p className={`text-[8px] mt-0.5 ${cert.status === 'ok' ? 'text-emerald-500' : cert.status === 'expired' ? 'text-red-500' : 'text-slate-500'}`}>{cert.uploaded ? `Exp: ${cert.uploaded.expiry_date === '2099-12-31' ? 'N/A' : cert.uploaded.expiry_date}` : 'Missing'}</p>
                              </div>
                           </div>
                           {cert.uploaded && <a href={cert.uploaded.file_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-lg text-blue-400 hover:bg-blue-600 hover:text-white transition-all"><Eye size={14}/></a>}
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminSettingsPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><SettingsContent /></Suspense> )
}
