'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, Search, FileCheck, Clock, Eye, CheckCircle2,
  Loader2, Upload, Edit, RefreshCw, X, Save, AlertTriangle, Box, Plus, ChevronDown, ChevronRight, XCircle, Trash2
} from 'lucide-react'
import imageCompression from 'browser-image-compression'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [uploading, setUploading] = useState({ suit: false, boot: false });
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' });
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [crews, setCrews] = useState<any[]>([]);
  const [certMatrix, setCertMatrix] = useState<any[]>([]);
  const [allCrewCerts, setAllCrewCerts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [filterMode, setFilterMode] = useState('all'); 
  const [filterCert, setFilterCert] = useState('all');
  const [expandedCats, setExpandedCats] = useState<string[]>([]);

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

  // --- Handlers ---
  const handleSaveItem = async () => {
    if (!editingItem.item_name || !editingItem.category) return toast.error('Required fields missing');
    const { error } = await supabase.from('ppe_inventory').upsert({
      id: editingItem.id || undefined, item_name: editingItem.item_name, item_id_code: editingItem.item_id_code,
      category: editingItem.category, color: editingItem.color, size: editingItem.size,
      quantity: Number(editingItem.quantity), threshold: Number(editingItem.threshold), unit: editingItem.unit || 'Piece'
    });
    if (!error) { toast.success('Inventory saved'); setIsItemModalOpen(false); fetchData(); }
  };

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

  // --- Memos ---
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
      const matchesCat = filterCat === 'All' || i.category === filterCat;
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'low' ? i.quantity <= i.threshold : i.quantity > i.threshold);
      return matchesSearch && matchesCat && matchesStatus;
    });
    filtered.forEach(item => {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => (a.item_id_code || "").localeCompare((b.item_id_code || ""), undefined, { numeric: true }));
    });
    return groups;
  }, [inventory, searchTerm, filterCat, filterStatus]);

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
          const expDate = new Date(uploaded.expiry_date);
          const diff = (expDate.getTime() - today.getTime())/86400000;
          if (diff < 0) { status = 'expired'; expiredCount++; }
          else if (diff <= 90) { status = 'warning'; warningCount++; okCount++; }
          else { status = 'ok'; okCount++; }
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
      if (filterCert !== 'all') {
        if (!crew.certData.list.some((c:any) => normalize(c.cert_name) === normalize(filterCert) && c.status !== 'missing')) return false;
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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse uppercase">Initializing Admin Center...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32 pt-24 px-4 md:px-12 uppercase font-bold text-[10px]">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-10 flex justify-between items-center">
          <h1 className="text-4xl font-black italic flex items-center gap-4 tracking-tighter"><Settings className="text-orange-500" size={36}/> Admin Center</h1>
          <button onClick={() => router.push('/admin/dashboard')} className="p-4 bg-zinc-900 rounded-full border border-white/5 hover:bg-orange-600 transition-all shadow-xl"><X size={24}/></button>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="w-full lg:w-72 space-y-3 shrink-0">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setSearchTerm(''); }} className={`w-full flex items-center gap-4 p-5 rounded-[24px] transition-all border ${activeTab === t ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_30px_rgba(249,115,22,0.3)]' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-orange-400'}`}>
                {t === 'inventory' ? <Package size={20}/> : t === 'crews' ? <Users size={20}/> : <SlidersHorizontal size={20}/>} <span className="text-xs">{t} Master</span>
              </button>
            ))}
          </div>

          <div className="flex-1 bg-zinc-900/50 border border-white/5 rounded-[48px] p-8 shadow-inner min-h-[70vh]">
            {activeTab === 'inventory' && (
              <div className="animate-in fade-in space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                   <h2 className="text-2xl font-black italic text-white uppercase">Inventory</h2>
                   <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsItemModalOpen(true); }} className="px-8 py-4 bg-orange-600 rounded-2xl flex items-center gap-2"><Plus size={18}/> Add New Item</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/40 p-5 rounded-3xl border border-white/5">
                   <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16}/><input type="text" placeholder="Search..." className="w-full bg-zinc-900 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-orange-500 text-sm" onChange={(e) => setSearchTerm(e.target.value)} /></div>
                   <select className="bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none text-xs" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}><option value="All">All Categories</option>{allCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                   <select className="bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none text-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="all">All Status</option><option value="low">Low Stock</option></select>
                </div>
                <div className="space-y-4">
                  {Object.entries(filteredInventoryGrouped).map(([category, items]) => {
                    const isExpanded = expandedCats.includes(category);
                    return (
                      <div key={category} className={`border rounded-[32px] overflow-hidden ${isExpanded ? 'border-orange-500/50 bg-black/20' : 'border-white/5 bg-zinc-900/30'}`}>
                        <button onClick={() => setExpandedCats(isExpanded ? expandedCats.filter(c => c !== category) : [...expandedCats, category])} className="w-full p-6 flex justify-between items-center hover:bg-white/5">
                          <div className="flex items-center gap-4 text-orange-500"><Box size={24}/><h3 className="text-sm font-black tracking-widest text-white">{category} ({items.length})</h3></div>
                          {isExpanded ? <ChevronDown size={24}/> : <ChevronRight size={24}/>}
                        </button>
                        {isExpanded && (
                          <div className="overflow-x-auto border-t border-white/5 p-4">
                            <table className="w-full text-left text-[11px] font-black uppercase whitespace-nowrap border-separate border-spacing-y-2">
                              <thead className="text-zinc-500 bg-black/40"><tr><th className="p-4">Code</th><th className="p-4">Name</th><th className="p-4">Spec</th><th className="p-4 text-right">Qty</th><th className="p-4 text-center">Edit</th></tr></thead>
                              <tbody>
                                {items.map(item => (
                                  <tr key={item.id} className="bg-white/5 hover:bg-orange-600/10 transition-all">
                                    <td className="p-4 rounded-l-xl border-l border-orange-500/20">{item.item_id_code}</td>
                                    <td className="p-4 text-white font-bold">{item.item_name}</td>
                                    <td className="p-4 text-orange-400">{item.color} {item.size}</td>
                                    <td className={`p-4 text-right font-black ${item.quantity <= item.threshold ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</td>
                                    <td className="p-4 text-center rounded-r-xl"><button onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }} className="p-2 text-orange-400"><Edit size={16}/></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-8">
                <h2 className="text-xl font-black italic text-white mb-4 uppercase tracking-tighter">Crew Master Data</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                   {[
                     { id: 'all', label: 'ทั้งหมด', val: crews.length, color: 'border-blue-500', text: 'text-blue-500' },
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
                  <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input type="text" placeholder="Search name..." className="w-full bg-black/50 border border-white/10 p-5 pl-12 rounded-[24px] outline-none text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} /></div>
                  <select className="w-full bg-black/50 border border-orange-500/30 p-5 rounded-[24px] outline-none text-orange-500 font-black" value={filterCert} onChange={(e) => setFilterCert(e.target.value)}><option value="all">🔍 Filter by Certificate...</option>{allUniqueCerts.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>
                <div className="space-y-4">
                  {enhancedCrews.map(crew => (
                    <div key={crew.id} className="flex justify-between items-center bg-black/40 p-6 rounded-[32px] border border-white/5 hover:border-orange-500/50 transition-all cursor-pointer" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                      <div className="flex items-center gap-6"><div className="relative w-16 h-16"><svg className="w-full h-full transform -rotate-90"><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-white/5"/><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray="176" strokeDashoffset={176 - (crew.certData.progress/100)*176} className={crew.certData.progress === 100 ? 'text-emerald-500' : 'text-orange-500'}/></svg><span className="absolute inset-0 flex items-center justify-center text-xs font-black">{crew.certData.progress}%</span></div>
                      <div><p className="font-bold text-lg text-white group-hover:text-orange-500">{crew.full_name} {crew.certData.expired > 0 && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[9px] ml-2 animate-pulse">EXP {crew.certData.expired}</span>}</p><p className="text-xs text-zinc-500 tracking-widest mt-1 uppercase">{crew.position}</p></div></div>
                      <ChevronRight size={24} className="text-zinc-800" />
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
                    <label className="flex items-center justify-center w-full py-5 bg-orange-600 rounded-3xl cursor-pointer hover:bg-orange-500 transition-all font-black uppercase text-xs shadow-xl"><Upload size={20} className="mr-3"/> Update Chart Image<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(type as 'suit' | 'boot', e.target.files[0])} /></label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🛠️ MODAL: MANAGE INVENTORY ITEM */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl">
          <div className="bg-zinc-900 border border-orange-500/20 rounded-[48px] w-full max-w-xl p-12 space-y-8 shadow-[0_0_100px_rgba(249,115,22,0.1)] max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-6 text-orange-500"><h2 className="text-2xl font-black italic uppercase tracking-tighter">Inventory Management</h2><button onClick={() => setIsItemModalOpen(false)} className="p-3 bg-white/5 rounded-full"><X/></button></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2"><label className="text-orange-500 font-black ml-1 uppercase">Category *</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold" value={editingItem.category} onChange={e => {const newCat = e.target.value; setEditingItem({...editingItem, category: newCat, item_id_code: editingItem.id ? editingItem.item_id_code : generateNextCode(newCat)})}}>{allCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="col-span-2 space-y-2"><label className="font-black ml-1 uppercase">Item Name *</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-blue-500 font-black ml-1 uppercase">Code (Auto)</label><input className="w-full bg-blue-500/10 border border-blue-500/30 p-5 rounded-2xl outline-none text-blue-400 font-black italic" value={editingItem.item_id_code} readOnly /></div>
              <div className="space-y-2"><label className="font-black ml-1 uppercase">Unit</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})}/></div>
              <div className="space-y-2"><label className="font-black ml-1 uppercase">Color</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-2"><label className="font-black ml-1 uppercase">Size</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-emerald-500 font-black ml-1 uppercase">Current Stock</label><input type="number" className="w-full bg-black border border-emerald-500/20 p-5 rounded-2xl text-emerald-400 font-black" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-red-500 font-black ml-1 uppercase">Restock At</label><input type="number" className="w-full bg-black border border-red-500/20 p-5 rounded-2xl text-red-400 font-black" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-6 bg-orange-600 hover:bg-orange-500 text-white rounded-[24px] font-black uppercase text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={20}/> Save Master Data</button>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL: CREW PROFILE & CERTIFICATES */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in">
          <div className="bg-zinc-900 border border-white/10 rounded-[48px] w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-black/50">
            <div className="flex justify-between items-center border-b border-white/5 p-10 shrink-0 text-orange-500"><h2 className="text-3xl font-black italic uppercase tracking-tighter">{editingCrew.full_name}</h2><button onClick={() => setIsEditCrewOpen(false)} className="p-3 bg-white/5 rounded-full"><X size={32}/></button></div>
            <div className="overflow-y-auto p-10 space-y-12 flex-1 no-scrollbar">
               <div className="space-y-6">
                  <h3 className="text-blue-500 text-sm font-black uppercase tracking-widest border-b border-white/5 pb-3">Personnel Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white uppercase text-[10px]">
                    <div className="space-y-2"><label className="text-zinc-600 font-bold">Position</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl text-orange-500 font-black italic" value={editingCrew.position} readOnly /></div>
                    <div className="space-y-2"><label className="text-zinc-600 font-bold">PIN Number</label><div className="w-full bg-black border border-white/5 p-5 rounded-2xl text-zinc-700 italic font-black">SECURITY LOCKED</div></div>
                    <div className="space-y-2"><label className="text-zinc-600 font-bold">Boiler Suit Size</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl" value={editingCrew.suit_size || '-'} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}/></div>
                    <div className="space-y-2"><label className="text-zinc-600 font-bold">Safety Boot Size</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl" value={editingCrew.boot_size || '-'} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}/></div>
                  </div>
                  <div className="flex gap-4 pt-4">
                     <button onClick={handleUpdateCrew} className="flex-1 py-5 bg-orange-600 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={18}/> Update Member Information</button>
                     <button onClick={() => handleResetPin(editingCrew.id, editingCrew.full_name)} className="px-8 py-5 bg-zinc-800 border border-white/5 rounded-3xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-600 transition-all"><RefreshCw size={18}/> Reset PIN</button>
                  </div>
               </div>
               <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3 font-black"><h3 className="text-purple-500 text-sm uppercase tracking-widest">Compliance Status</h3><span className="px-4 py-2 bg-purple-500/10 text-purple-400 rounded-2xl text-xs uppercase">Overall Readiness {editingCrew.certData.progress}%</span></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
                     {editingCrew.certData.list.map((cert: any, idx: number) => (
                        <div key={idx} className={`flex justify-between items-center bg-black/40 p-5 rounded-3xl border border-white/5 ${cert.status === 'optional' ? 'opacity-30' : ''}`}>
                           <div className="flex items-center gap-4">
                              {cert.status === 'ok' ? <CheckCircle2 size={24} className="text-emerald-500"/> : cert.status === 'warning' ? <Clock size={24} className="text-orange-500"/> : cert.status === 'expired' ? <AlertTriangle size={24} className="text-red-500"/> : <XCircle size={24} className="text-zinc-700"/>}
                              <div><p className="text-white text-xs font-black uppercase leading-tight">{cert.cert_name}</p><p className={`text-[9px] font-bold mt-1 uppercase ${cert.status === 'ok' ? 'text-emerald-500/70' : 'text-zinc-600'}`}>{cert.uploaded ? `Expiry: ${cert.uploaded.expiry_date}` : 'Document Missing'}</p></div>
                           </div>
                           {cert.uploaded && <a href={cert.uploaded.file_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/5 rounded-2xl text-orange-500 hover:bg-orange-600 hover:text-white transition-all shadow-lg"><Eye size={18}/></a>}
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
