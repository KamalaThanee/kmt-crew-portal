'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, Search, UserPlus,
  Loader2, Upload, Edit, RefreshCw, X, Save, Box, ChevronRight, User
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
  const [searchTerm, setSearchTerm] = useState('');

  const [editingCrew, setEditingCrew] = useState<any>(null);
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false);

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
    const [stRes, invRes, crewRes] = await Promise.all([
      supabase.from('ppe_settings').select('*').eq('id', 1).single(),
      supabase.from('ppe_inventory').select('*').order('item_name'),
      supabase.from('crews').select('*').order('full_name')
    ]);
    if (stRes.data) setSizeCharts({ suit: stRes.data.suit_chart_url || '', boot: stRes.data.boot_url || '' });
    if (invRes.data) setInventory(invRes.data);
    if (crewRes.data) setCrews(crewRes.data);
    setLoading(false);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user');
      if (!userStr) { router.replace('/login'); return; }
      const user = JSON.parse(userStr);
      const adminRoles = ["safety officer", "chief officer", "barge master"];
      if (!adminRoles.includes((user.position || "").toLowerCase().trim())) { router.replace('/ppe'); return; }
      await fetchData();
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['crews', 'system'].includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  // 🎯 สกัดตัวเลือกสำหรับ Dropdowns จากสต๊อกจริง
  const suitColors = useMemo(() => [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].filter(Boolean).sort(), [inventory])
  const suitSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))].filter(Boolean)), [inventory])
  const bootSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))].filter(Boolean)), [inventory])

  const filteredCrews = useMemo(() => {
    return crews.filter(crew => crew.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [crews, searchTerm]);

  const handleSaveCrew = async () => {
    if (!editingCrew.full_name || !editingCrew.position) return toast.error('Full Name and Position required');
    
    // บันทึกข้อมูลลงฐานข้อมูล (ใช้ upsert เพื่อรองรับทั้งการเพิ่มและแก้ไข)
    const { error } = await supabase.from('crews').upsert({
      id: editingCrew.id || undefined,
      full_name: editingCrew.full_name,
      position: editingCrew.position,
      suit_color: editingCrew.suit_color,
      suit_size: editingCrew.suit_size,
      boot_size: editingCrew.boot_size,
      registered: editingCrew.registered || false
    });

    if (!error) { 
      toast.success(editingCrew.id ? 'Member updated' : 'New member added'); 
      setIsEditCrewOpen(false); 
      fetchData(); 
    } else {
      toast.error('Save failed: ' + error.message);
    }
  };

  const handleResetPin = async (id: string, name: string) => {
    if (confirm(`Reset PIN for ${name}? User must register again.`)) {
      await supabase.from('crews').update({ pin: null, registered: false }).eq('id', id);
      fetchData(); toast.success('PIN has been reset');
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
      toast.success('Size Chart Updated');
    } finally { setUploading(prev => ({ ...prev, [type]: false })); }
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse uppercase">Admin Hub Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32 pt-24 px-4 md:px-12 uppercase font-bold text-[10px]">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-10 flex justify-between items-center">
          <h1 className="text-4xl font-black italic flex items-center gap-4 tracking-tighter text-white"><Settings className="text-orange-500" size={36}/> Admin Panel</h1>
          <button onClick={() => router.push('/admin/dashboard')} className="p-4 bg-zinc-900 rounded-full border border-white/5 hover:bg-orange-600 transition-all shadow-xl"><X size={24}/></button>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="w-full lg:w-72 space-y-3 shrink-0">
            {['crews', 'system'].map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setSearchTerm(''); }} className={`w-full flex items-center gap-4 p-5 rounded-[24px] transition-all border ${activeTab === t ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_30px_rgba(249,115,22,0.3)]' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-orange-400'}`}>
                {t === 'crews' ? <Users size={20}/> : <SlidersHorizontal size={20}/>} <span className="text-xs">{t === 'crews' ? 'Crew Master' : 'System Master'}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 bg-zinc-900/5 border border-white/5 rounded-[48px] p-8 shadow-inner min-h-[70vh]">
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none">Barge Crew Master</h2>
                    <p className="text-zinc-600 mt-2">{crews.length} Personnel in Database</p>
                  </div>
                  {/* 🎯 ปุ่มเพิ่มลูกเรือใหม่ */}
                  <button onClick={() => { setEditingCrew({ full_name: '', position: '', suit_color: '', suit_size: '', boot_size: '', registered: false }); setIsEditCrewOpen(true); }} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl flex items-center gap-3 active:scale-95 transition-all shadow-lg shadow-orange-600/20"><UserPlus size={18}/> Add New Barge Crew</button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20}/>
                  <input type="text" placeholder="Search by name..." className="w-full bg-black/50 border border-white/10 p-5 pl-14 rounded-[24px] outline-none text-sm font-bold text-white focus:border-orange-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCrews.map(crew => (
                    <div key={crew.id} className="flex justify-between items-center bg-black/40 p-6 rounded-[32px] border border-white/5 group hover:border-orange-500/50 transition-all cursor-pointer shadow-xl" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600 group-hover:text-orange-500 transition-colors border border-white/5"><User size={28}/></div>
                        <div>
                          <p className="font-bold text-lg text-white group-hover:text-orange-500 transition-colors leading-tight">{crew.full_name}</p>
                          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest italic">{crew.position}</p>
                        </div>
                      </div>
                      <ChevronRight size={24} className="text-zinc-800 group-hover:text-orange-500 transition-all" />
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
                    <label className="flex items-center justify-center w-full py-5 bg-orange-600 rounded-3xl cursor-pointer hover:bg-orange-500 transition-all text-white font-black uppercase text-xs shadow-xl"><Upload size={20} className="mr-3"/> Update Chart Image<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(type as 'suit' | 'boot', e.target.files[0])} /></label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🛠️ MODAL: MANAGE CREW MEMBER */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in duration-300">
          <div className="bg-zinc-900 border border-orange-500/20 rounded-[48px] w-full max-w-xl p-12 space-y-8 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-8 mb-4 text-orange-500">
               <h2 className="text-3xl font-black italic uppercase tracking-tighter">{editingCrew.id ? 'Edit Profile' : 'New Member'}</h2>
               <button onClick={() => setIsEditCrewOpen(false)} className="p-3 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all"><X size={24}/></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2"><label className="text-zinc-500 text-[10px] font-black tracking-widest ml-2 uppercase">FULL NAME *</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-bold text-sm focus:border-orange-500" value={editingCrew.full_name} onChange={e => setEditingCrew({...editingCrew, full_name: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 text-[10px] font-black tracking-widest ml-2 uppercase">POSITION *</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl text-orange-500 font-black italic text-sm focus:border-orange-500" value={editingCrew.position} onChange={e => setEditingCrew({...editingCrew, position: e.target.value})}/></div>
              
              <div className="space-y-4 pt-4 border-t border-white/5">
                <p className="text-orange-500 text-[10px] font-black tracking-widest ml-2 uppercase">PPE Configuration</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-zinc-600 text-[10px] font-bold ml-2">SUIT COLOR</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-bold text-xs" value={editingCrew.suit_color || ''} onChange={e => setEditingCrew({...editingCrew, suit_color: e.target.value})}><option value="">-- Color --</option>{suitColors.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-zinc-600 text-[10px] font-bold ml-2">SUIT SIZE</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-bold text-xs" value={editingCrew.suit_size || ''} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}><option value="">-- Size --</option>{suitSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
                <div className="space-y-2"><label className="text-zinc-600 text-[10px] font-bold ml-2">SAFETY BOOT SIZE</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-bold text-xs" value={editingCrew.boot_size || ''} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}><option value="">-- Select Size --</option>{bootSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>

              <div className="flex gap-4 pt-6">
                 <button onClick={handleSaveCrew} className="flex-[2] py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={18}/> {editingCrew.id ? 'Save Profile' : 'Create Account'}</button>
                 {editingCrew.id && (
                    <button onClick={() => handleResetPin(editingCrew.id, editingCrew.full_name)} className="flex-1 py-5 bg-zinc-800 border border-white/5 rounded-3xl font-black uppercase text-[10px] text-zinc-500 hover:bg-red-600 hover:text-white transition-all">Reset PIN</button>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminSettingsPage() { return ( <Suspense fallback={<div>Loading...</div>}><SettingsContent /></Suspense> ) }
