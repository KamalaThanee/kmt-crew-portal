'use client'
import { User, useState, useEffect, useMemo, Suspense } from 'react'
import { User, useRouter, useSearchParams } from 'next/navigation'
import { User, supabase } from '@/lib/supabase'
import { User, toast } from 'sonner'
import { User, 
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
  
  // 🎯 State สำหรับจัดการการย่อขยายรายชื่อลูกเรือ
  const [expandedCrews, setExpandedCrews] = useState<string[]>([]);

  const [editingCrew, setEditingCrew] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
  const smartSort = (arr: any[]) => {
    return [...arr].sort((a, b) => {
      const getNum = (s: string) => { const match = String(s).match(/\d+/); return match ? parseInt(match[0]) : null; };
      const numA = getNum(a); const numB = getNum(b);
      if (numA !== null && numB !== null) return numA - numB;
      const idxA = sizeOrder.indexOf(String(a).toUpperCase()); const idxB = sizeOrder.indexOf(String(b).toUpperCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return String(a).localeCompare(String(b));
    });
  }

  const fetchData = async () => {
    const [stRes, invRes, crewRes, mxRes, ccRes, ruRes] = await Promise.all([
      supabase.from('ppe_settings').select('*').eq('id', 1).single(),
      supabase.from('ppe_inventory').select('*').order('item_name'),
      supabase.from('crews').select('*').order('full_name'),
      supabase.from('cert_matrix').select('*'),
      supabase.from('crew_certs').select('*'),
      supabase.from('cert_rules').select('*')
    ]);

    if (stRes.data) setSizeCharts({ suit: stRes.data.suit_chart_url || '', boot: stRes.data.boot_url || '' });
    if (invRes.data) setInventory(invRes.data);
    if (crewRes.data) setCrews(crewRes.data);
    if (mxRes.data) setCertMatrix(mxRes.data);
    if (ccRes.data) setAllCrewCerts(ccRes.data);
    if (ruRes.data) setRules(ruRes.data);
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

  const allCategories = useMemo(() => {
    const dbCats = inventory.map(i => i.category).filter(Boolean);
    return [...new Set(['Other', ...dbCats])].sort();
  }, [inventory]);

  const generateNextCode = (catName: string) => {
    const catItems = inventory.filter(i => i.category === catName);
    const numbers = catItems.map(i => {
      const match = String(i.item_id_code).match(/\d+$/);
      return match ? parseInt(match[0]) : 0;
    });
    return `${catName}-${numbers.length > 0 ? Math.max(...numbers) + 1 : 1}`;
  };

  const filteredInventoryGrouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const filtered = inventory.filter(i => {
      const matchesSearch = i.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.item_id_code || "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
    filtered.forEach(item => {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [inventory, searchTerm]);

  // 🎯 คำนวณความพร้อมของใบเซอร์รายบุคคล
  const getCrewCertDetails = (crew: any) => {
    if (!certMatrix.length) return { progress: 0, expired: 0, warning: 0, list: [] };
    const crewPosNorm = normalize(crew.position);
    
    let required = certMatrix.filter(row => normalize(row.position) === crewPosNorm && row.requirement_type === 'P').map(m => ({ ...m, is_mandatory: true }));
    const crewCerts = allCrewCerts.filter(c => String(c.crew_id) === String(crew.id));
    const optionals = certMatrix.filter(row => normalize(row.position) === crewPosNorm && row.requirement_type === 'O');
    
    optionals.forEach(oc => { if (crewCerts.some(c => normalize(c.cert_name) === normalize(oc.cert_name))) { required.push({ ...oc, is_mandatory: false }); } });
    
    (rules || []).forEach(rule => {
      if (crewCerts.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))) {
        if (!required.some(req => normalize(req.cert_name) === normalize(rule.required_cert))) { required.push({ cert_name: rule.required_cert, is_mandatory: true, category: 'Triggered' }); }
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
      total: crews.length, ok: all.filter(c => c.progress === 100 && c.expired === 0).length,
      warning: all.filter(c => c.warning > 0 && c.expired === 0).length,
      action: all.filter(c => c.progress < 100 || c.expired > 0).length,
      days90: all.filter(c => c.warning > 0).length, expired: all.filter(c => c.expired > 0).length
    };
  }, [crews, certMatrix, allCrewCerts, rules]);

  const allUniqueCerts = useMemo(() => [...new Set(certMatrix.map(m => m.cert_name))].sort(), [certMatrix]);

  const handleUpdateCrew = async () => {
    if (!editingCrew) return;
    const { error } = await supabase.from('crews').update({
      full_name: editingCrew.full_name, position: editingCrew.position, suit_size: editingCrew.suit_size, boot_size: editingCrew.boot_size
    }).eq('id', editingCrew.id);
    if (!error) { toast.success('Profile Updated'); setIsEditCrewOpen(false); fetchData(); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse uppercase">Loading Admin Center...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32 pt-24 px-4 md:px-12 uppercase font-bold text-[10px]">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-black italic flex items-center gap-3"><Settings className="text-orange-500"/> Admin Center</h1>
          <button onClick={() => router.push('/admin/dashboard')} className="p-3 bg-white/5 rounded-full hover:bg-red-500 transition-all"><X/></button>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="w-full lg:w-64 space-y-3 shrink-0">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setSearchTerm(''); }} className={`w-full flex items-center gap-4 p-5 rounded-[24px] transition-all border ${activeTab === t ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-600/20' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-orange-400'}`}>
                {t === 'inventory' ? <Package size={20}/> : t === 'crews' ? <Users size={20}/> : <SlidersHorizontal size={20}/>} <span className="text-xs">{t} Master</span>
              </button>
            ))}
          </div>

          <div className="flex-1 bg-zinc-900/50 border border-white/5 rounded-[48px] p-6 md:p-8 shadow-inner min-h-[70vh]">
            
            {/* 🎯 TAB: CREW MASTER (Accordion Design) */}
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-8">
                <h2 className="text-2xl font-black italic text-white mb-4 uppercase tracking-tighter">Crew Master</h2>
                
                {/* 6-Tile Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                   {[
                     { id: 'all', label: 'ทั้งหมด', val: crewSummary.total, color: 'border-blue-500', text: 'text-blue-500' },
                     { id: 'ok', label: 'ครบถ้วน', val: crewSummary.ok, color: 'border-emerald-500', text: 'text-emerald-500' },
                     { id: 'warning', label: 'ใกล้หมด', val: crewSummary.warning, color: 'border-orange-500', text: 'text-orange-500' },
                     { id: 'action', label: 'ต้องดำเนินการ', val: crewSummary.action, color: 'border-red-600', text: 'text-red-500' },
                     { id: '90days', label: '90 วัน', val: crewSummary.days90, color: 'border-amber-400', text: 'text-amber-500' },
                     { id: 'expired', label: 'หมดแล้ว', val: crewSummary.expired, color: 'border-red-500', text: 'text-red-500' }
                   ].map(tile => (
                     <button key={tile.id} onClick={() => setFilterMode(tile.id)} className={`bg-black/30 p-5 rounded-3xl border-t-4 ${tile.color} shadow-lg flex flex-col items-center transition-all ${filterMode === tile.id ? 'bg-zinc-800' : 'opacity-70 hover:opacity-100'}`}>
                        <p className={`text-3xl font-black ${tile.text}`}>{tile.val}</p>
                        <p className="text-[10px] font-bold text-zinc-500 mt-2 uppercase">{tile.label}</p>
                     </button>
                   ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input type="text" placeholder="Search crew name..." className="w-full bg-black/50 border border-white/10 p-5 pl-12 rounded-[24px] outline-none text-sm font-bold text-white focus:border-orange-500" onChange={(e) => setSearchTerm(e.target.value)} /></div>
                  <select className="w-full bg-black/50 border border-white/10 p-5 rounded-[24px] outline-none text-orange-500 font-black" value={filterCert} onChange={(e) => setFilterCert(e.target.value)}><option value="all">🔍 Filter by Certificate...</option>{allUniqueCerts.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>

                {/* 🎯 Accordion Crew List */}
                <div className="space-y-4">
                  {enhancedCrews.map(crew => {
                    const isExpanded = expandedCrews.includes(crew.id);
                    const pColor = crew.certData.progress === 100 ? 'bg-emerald-500' : crew.certData.expired > 0 ? 'bg-red-500' : 'bg-orange-500';
                    const bColor = crew.certData.progress === 100 ? 'border-emerald-500/50' : crew.certData.expired > 0 ? 'border-red-500/50' : 'border-orange-500/50';

                    return (
                      <div key={crew.id} className={`bg-zinc-900 border rounded-[32px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-orange-500/50 shadow-2xl' : 'border-white/5 hover:border-white/20'}`}>
                        
                        {/* 🎯 Header Bar */}
                        <button onClick={() => setExpandedCrews(prev => prev.includes(crew.id) ? prev.filter(id => id !== crew.id) : [...prev, crew.id])} className="w-full p-6 flex flex-col outline-none">
                           <div className="w-full flex justify-between items-center mb-3">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-zinc-500"><User size={20}/></div>
                                <div className="text-left"><p className="font-black text-sm text-white uppercase">{crew.full_name}</p><p className="text-[10px] text-zinc-500 tracking-widest mt-1">{crew.position}</p></div>
                              </div>
                              <div className="flex items-center gap-4">
                                 <div className="text-right hidden md:block"><p className={`text-xl font-black ${pColor.replace('bg-', 'text-')}`}>{crew.certData.progress}%</p><p className="text-[8px] text-zinc-600 uppercase">Readiness</p></div>
                                 <div className={`px-3 py-1 rounded text-[8px] font-black uppercase ${crew.certData.progress === 100 ? 'bg-emerald-500/20 text-emerald-500' : crew.certData.expired > 0 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-amber-500/20 text-amber-500'}`}>
                                    {crew.certData.progress === 100 ? '✅ Ready' : crew.certData.expired > 0 ? '🚨 Action Required' : '⚠️ Pending'}
                                 </div>
                                 {isExpanded ? <ChevronDown className="text-orange-500" size={24}/> : <ChevronRight className="text-zinc-600" size={24}/>}
                              </div>
                           </div>
                           
                           {/* 🎯 Progress Bar Line */}
                           <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
                              <div className={`${pColor} h-full transition-all duration-1000`} style={{ width: `${crew.certData.progress}%` }}></div>
                           </div>
                        </button>

                        {/* 🎯 Expanded Content (Cert Grid) */}
                        {isExpanded && (
                          <div className="p-6 pt-0 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-4">
                             <div className="flex justify-between items-center py-4">
                                <p className="text-zinc-500 text-[10px] tracking-widest">Total Certificates: {crew.certData.list.length}</p>
                                <button onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }} className="px-4 py-2 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 text-[9px]"><Edit size={12}/> Edit Profile</button>
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {crew.certData.list.map((cert: any, i: number) => (
                                 <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border-l-4 bg-zinc-900/50 border-y border-r border-y-white/5 border-r-white/5 ${cert.status === 'ok' ? 'border-l-emerald-500' : cert.status === 'expired' ? 'border-l-red-500' : cert.status === 'warning' ? 'border-l-amber-500' : 'border-l-slate-600'}`}>
                                    <div className="flex items-center gap-4">
                                       <div className={`p-2 rounded-xl ${cert.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : cert.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : cert.status === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
                                          {cert.status === 'missing' ? <AlertTriangle size={18}/> : cert.status === 'expired' ? <XCircle size={18}/> : cert.status === 'optional' ? <Clock size={18}/> : <FileCheck size={18}/>}
                                       </div>
                                       <div>
                                          <p className="text-white text-[10px] leading-tight font-black">{cert.cert_name}</p>
                                          <p className={`text-[8px] mt-1 uppercase ${cert.status === 'ok' ? 'text-emerald-500' : cert.status === 'expired' ? 'text-red-500' : 'text-slate-500'}`}>
                                             {cert.status === 'missing' ? 'Missing Document' : cert.uploaded ? `Exp: ${cert.uploaded.expiry_date === '2099-12-31' ? 'N/A' : cert.uploaded.expiry_date}` : 'Optional'}
                                          </p>
                                       </div>
                                    </div>
                                    <div className="flex gap-2">
                                       {cert.uploaded ? (
                                         <>
                                           <a href={cert.uploaded.file_url} target="_blank" className="p-2 bg-white/5 rounded-lg text-blue-400 hover:text-white transition-all"><Eye size={14}/></a>
                                           <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(cert.cert_name)}&crewId=${crew.id}`)} className="px-3 py-2 bg-orange-600/10 text-orange-500 rounded-lg hover:bg-orange-600 hover:text-white transition-all">Update</button>
                                         </>
                                       ) : (
                                         <button onClick={() => router.push(`/certificates/upload?cert=${encodeURIComponent(cert.cert_name)}&crewId=${crew.id}`)} className="px-4 py-2 bg-orange-600 text-white rounded-lg shadow-lg active:scale-90">Upload</button>
                                       )}
                                    </div>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {activeTab === 'inventory' && <div className="py-20 text-center text-slate-500">Inventory Module Active</div>}
            {activeTab === 'system' && <div className="py-20 text-center text-slate-500">System Configuration Active</div>}
          </div>
        </div>
      </div>

      {/* MODAL: EDIT CREW PROFILE (Only Profile, no certs here anymore) */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in">
          <div className="bg-zinc-900 border border-white/10 rounded-[48px] w-full max-w-lg p-10 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-6 mb-6 text-orange-500"><h2 className="text-xl font-black italic uppercase">Edit Profile</h2><button onClick={() => setIsEditCrewOpen(false)} className="p-2 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all"><X size={20}/></button></div>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[9px] text-zinc-500">Full Name</label><input className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white" value={editingCrew.full_name} onChange={e => setEditingCrew({...editingCrew, full_name: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[9px] text-zinc-500">Position</label><input className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white" value={editingCrew.position} onChange={e => setEditingCrew({...editingCrew, position: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[9px] text-blue-500">Suit Size</label><input className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white" value={editingCrew.suit_size || '-'} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[9px] text-blue-500">Boot Size</label><input className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white" value={editingCrew.boot_size || '-'} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}/></div>
              <div className="flex gap-3 pt-4">
                 <button onClick={handleUpdateCrew} className="flex-1 py-4 bg-orange-600 rounded-2xl font-black shadow-lg"><Save size={16} className="inline mr-2"/> Save</button>
                 <button onClick={() => handleResetPin(editingCrew.id, editingCrew.full_name)} className="flex-1 py-4 bg-zinc-800 border border-white/5 rounded-2xl font-black hover:bg-red-600 transition-all"><RefreshCw size={16} className="inline mr-2"/> Reset PIN</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminSettingsPage() { return ( <Suspense fallback={<div>Loading...</div>}><SettingsContent /></Suspense> ) }
