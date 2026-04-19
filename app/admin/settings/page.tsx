'use client'
import imageCompression from 'browser-image-compression';
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, Search,
  Loader2, Upload, Edit, RefreshCw, X, Save, AlertTriangle, Box, Plus, ChevronDown, ChevronRight
} from 'lucide-react'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('inventory')
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  const [inventory, setInventory] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [filterStatus, setFilterStatus] = useState('all')
  const [expandedCats, setExpandedCats] = useState<string[]>([])

  const [editingCrew, setEditingCrew] = useState<any>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

  const smartSort = (arr: any[]) => {
    return [...arr].sort((a, b) => {
      const getNum = (s: string) => {
        const match = String(s).match(/\d+/);
        return match ? parseInt(match[0]) : null;
      };
      const numA = getNum(a); const numB = getNum(b);
      if (numA !== null && numB !== null) return numA - numB;
      const idxA = sizeOrder.indexOf(String(a).toUpperCase());
      const idxB = sizeOrder.indexOf(String(b).toUpperCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return String(a).localeCompare(String(b));
    });
  }

  const fetchData = async () => {
    const { data: st } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
    if (st) setSizeCharts({ suit: st.suit_chart_url || '', boot: st.boot_url || '' })
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
    if (inv) setInventory(inv)
    const { data: cr } = await supabase.from('crews').select('*').order('full_name')
    if (cr) setCrews(cr)
  }

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user')
      if (!userStr) { router.replace('/login'); return; }
      const user = JSON.parse(userStr)
      const userPos = (user.position || "").toLowerCase()
      const adminRoles = ["safety officer", "chief officer", "barge master"]
      if (!adminRoles.includes(userPos)) { toast.error('Access Denied'); router.replace('/ppe'); return; }
      await fetchData(); setLoading(false);
    }
    checkAuth()
  }, [router])

  const categories = useMemo(() => {
    const dbCats = inventory.map(i => i.category).filter(Boolean)
    return [...new Set(['Other', ...dbCats])].sort()
  }, [inventory])

  const generateNextCode = (catName: string) => {
    const catItems = inventory.filter(i => i.category === catName)
    const numbers = catItems.map(i => {
      const match = String(i.item_id_code).match(/\d+$/);
      return match ? parseInt(match[0]) : 0;
    })
    return `${catName}-${numbers.length > 0 ? Math.max(...numbers) + 1 : 1}`;
  }

  const suitColors = useMemo(() => [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].filter(Boolean).sort(), [inventory])
  const suitSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))].filter(Boolean)), [inventory])
  const bootSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))].filter(Boolean)), [inventory])

  // 🎯 ปรับปรุงการจัดกลุ่มและเรียงลำดับตาม Item Code
  const groupedInventory = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const filtered = inventory.filter(i => {
      const matchesSearch = i.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || i.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = filterCat === 'All' || i.category === filterCat;
      const isLow = i.quantity <= i.threshold;
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'low' ? isLow : !isLow);
      return matchesSearch && matchesCat && matchesStatus;
    })

    filtered.forEach(item => {
      const cat = item.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })

    // 🎯 เรียงลำดับตาม Item ID Code (BODY-01, BODY-02...) ภายในแต่ละกลุ่ม
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => 
        (a.item_id_code || "").localeCompare((b.item_id_code || ""), undefined, { numeric: true, sensitivity: 'base' })
      )
    })

    return groups
  }, [inventory, searchTerm, filterCat, filterStatus])

  const handleSaveItem = async () => {
    if (!editingItem.item_name || !editingItem.category) return toast.error('Please fill required fields');
    const { error } = await supabase.from('ppe_inventory').upsert({
      id: editingItem.id || undefined,
      item_name: editingItem.item_name, item_id_code: editingItem.item_id_code,
      category: editingItem.category, color: editingItem.color, size: editingItem.size,
      quantity: Number(editingItem.quantity), threshold: Number(editingItem.threshold), unit: editingItem.unit || 'Piece'
    })
    if (!error) { toast.success('Saved'); setIsItemModalOpen(false); fetchData(); }
  }

  const handleUpdateCrew = async () => {
    if (!editingCrew) return;
    const { error } = await supabase.from('crews').update({
      full_name: editingCrew.full_name, position: editingCrew.position,
      suit_size: editingCrew.suit_size, suit_color: editingCrew.suit_color, boot_size: editingCrew.boot_size
    }).eq('id', editingCrew.id)
    if (!error) { toast.success('Profile Updated'); setIsEditCrewOpen(false); fetchData(); }
  }

  const handleResetPin = async (id: string, name: string) => {
    if (confirm(`Reset PIN for ${name}?`)) {
      await supabase.from('crews').update({ pin: null, registered: false }).eq('id', id);
      fetchData(); toast.success('PIN Reset');
    }
  }

  const handleUpload = async (type: 'suit' | 'boot', file: File) => {
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const fileName = `${type}_chart_${Date.now()}.jpg`;
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true }); await supabase.storage.from('size-charts').upload(fileName, compressedFile);
      const { data: { publicUrl } } = supabase.storage.from('size-charts').getPublicUrl(fileName);
      await supabase.from('ppe_settings').update({ [type === 'suit' ? 'suit_chart_url' : 'boot_url']: publicUrl }).eq('id', 1);
      setSizeCharts(prev => ({ ...prev, [type]: publicUrl }));
      toast.success('Updated');
    } finally { setUploading(prev => ({ ...prev, [type]: false })); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-[0.3em]">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8 text-[10px] uppercase font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-black italic flex items-center gap-3"><Settings className="text-blue-500"/> Admin Panel</h1>
          <button onClick={() => router.push('/ppe')} className="p-3 bg-white/5 rounded-full"><X/></button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}>
                {t === 'inventory' ? <Package size={18}/> : t === 'crews' ? <Users size={18}/> : <SlidersHorizontal size={18}/>} {t} Master
              </button>
            ))}
          </div>

          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 shadow-2xl min-h-[60vh]">
            {activeTab === 'inventory' && (
              <div className="animate-in fade-in space-y-6">
                <h2 className="text-2xl font-black italic text-white mb-4">Inventory</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-black/30 p-4 rounded-2xl border border-white/5">
                   <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/><input type="text" placeholder="Search..." className="w-full bg-slate-900 border border-white/10 p-3 pl-10 rounded-xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} /></div>
                   <select className="bg-slate-900 border border-white/10 p-3 rounded-xl outline-none" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}><option value="All">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                   <select className="bg-slate-900 border border-white/10 p-3 rounded-xl outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="all">All Status</option><option value="low">Low Stock</option></select>
                </div>
                <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsItemModalOpen(true); }} className="w-full py-4 bg-blue-600 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2"><Plus size={16}/> Add Item</button>
                <div className="space-y-3">
                  {Object.entries(groupedInventory).map(([category, items]) => {
                    const isExpanded = expandedCats.includes(category);
                    return (
                      <div key={category} className="border border-white/5 rounded-2xl overflow-hidden bg-black/20">
                        <button onClick={() => setExpandedCats(isExpanded ? expandedCats.filter(c => c !== category) : [...expandedCats, category])} className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-3 text-blue-500"><Box size={18}/><h3 className="tracking-widest text-white">{category} <span className="ml-2 text-slate-500">({items.length})</span></h3></div>
                          {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                        </button>
                        {isExpanded && (
                          <div className="overflow-x-auto border-t border-white/5">
                            <table className="w-full text-left text-[10px] font-bold uppercase whitespace-nowrap">
                              <thead className="text-slate-500 bg-black/40"><tr><th className="p-4">Code</th><th className="p-4">Name</th><th className="p-4 text-center">Color/Size</th><th className="p-4 text-right">Stock</th><th className="p-4 text-center">Edit</th></tr></thead>
                              <tbody className="divide-y divide-white/5">
                                {items.map(item => (
                                  <tr key={item.id} className="hover:bg-white/5">
                                    <td className="p-4 text-slate-500 font-black">{item.item_id_code}</td>
                                    <td className="p-4 text-white">{item.item_name}</td>
                                    <td className="p-4 text-center text-blue-400">{item.color} {item.size}</td>
                                    <td className={`p-4 text-right font-black ${item.quantity <= item.threshold ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</td>
                                    <td className="p-4 text-center"><button onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }} className="p-2 bg-white/5 rounded-lg text-blue-400 hover:bg-blue-600 transition-all"><Edit size={14}/></button></td>
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
              <div className="animate-in fade-in space-y-3">
                <input type="text" placeholder="Search..." className="w-full mb-6 bg-black/50 border border-white/10 p-4 rounded-2xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
                {crews.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(crew => (
                  <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group">
                    <div className="cursor-pointer flex-1" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                      <p className="font-bold text-sm text-white">{crew.full_name}</p>
                      <p className="text-[9px] text-slate-500 tracking-widest">{crew.position} | Suit: {crew.suit_size} | Boot: {crew.boot_size}</p>
                    </div>
                    <button onClick={() => handleResetPin(crew.id, crew.full_name)} className="p-3 bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all"><RefreshCw size={14}/></button>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'system' && (
              <div className="animate-in fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                {['suit', 'boot'].map(type => (
                  <div key={type} className="p-6 bg-black/40 rounded-3xl border border-white/5 text-center space-y-4">
                    <p className="text-slate-500 tracking-widest">{type === 'suit' ? 'Boiler Suit Chart' : 'Safety Boot Chart'}</p>
                    <img src={sizeCharts[type as 'suit' | 'boot']} className="w-full h-48 object-contain bg-black rounded-2xl border border-white/5" />
                    <label className="flex items-center justify-center w-full py-4 bg-blue-600 rounded-xl cursor-pointer font-bold transition-all text-white">
                      {uploading[type as 'suit' | 'boot'] ? <Loader2 className="animate-spin"/> : <Upload size={16} className="mr-2"/>} Update Image
                      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(type as 'suit' | 'boot', e.target.files[0])} />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-lg p-10 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4"><h2 className="text-xl font-black italic">Manage Item</h2><button onClick={() => setIsItemModalOpen(false)}><X/></button></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1"><label className="text-blue-500">Category *</label><select className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none text-white" value={editingItem.category} onChange={e => {const newCat = e.target.value; setEditingItem({...editingItem, category: newCat, item_id_code: editingItem.id ? editingItem.item_id_code : generateNextCode(newCat)})}}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="col-span-2 space-y-1"><label>Item Name *</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none text-white" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-blue-400">Code (Auto)</label><input className="w-full bg-black/20 p-3 rounded-xl border border-blue-500/20 text-blue-400 font-black italic outline-none" value={editingItem.item_id_code} readOnly /></div>
              <div className="space-y-1"><label>Unit</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 text-white" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})}/></div>
              <div className="space-y-1"><label>Color</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 text-white" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-1"><label>Size</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 text-white" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-emerald-500">Stock</label><input type="number" className="w-full bg-black/50 p-3 rounded-xl border border-white/10 text-white" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-red-500">Threshold</label><input type="number" className="w-full bg-black/50 p-3 rounded-xl border border-white/10 text-white" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all"><Save size={18} className="inline mr-2"/> Save Item</button>
          </div>
        </div>
      )}

      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-lg p-10 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4"><h2 className="text-xl font-black italic">Edit Member</h2><button onClick={() => setIsEditCrewOpen(false)}><X/></button></div>
            <div className="grid grid-cols-2 gap-4 text-white">
              <div className="col-span-2 space-y-1"><label>Full Name</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.full_name} onChange={e => setEditingCrew({...editingCrew, full_name: e.target.value})}/></div>
              <div className="col-span-2 space-y-1"><label>Position</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.position} onChange={e => setEditingCrew({...editingCrew, position: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-blue-500">Suit Color</label><select className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.suit_color} onChange={e => setEditingCrew({...editingCrew, suit_color: e.target.value})}><option value="">-- Select --</option>{suitColors.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="space-y-1"><label className="text-blue-500">Suit Size</label><select className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.suit_size} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}><option value="">-- Select --</option>{suitSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="col-span-2 space-y-1"><label className="text-indigo-500">Boot Size</label><select className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.boot_size} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}><option value="">-- Select --</option>{bootSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <button onClick={handleUpdateCrew} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all"><Save size={18} className="inline mr-2"/> Update Profile</button>
          </div>
        </div>
      )}
    </div>
  )
}
