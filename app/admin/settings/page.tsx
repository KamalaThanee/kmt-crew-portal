'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, 
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
  const [expandedCats, setExpandedCats] = useState<string[]>([])

  // Edit/Add States
  const [editingCrew, setEditingCrew] = useState<any>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

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
  }, [])

  const fetchData = async () => {
    const { data: st } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
    if (st) setSizeCharts({ suit: st.suit_chart_url || '', boot: st.boot_url || '' })
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
    if (inv) setInventory(inv)
    const { data: cr } = await supabase.from('crews').select('*').order('full_name')
    if (cr) setCrews(cr)
  }

  // 🎯 ฟังก์ชันเรียงไซส์แบบฉลาด (รองรับทั้ง S,M,L และ Size 9 / 43)
  const smartSort = (arr: any[]) => {
    return [...arr].sort((a, b) => {
      const getNum = (s: string) => {
        const match = s.match(/\d+/);
        return match ? parseInt(match[0]) : null;
      };
      const numA = getNum(String(a));
      const numB = getNum(String(b));
      if (numA !== null && numB !== null) return numA - numB;
      return sizeOrder.indexOf(String(a).toUpperCase()) - sizeOrder.indexOf(String(b).toUpperCase());
    });
  }

  const suitColors = useMemo(() => [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].filter(Boolean).sort(), [inventory])
  const suitSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))].filter(Boolean)), [inventory])
  const bootSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))].filter(Boolean)), [inventory])

  const groupedInventory = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const filtered = inventory.filter(i => 
      i.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    filtered.forEach(item => {
      const cat = item.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })
    // Sort items within groups
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => {
        if (a.item_name !== b.item_name) return a.item_name.localeCompare(b.item_name);
        if (a.color !== b.color) return (a.color || '').localeCompare(b.color || '');
        return smartSort([a.size, b.size])[0] === a.size ? -1 : 1;
      });
    });
    return groups;
  }, [inventory, searchTerm])

  const handleSaveItem = async () => {
    if (!editingItem.item_name || !editingItem.category) return toast.error('Please fill required fields');
    const { error } = await supabase.from('ppe_inventory').upsert({
      id: editingItem.id || undefined,
      item_name: editingItem.item_name,
      item_id_code: editingItem.item_id_code,
      category: editingItem.category,
      color: editingItem.color,
      size: editingItem.size,
      quantity: Number(editingItem.quantity),
      threshold: Number(editingItem.threshold),
      unit: editingItem.unit || 'Piece'
    })
    if (!error) { toast.success('Inventory updated'); setIsItemModalOpen(false); fetchData(); }
    else toast.error('Save failed');
  }

  const handleUpdateCrew = async () => {
    const { error } = await supabase.from('crews').update({
      full_name: editingCrew.full_name, position: editingCrew.position,
      suit_size: editingCrew.suit_size, suit_color: editingCrew.suit_color, boot_size: editingCrew.boot_size
    }).eq('id', editingCrew.id)
    if (!error) { toast.success('Crew updated'); setIsEditCrewOpen(false); fetchData(); }
  }

  const handleResetPin = async (crewId: string, name: string) => {
    if (!confirm(`Reset PIN for ${name}?`)) return;
    await supabase.from('crews').update({ pin: null, registered: false }).eq('id', crewId)
    toast.success('PIN Reset'); fetchData();
  }

  const handleUpload = async (type: 'suit' | 'boot', file: File) => {
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const fileName = `${type}_chart_${Date.now()}.jpg`;
      await supabase.storage.from('size-charts').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('size-charts').getPublicUrl(fileName);
      await supabase.from('ppe_settings').update({ [type === 'suit' ? 'suit_chart_url' : 'boot_url']: publicUrl }).eq('id', 1);
      setSizeCharts(prev => ({ ...prev, [type]: publicUrl }));
      toast.success('Chart updated');
    } catch (e) { toast.error('Upload failed'); } 
    finally { setUploading(prev => ({ ...prev, [type]: false })); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">SYSTEM INITIALIZING...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-black uppercase italic flex items-center gap-3"><Settings className="text-blue-500"/> Admin Panel</h1>
          <button onClick={() => router.push('/ppe')} className="p-3 bg-white/5 rounded-full"><X/></button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0 font-black uppercase text-[10px] tracking-widest">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}>
                {t === 'inventory' ? <Package size={18}/> : t === 'crews' ? <Users size={18}/> : <SlidersHorizontal size={18}/>} {t} Master
              </button>
            ))}
          </div>

          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 shadow-2xl min-h-[60vh]">
            
            {/* 📦 1. Inventory Master with Edit/Add & Accordion */}
            {activeTab === 'inventory' && (
              <div className="animate-in fade-in space-y-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                  <input type="text" placeholder="Search item or code..." className="w-full md:max-w-xs bg-black/50 border border-white/10 p-3 rounded-xl outline-none text-sm" onChange={(e) => setSearchTerm(e.target.value)} />
                  <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1 }); setIsItemModalOpen(true); }} className="w-full md:w-auto px-6 py-3 bg-blue-600 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2"><Plus size={16}/> Add New Item</button>
                </div>

                <div className="space-y-4">
                  {Object.entries(groupedInventory).map(([category, items]) => {
                    const isExpanded = expandedCats.includes(category);
                    return (
                      <div key={category} className="border border-white/5 rounded-2xl overflow-hidden bg-black/20">
                        <button onClick={() => setExpandedCats(isExpanded ? expandedCats.filter(c => c !== category) : [...expandedCats, category])} className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-3 text-blue-500"><Box size={18}/><h3 className="font-black uppercase tracking-widest text-xs text-white">{category} <span className="ml-2 text-slate-500 font-bold">({items.length})</span></h3></div>
                          {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                        </button>
                        {isExpanded && (
                          <div className="overflow-x-auto border-t border-white/5">
                            <table className="w-full text-left text-[10px] font-bold uppercase whitespace-nowrap">
                              <thead className="text-slate-500 bg-black/40">
                                <tr><th className="p-4">Code</th><th className="p-4">Name</th><th className="p-4">Color/Size</th><th className="p-4 text-right">Stock</th><th className="p-4 text-center">Action</th></tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {items.map(item => (
                                  <tr key={item.id} className="hover:bg-white/5">
                                    <td className="p-4 text-slate-500">{item.item_id_code}</td>
                                    <td className="p-4 text-white">{item.item_name}</td>
                                    <td className="p-4 text-blue-400">{item.color} {item.size}</td>
                                    <td className={`p-4 text-right font-black ${item.quantity <= item.threshold ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</td>
                                    <td className="p-4 text-center"><button onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }} className="p-2 bg-white/5 rounded-lg text-blue-400 hover:bg-blue-600 hover:text-white transition-all"><Edit size={14}/></button></td>
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

            {/* 👷 2. Crew Management */}
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-3">
                <input type="text" placeholder="Search Crew..." className="w-full mb-6 bg-black/50 border border-white/10 p-4 rounded-2xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
                {crews.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(crew => (
                  <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group">
                    <div className="cursor-pointer flex-1" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                      <p className="font-bold text-sm uppercase group-hover:text-blue-400 transition-colors">{crew.full_name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">{crew.position} | Suit: {crew.suit_size || 'N/A'} | Boot: {crew.boot_size || 'N/A'}</p>
                    </div>
                    <button onClick={() => handleResetPin(crew.id, crew.full_name)} className="px-4 py-2 bg-amber-500/10 text-amber-500 rounded-xl text-[10px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all"><RefreshCw size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            {/* ⚙️ 3. System Config (Chart Display) */}
            {activeTab === 'system' && (
              <div className="animate-in fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                {['suit', 'boot'].map(type => (
                  <div key={type} className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4 text-center">
                    <p className="font-black uppercase text-[10px] text-slate-500 tracking-widest">{type === 'suit' ? 'Boiler Suit Chart' : 'Safety Boot Chart'}</p>
                    <div className="w-full h-56 bg-black rounded-2xl border border-white/5 flex items-center justify-center overflow-hidden">
                      {sizeCharts[type as 'suit' | 'boot'] ? <img src={sizeCharts[type as 'suit' | 'boot']} className="max-w-full max-h-full object-contain" /> : <div className="text-slate-700 uppercase font-black text-xs">No Chart Uploaded</div>}
                    </div>
                    <label className="flex items-center justify-center w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer font-bold text-[10px] uppercase shadow-lg shadow-blue-600/20">
                      {uploading[type as 'suit' | 'boot'] ? <Loader2 className="animate-spin"/> : <Upload size={16} className="mr-2"/>} Update Image
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(type as 'suit' | 'boot', e.target.files[0])} />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🛠️ MODAL: Edit/Add Inventory Item */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-lg p-10 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/5 pb-4"><h2 className="text-xl font-black uppercase italic">{editingItem.id ? 'Edit' : 'Add'} Item</h2><button onClick={() => setIsItemModalOpen(false)}><X/></button></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Item Name *</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none focus:border-blue-500" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Item Code</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingItem.item_id_code} onChange={e => setEditingItem({...editingItem, item_id_code: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Category *</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Color</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Size</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-blue-500 uppercase">Stock Qty</label><input type="number" className="w-full bg-black/50 p-3 rounded-xl border border-blue-500/30 outline-none text-blue-400 font-bold" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-red-500 uppercase">Threshold</label><input type="number" className="w-full bg-black/50 p-3 rounded-xl border border-red-500/30 outline-none text-red-400 font-bold" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-600/20"><Save size={18}/> Save Item</button>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL: Edit Crew Profile */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-lg p-10 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4"><h2 className="text-xl font-black uppercase italic">Edit Crew Member</h2><button onClick={() => setIsEditCrewOpen(false)}><X/></button></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none focus:border-blue-500" value={editingCrew.full_name} onChange={e => setEditingCrew({...editingCrew, full_name: e.target.value})}/></div>
              <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Position</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none focus:border-blue-500" value={editingCrew.position} onChange={e => setEditingCrew({...editingCrew, position: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Suit Color</label>
                <select className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.suit_color} onChange={e => setEditingCrew({...editingCrew, suit_color: e.target.value})}>
                  <option value="">-- Color --</option>{suitColors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Suit Size</label>
                <select className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.suit_size} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}>
                  <option value="">-- Size --</option>{suitSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Boot Size (Safety Only)</label>
                <select className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.boot_size} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}>
                  <option value="">-- Size --</option>{bootSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleUpdateCrew} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 transition-all active:scale-95"><Save size={18}/> Update Profile</button>
          </div>
        </div>
      )}
    </div>
  )
}
