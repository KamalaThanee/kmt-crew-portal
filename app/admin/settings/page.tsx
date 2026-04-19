'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, 
  Loader2, Upload, Edit, RefreshCw, X, Save, AlertTriangle, Box
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
  const [editingCrew, setEditingCrew] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

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

  // ฟังก์ชันช่วยเรียงไซส์
  const sortSizes = (arr: any[]) => {
    return [...arr].sort((a, b) => {
      const isNumA = !isNaN(Number(a)); const isNumB = !isNaN(Number(b));
      if (isNumA && isNumB) return Number(a) - Number(b);
      return sizeOrder.indexOf(String(a).toUpperCase()) - sizeOrder.indexOf(String(b).toUpperCase());
    });
  }

  // ตัวเลือกสำหรับ Dropdowns ในหน้า Edit
  const suitColors = useMemo(() => [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].filter(Boolean).sort(), [inventory])
  const suitSizes = useMemo(() => sortSizes([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))].filter(Boolean)), [inventory])
  const bootSizes = useMemo(() => sortSizes([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))].filter(Boolean)), [inventory])

  const groupedInventory = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const filtered = inventory.filter(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase()))
    filtered.forEach(item => {
      const cat = item.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })
    return groups
  }, [inventory, searchTerm])

  const handleUpdateCrew = async () => {
    if (!editingCrew) return;
    const { error } = await supabase.from('crews').update({
      full_name: editingCrew.full_name, position: editingCrew.position,
      suit_size: editingCrew.suit_size, suit_color: editingCrew.suit_color, boot_size: editingCrew.boot_size
    }).eq('id', editingCrew.id)
    if (!error) { toast.success('Crew updated'); setIsEditModalOpen(false); fetchData(); }
    else toast.error('Update failed');
  }

  const handleResetPin = async (crewId: string, name: string) => {
    if (!confirm(`ยืนยันการรีเซ็ต PIN ของ ${name}? เขาจะต้องลงทะเบียนใหม่`)) return;
    const { error } = await supabase.from('crews').update({ pin: null, registered: false }).eq('id', crewId)
    if (!error) { toast.success('Reset PIN สำเร็จ'); fetchData(); }
    else toast.error('Reset failed');
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">VERIFYING ACCESS...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-black uppercase italic flex items-center gap-3"><Settings className="text-blue-500"/> Admin Center</h1>
          <button onClick={() => router.push('/ppe')} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><X/></button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0 font-black uppercase text-[10px] tracking-widest">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                {t === 'inventory' ? <Package size={18}/> : t === 'crews' ? <Users size={18}/> : <SlidersHorizontal size={18}/>} {t} Master
              </button>
            ))}
          </div>

          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 shadow-2xl min-h-[60vh]">
            {activeTab === 'inventory' && (
              <div className="animate-in fade-in space-y-8">
                <input type="text" placeholder="Search Master Data..." className="w-full bg-black/50 border border-white/10 p-4 rounded-2xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
                {Object.entries(groupedInventory).map(([category, items]) => (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-blue-500"><Box size={16}/><h2 className="font-black uppercase tracking-widest text-xs text-white">{category}</h2></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] font-bold uppercase whitespace-nowrap">
                        <thead className="text-slate-500 border-b border-white/5">
                          <tr><th className="pb-3">Code</th><th className="pb-3">Name</th><th className="pb-3 text-center">Color/Size</th><th className="pb-3 text-right">Stock</th><th className="pb-3 text-center">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {items.map(item => (
                            <tr key={item.id} className="hover:bg-white/5">
                              <td className="py-4 text-slate-500">{item.item_id_code}</td>
                              <td className="py-4 text-white">{item.item_name}</td>
                              <td className="py-4 text-center text-blue-400">{item.color} {item.size}</td>
                              <td className={`py-4 text-right font-black ${item.quantity <= item.threshold ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</td>
                              <td className="py-4 text-center">{item.quantity <= item.threshold ? <AlertTriangle size={14} className="mx-auto text-red-500 animate-pulse"/> : <span className="text-emerald-500/50">OK</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-3">
                <input type="text" placeholder="Search Crew..." className="w-full mb-6 bg-black/50 border border-white/10 p-4 rounded-2xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
                {crews.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(crew => (
                  <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group">
                    <div className="cursor-pointer flex-1" onClick={() => { setEditingCrew(crew); setIsEditModalOpen(true); }}>
                      <p className="font-bold text-sm uppercase group-hover:text-blue-400 transition-colors">{crew.full_name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">{crew.position} | Suit: {crew.suit_size || 'N/A'} | Boot: {crew.boot_size || 'N/A'}</p>
                    </div>
                    <button onClick={() => handleResetPin(crew.id, crew.full_name)} className="px-4 py-2 bg-amber-500/10 text-amber-500 rounded-xl text-[10px] font-black uppercase"><RefreshCw size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'system' && (
              <div className="animate-in fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                {['suit', 'boot'].map(type => (
                  <div key={type} className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4 text-center">
                    <p className="font-black uppercase text-[10px] text-slate-500 tracking-widest">{type === 'suit' ? 'Boiler Suit Chart' : 'Safety Boot Chart'}</p>
                    <div className="w-full h-48 bg-black rounded-2xl border border-white/5 flex items-center justify-center overflow-hidden">
                      {sizeCharts[type as 'suit' | 'boot'] ? <img src={sizeCharts[type as 'suit' | 'boot']} className="max-w-full max-h-full object-contain" /> : <div className="text-slate-700 uppercase font-black text-xs italic">No Image</div>}
                    </div>
                    <label className="flex items-center justify-center w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer font-bold text-[10px] uppercase shadow-lg shadow-blue-600/20">
                      {uploading[type as 'suit' | 'boot'] ? <Loader2 className="animate-spin"/> : <Upload size={16} className="mr-2"/>} Update Chart
                      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(type as 'suit' | 'boot', e.target.files[0])} />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditModalOpen && editingCrew && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-lg p-10 space-y-8 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4"><h2 className="text-2xl font-black uppercase italic tracking-tighter">Edit Profile</h2><button onClick={() => setIsEditModalOpen(false)}><X/></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label><input className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 outline-none focus:border-blue-500 text-sm" value={editingCrew.full_name} onChange={e => setEditingCrew({...editingCrew, full_name: e.target.value})}/></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Position</label><input className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 outline-none focus:border-blue-500 text-sm" value={editingCrew.position} onChange={e => setEditingCrew({...editingCrew, position: e.target.value})}/></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Suit Color</label>
                <select className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 outline-none text-sm" value={editingCrew.suit_color} onChange={e => setEditingCrew({...editingCrew, suit_color: e.target.value})}>
                  <option value="">-- Color --</option>{suitColors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Suit Size</label>
                <select className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 outline-none text-sm" value={editingCrew.suit_size} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}>
                  <option value="">-- Size --</option>{suitSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5"><label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Boot Size (Safety Only)</label>
                <select className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 outline-none text-sm" value={editingCrew.boot_size} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}>
                  <option value="">-- Size --</option>{bootSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleUpdateCrew} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/20"><Save size={18}/> Update Profile</button>
          </div>
        </div>
      )}
    </div>
  )
}
