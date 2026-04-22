'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Settings, Users, SlidersHorizontal, Search, FileCheck, Clock, Eye, CheckCircle2, Loader2, Upload, RefreshCw, X, Save, AlertTriangle, XCircle } from 'lucide-react'
import imageCompression from 'browser-image-compression'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('crews')
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  const [inventory, setInventory] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  const [certMatrix, setCertMatrix] = useState<any[]>([])
  const [allCrewCerts, setAllCrewCerts] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState('all') 
  const [filterCert, setFilterCert] = useState('all') 
  const [editingCrew, setEditingCrew] = useState<any>(null)
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false)

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
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
    if (tab && ['crews', 'system'].includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  const suitColors = useMemo(() => [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].filter(Boolean).sort(), [inventory])
  const suitSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))].filter(Boolean)), [inventory])
  const bootSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))].filter(Boolean)), [inventory])

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
    let okCount = 0; let expiredCount = 0; let warningCount = 0;
    const detailedList = required.map(req => {
      const uploaded = crewCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name));
      let status = 'missing';
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; okCount++; }
        else {
          const expDate = new Date(uploaded.expiry_date); const diff = (expDate.getTime() - today.getTime())/86400000;
          if (diff < 0) { status = 'expired'; expiredCount++; } else if (diff <= 90) { status = 'warning'; warningCount++; okCount++; } else { status = 'ok'; okCount++; }
        }
      }
      return { ...req, uploaded, status };
    });
    const progress = required.length > 0 ? Math.round((okCount / required.length) * 100) : 0;
    return { progress, expired: expiredCount, warning: warningCount, list: detailedList };
  };

  const enhancedCrews = useMemo(() => {
    return crews.map(crew => ({ ...crew, certData: getCrewCertDetails(crew) }))
    .filter(crew => {
      const matchesSearch = crew.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filterCert !== 'all') { if (!crew.certData.list.some((c:any) => normalize(c.cert_name) === normalize(filterCert) && c.status !== 'missing')) return false; }
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
    const { error } = await supabase.from('crews').update({
      full_name: editingCrew.full_name, position: editingCrew.position, suit_size: editingCrew.suit_size, suit_color: editingCrew.suit_color, boot_size: editingCrew.boot_size
    }).eq('id', editingCrew.id);
    if (!error) { toast.success('Updated'); setIsEditCrewOpen(false); fetchData(); }
  };

  const handleResetPin = async (id: string, name: string) => {
    if (confirm(`Reset PIN for ${name}?`)) {
      await supabase.from('crews').update({ pin: null, registered: false }).eq('id', id);
      fetchData(); toast.success('PIN Reset');
    }
  };

  const handleUpload = async (type: 'suit' | 'boot', file: File) => {
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 });
      const fileName = `${type}_chart_${Date.now()}.jpg`;
      await supabase.storage.from('size-charts').upload(fileName, compressedFile);
      const { data: { publicUrl } } = supabase.storage.from('size-charts').getPublicUrl(fileName);
      await supabase.from('ppe_settings').update({ [type === 'suit' ? 'suit_chart_url' : 'boot_url']: publicUrl }).eq('id', 1);
      setSizeCharts(prev => ({ ...prev, [type]: publicUrl }));
      toast.success('Updated');
    } finally { setUploading(prev => ({ ...prev, [type]: false })); }
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse">LOADING...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32 pt-24 px-4 md:px-12 uppercase font-bold text-[10px]">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-8 flex justify-between items-center"><h1 className="text-3xl font-black italic flex items-center gap-3"><Settings className="text-orange-500"/> Admin Center</h1><button onClick={() => router.push('/admin/dashboard')} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><X/></button></div>
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="w-full lg:w-64 space-y-3 shrink-0">
            {['crews', 'system'].map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setSearchTerm(''); }} className={`w-full flex items-center gap-4 p-5 rounded-[24px] transition-all border ${activeTab === t ? 'bg-orange-600 border-orange-400 text-white shadow-lg' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-orange-400'}`}>
                {t === 'crews' ? <Users size={20}/> : <SlidersHorizontal size={20}/>} <span className="text-xs">{t} Master</span>
              </button>
            ))}
          </div>

          <div className="flex-1 bg-zinc-900/50 border border-white/5 rounded-[48px] p-8 shadow-inner min-h-[70vh]">
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-8">
                <h2 className="text-2xl font-black italic text-white mb-4">Crew Master</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                   {[
                     { id: 'all', label: 'ทั้งหมด', val: crewSummary.total, color: 'border-blue-500', text: 'text-blue-500' },
                     { id: 'ok', label: 'ครบถ้วน', val: crewSummary.ok, color: 'border-emerald-500', text: 'text-emerald-500' },
                     { id: 'warning', label: 'ใกล้หมด', val: crewSummary.warning, color: 'border-orange-500', text: 'text-orange-500' },
                     { id: 'action', label: 'ต้องดำเนินการ', val: crewSummary.action, color: 'border-red-600', text: 'text-red-500' },
                     { id: '90days', label: '90 วัน', val: crewSummary.days90, color: 'border-amber-400', text: 'text-amber-500' },
                     { id: 'expired', label: 'หมดแล้ว', val: crewSummary.expired, color: 'border-red-500', text: 'text-red-500' }
                   ].map(tile => (
                     <button key={tile.id} onClick={() => setFilterMode(tile.id)} className={`bg-black/30 p-5 rounded-3xl border-t-4 ${tile.color} shadow-lg flex flex-col items-center transition-all ${filterMode === tile.id ? 'bg-zinc-800' : 'opacity-70'}`}>
                        <p className={`text-3xl font-black ${tile.text}`}>{tile.val}</p>
                        <p className="text-[10px] font-bold text-zinc-500 mt-2">{tile.label}</p>
                     </button>
                   ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input type="text" placeholder="Search name..." className="w-full bg-black/50 border border-white/10 p-5 pl-12 rounded-[24px] outline-none focus:border-orange-500 text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} /></div>
                  <select className="w-full bg-black/50 border border-orange-500/30 p-5 rounded-[24px] outline-none text-orange-500 font-black" value={filterCert} onChange={(e) => setFilterCert(e.target.value)}><option value="all">🔍 Filter by Certificate...</option>{allUniqueCerts.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>
                <div className="space-y-4">
                  {enhancedCrews.map(crew => (
                    <div key={crew.id} className="flex justify-between items-center bg-black/40 p-6 rounded-[32px] border border-white/5 hover:border-orange-500/50 transition-all cursor-pointer group" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                      <div className="flex items-center gap-6"><div className="relative w-16 h-16"><svg className="w-full h-full transform -rotate-90"><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-white/5"/><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray="176" strokeDashoffset={176 - (crew.certData.progress/100)*176} className={crew.certData.progress === 100 ? 'text-emerald-500' : 'text-orange-500'}/></svg><span className="absolute inset-0 flex items-center justify-center text-xs font-black">{crew.certData.progress}%</span></div>
                      <div><p className="font-bold text-lg text-white group-hover:text-orange-500">{crew.full_name} {crew.certData.expired > 0 && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[9px] ml-2 animate-pulse">EXP {crew.certData.expired}</span>}</p><p className="text-xs text-zinc-500 mt-1">{crew.position}</p></div></div>
                      <ChevronRight size={24} className="text-zinc-800 group-hover:text-orange-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'system' && (
              <div className="animate-in fade-in grid grid-cols-1 md:grid-cols-2 gap-10">
                {['suit', 'boot'].map(type => (
                  <div key={type} className="p-10 bg-black/40 rounded-[48px] border border-white/5 text-center space-y-6">
                    <p className="text-zinc-500 tracking-widest text-xs font-black uppercase">{type === 'suit' ? 'Boiler Suit Chart' : 'Safety Boot Chart'}</p>
                    <div className="w-full h-72 bg-zinc-950 rounded-[40px] flex items-center justify-center overflow-hidden border border-white/5 shadow-inner">{sizeCharts[type as 'suit' | 'boot'] ? <img src={sizeCharts[type as 'suit' | 'boot']} className="max-w-full max-h-full object-contain" /> : <p className="text-zinc-800 italic uppercase font-black text-xl">No Image</p>}</div>
                    <label className="flex items-center justify-center w-full py-5 bg-orange-600 rounded-3xl cursor-pointer hover:bg-orange-500 text-white font-black text-xs uppercase shadow-xl transition-all active:scale-95"><Upload size={20} className="mr-3"/> Update Chart Image<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(type as 'suit' | 'boot', e.target.files[0])} /></label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🛠️ MODAL: CREW PROFILE & CERTS */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in">
          <div className="bg-zinc-900 border border-white/10 rounded-[48px] w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 p-10 shrink-0"><h2 className="text-3xl font-black italic uppercase text-orange-500">{editingCrew.full_name}</h2><button onClick={() => setIsEditCrewOpen(false)} className="p-3 bg-white/5 rounded-full hover:bg-orange-600"><X size={32}/></button></div>
            <div className="overflow-y-auto p-10 space-y-12 flex-1 no-scrollbar">
               <div className="space-y-6">
                  <h3 className="text-blue-500 text-sm font-black uppercase tracking-widest border-b border-white/5 pb-3">Personnel Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
                    <div className="space-y-2"><label className="text-zinc-600 font-bold uppercase text-[9px]">Position</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl text-orange-500 font-black italic" value={editingCrew.position} readOnly /></div>
                    <div className="space-y-2"><label className="text-zinc-600 font-bold uppercase text-[9px]">PIN Number</label><div className="w-full bg-black border border-white/5 p-5 rounded-2xl text-zinc-700 italic font-black">••••••</div></div>
                    <div className="space-y-2"><label className="text-zinc-600 font-bold uppercase text-[9px]">Boiler Suit Size</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold uppercase text-xs" value={editingCrew.suit_size || ''} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}><option value="">-- Size --</option>{suitSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="space-y-2"><label className="text-zinc-600 font-bold uppercase text-[9px]">Safety Boot Size</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold uppercase text-xs" value={editingCrew.boot_size || ''} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}><option value="">-- Size --</option>{bootSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  </div>
                  <div className="flex gap-4 pt-4">
                     <button onClick={handleUpdateCrew} className="flex-1 py-5 bg-orange-600 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={18}/> Update Member</button>
                     <button onClick={() => handleResetPin(editingCrew.id, editingCrew.full_name)} className="px-8 py-5 bg-zinc-800 border border-white/5 rounded-3xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-600 transition-all"><RefreshCw size={18}/> Reset PIN</button>
                  </div>
               </div>
               <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3"><h3 className="text-purple-500 text-sm font-black uppercase tracking-widest">Compliance Status</h3><span className="px-4 py-2 bg-purple-500/10 text-purple-400 rounded-2xl font-black text-xs">Readiness {editingCrew.certData.progress}%</span></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
                     {editingCrew.certData.list.map((cert: any, idx: number) => (
                        <div key={idx} className={`flex justify-between items-center bg-black/40 p-5 rounded-3xl border border-white/5 ${cert.status === 'optional' ? 'opacity-30' : ''}`}>
                           <div className="flex items-center gap-4">
                              {cert.status === 'ok' ? <CheckCircle2 size={24} className="text-emerald-500"/> : cert.status === 'warning' ? <Clock size={24} className="text-orange-500"/> : cert.status === 'expired' ? <AlertTriangle size={24} className="text-red-500"/> : <XCircle size={24} className="text-zinc-700"/>}
                              <div><p className="text-white text-xs font-black uppercase leading-tight">{cert.cert_name}</p><p className={`text-[9px] font-bold mt-1 uppercase ${cert.status === 'ok' ? 'text-emerald-500/70' : 'text-zinc-600'}`}>{cert.uploaded ? `Expiry: ${cert.uploaded.expiry_date}` : 'Document Missing'}</p></div>
                           </div>
                           {cert.uploaded && <a href={cert.uploaded.file_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/5 rounded-2xl text-orange-500 hover:bg-orange-600 hover:text-white transition-all"><Eye size={18}/></a>}
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
export default function AdminSettingsPage() { return ( <Suspense fallback={<div>Loading...</div>}><SettingsContent /></Suspense> ) }
