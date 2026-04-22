'use client'
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { 
  Package, Search, AlertTriangle, Download, Plus, Edit, X, Save, 
  Box, ChevronDown, ChevronRight, Archive, FileText, Loader2, 
  CheckCircle2, Trash2, Upload, Clock, User,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, Footprints, MoreHorizontal
} from 'lucide-react'
import imageCompression from 'browser-image-compression'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

function InventoryContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [inventory, setInventory] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([]) // 🎯 เปลี่ยนเป็น Array สำหรับ Multi-select
  const [showLowStock, setShowLowStock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedCats, setExpandedCats] = useState<string[]>([])

  const [editingItem, setEditingItem] = useState<any>(null)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [restockView, setRestockView] = useState<'entry' | 'history'>('entry')

  const [restockEntries, setRestockEntries] = useState([{ id: Date.now(), inventory_id: '', qty: '' }])
  const [doFile, setDoFile] = useState<File | null>(null)
  const [isProcessingRestock, setIsProcessingRestock] = useState(false)

  const fetchData = async () => {
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
    if (inv) setInventory(inv)
    const { data: hist } = await supabase.from('restock_history').select('*').order('created_at', { ascending: false })
    if (hist) setHistory(hist)
    setLoading(false)
  }

  useEffect(() => {
    if (searchParams.get('filter') === 'low') setShowLowStock(true)
    if (searchParams.get('action') === 'restock') setIsRestockModalOpen(true)
    fetchData()
  }, [searchParams])

  // 🎯 แผนผังไอคอนหมวดหมู่
  const categoryConfig = [
    { name: 'Head Protection', icon: HardHat, label: 'Head' },
    { name: 'Ears Protection', icon: Headphones, label: 'Ears' },
    { name: 'Eyes Protection', icon: Eye, label: 'Eyes' },
    { name: 'Respiratory Protection', icon: Wind, label: 'Resp' },
    { name: 'Body Protection', icon: Shirt, label: 'Body' },
    { name: 'Hands Protection', icon: Hand, label: 'Hands' },
    { name: 'Foots Protection', icon: Footprints, label: 'Foots' },
    { name: 'Other', icon: MoreHorizontal, label: 'Other' },
  ]

  const toggleCat = (catName: string) => {
    setSelectedCats(prev => 
      prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
    )
  }

  const generateNextCode = (catName: string) => {
    const catItems = inventory.filter(i => i.category === catName)
    const numbers = catItems.map(i => {
      const match = String(i.item_id_code).match(/\d+$/)
      return match ? parseInt(match[0]) : 0
    })
    return `${catName}-${numbers.length > 0 ? Math.max(...numbers) + 1 : 1}`
  }

  const updateRow = (id: number, field: string, value: string) => {
    setRestockEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  const addRow = () => setRestockEntries([...restockEntries, { id: Date.now(), inventory_id: '', qty: '' }])
  const removeRow = (id: number) => setRestockEntries(restockEntries.filter(e => e.id !== id))

  const filteredInventoryGrouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const filtered = inventory.filter(item => {
      const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || (item.item_id_code||"").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCat = selectedCats.length === 0 || selectedCats.includes(item.category);
      const matchesStock = showLowStock ? (item.quantity <= item.threshold) : true
      return matchesSearch && matchesCat && matchesStock
    })

    filtered.forEach(item => {
      const cat = item.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })

    const sortedGroups: Record<string, any[]> = {}
    const order = categoryConfig.map(c => c.name);
    
    Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b)).forEach(key => {
      groups[key] = groups[key].sort((a, b) => (a.item_id_code || "").localeCompare((b.item_id_code || ""), undefined, { numeric: true }))
      sortedGroups[key] = groups[key]
    })

    if (searchTerm || showLowStock || selectedCats.length > 0) setExpandedCats(Object.keys(sortedGroups));
    return sortedGroups
  }, [inventory, searchTerm, selectedCats, showLowStock])

  const handleSaveItem = async () => {
    if (!editingItem.item_name || !editingItem.category) return toast.error('Required fields missing')
    const { error } = await supabase.from('ppe_inventory').upsert({
      id: editingItem.id || undefined, item_name: editingItem.item_name, item_id_code: editingItem.item_id_code,
      category: editingItem.category, color: editingItem.color, size: editingItem.size,
      quantity: Number(editingItem.quantity), threshold: Number(editingItem.threshold), unit: editingItem.unit || 'Piece'
    })
    if (!error) { toast.success('Saved'); setIsItemModalOpen(false); fetchData(); }
  }

  const handleRestockSubmit = async () => {
    const validEntries = restockEntries.filter(e => e.inventory_id && e.qty && Number(e.qty) > 0)
    if (validEntries.length === 0 || !doFile) return toast.error('Check items and DO file')
    setIsProcessingRestock(true)
    try {
      const compressedFile = await imageCompression(doFile, { maxSizeMB: 0.3, maxWidthOrHeight: 1024 })
      const fileName = `DO_${Date.now()}_${doFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      await supabase.storage.from('do-files').upload(fileName, compressedFile)
      const { data: { publicUrl } } = supabase.storage.from('do-files').getPublicUrl(fileName)
      const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
      for (const entry of validEntries) {
        const item = inventory.find(i => String(i.id) === String(entry.inventory_id))
        if (!item) continue;
        await supabase.from('ppe_inventory').update({ quantity: Number(item.quantity) + Number(entry.qty) }).eq('id', item.id)
        await supabase.from('restock_history').insert({ item_id: item.id, item_name: item.item_name, quantity_added: Number(entry.qty), added_by: admin.full_name || 'Admin', receipt_url: publicUrl })
      }
      toast.success('Restock Complete'); setRestockEntries([{ id: Date.now(), inventory_id: '', qty: '' }]); setDoFile(null); setRestockView('history'); fetchData();
    } catch (e: any) { toast.error(e.message) } finally { setIsProcessingRestock(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase text-xs">Loading...</div>

  return (
    <div className="p-4 md:p-12 max-w-[1600px] mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div><h1 className="text-4xl md:text-5xl font-black italic flex items-center gap-4 tracking-tighter text-white"><Package className="text-blue-500" size={40}/> Inventory</h1></div>
        <div className="flex flex-wrap gap-3">
           <button onClick={() => { setRestockView('entry'); setIsRestockModalOpen(true); }} className="px-8 py-4 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-[20px] font-black text-xs flex items-center gap-3 transition-all active:scale-95"><Archive size={18}/> Receive Stock</button>
           <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsItemModalOpen(true); }} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-[20px] font-black text-xs flex items-center gap-3 active:scale-95 transition-all"><Plus size={18}/> Add New Item</button>
        </div>
      </div>

      <div className="space-y-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20}/><input type="text" placeholder="Search item code or name..." className="w-full bg-black/60 border border-white/10 rounded-[24px] py-4 pl-14 pr-6 text-white outline-none focus:border-orange-500 transition-all text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <button onClick={() => setShowLowStock(!showLowStock)} className={`rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-3 border transition-all ${showLowStock ? 'bg-red-500/20 border-red-500 text-red-500 shadow-inner' : 'bg-black/40 border-white/10 text-zinc-600 hover:border-red-500/50 hover:text-red-500'}`}><AlertTriangle size={18}/> {showLowStock ? 'Low Stock Active' : 'Filter Low Stock'}</button>
        </div>

        {/* 🎯 Multi-select Icon Chips */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          {categoryConfig.map(cat => {
            const Icon = cat.icon;
            const isActive = selectedCats.includes(cat.name);
            return (
              <button key={cat.name} onClick={() => toggleCat(cat.name)} className={`flex flex-col items-center justify-center gap-2 min-w-[70px] h-[80px] rounded-2xl border transition-all ${isActive ? 'bg-orange-600 border-orange-400 text-white scale-105 shadow-lg shadow-orange-600/30' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20'}`}>
                <Icon size={24} />
                <span className="text-[8px] font-black uppercase tracking-widest">{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(filteredInventoryGrouped).map(([category, items]) => {
          const isExpanded = expandedCats.includes(category);
          return (
            <div key={category} className={`border rounded-[40px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-orange-500/30 bg-black/40 shadow-2xl' : 'border-white/5 bg-zinc-900/30'}`}>
              <button onClick={() => setExpandedCats(isExpanded ? expandedCats.filter(c => c !== category) : [...expandedCats, category])} className="w-full p-8 flex items-center justify-between group transition-colors"><div className="flex items-center gap-5 text-orange-500"><Box size={32}/><h2 className="text-lg font-black text-white tracking-widest uppercase">{category} ({items.length})</h2></div>{isExpanded ? <ChevronDown size={28} className="text-orange-500"/> : <ChevronRight size={28} className="text-zinc-800"/>}</button>
              {isExpanded && (
                <div className="overflow-x-auto border-t border-white/5 bg-black/30 p-6">
                  <table className="w-full text-left text-[12px] font-black border-separate border-spacing-y-3">
                    <thead className="text-zinc-600"><tr><th className="p-6 pl-8">Code</th><th className="p-6">Item Name</th><th className="p-6 text-center">Spec</th><th className="p-6 text-right">Stock</th><th className="p-6 text-center">Status</th><th className="p-6 text-center pr-8">Action</th></tr></thead>
                    <tbody>
                      {items.map(item => {
                        const isLow = item.quantity <= item.threshold;
                        return (
                          <tr key={item.id} className="bg-white/5 hover:bg-orange-600/10 transition-all rounded-2xl group">
                            <td className={`p-6 pl-8 rounded-l-[24px] border-l-4 ${isLow ? 'border-red-500/50' : 'border-transparent group-hover:border-orange-500'} text-zinc-500 font-black`}>{item.item_id_code}</td>
                            <td className="p-6 text-white font-bold">{item.item_name}</td>
                            <td className="p-6 text-center text-blue-400 font-black">{item.color} {item.size}</td>
                            <td className={`p-6 text-right font-black text-xl ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</td>
                            <td className="p-6 text-center">{isLow ? <span className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-xl text-[10px] animate-pulse">RESTOCK</span> : <span className="text-emerald-500/30 text-[10px] font-black">OK</span>}</td>
                            <td className="p-6 text-center pr-8 rounded-r-[24px]"><button onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }} className="p-3 bg-black/50 border border-white/10 rounded-xl text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-500 transition-all"><Edit size={16}/></button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-6 backdrop-blur-xl">
          <div className="bg-zinc-900 border border-orange-500/30 rounded-[56px] w-full max-w-xl p-12 space-y-8 shadow-2xl overflow-y-auto max-h-[92vh] no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-8 text-orange-500"><h2 className="text-3xl font-black italic uppercase tracking-tighter">Manage Inventory</h2><button onClick={() => setIsItemModalOpen(false)} className="p-4 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all text-white"><X size={24}/></button></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2"><label className="text-orange-500 font-black ml-2 uppercase text-[9px]">CATEGORY *</label><select className="w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-orange-500" value={editingItem.category} onChange={e => {const newCat = e.target.value; setEditingItem({...editingItem, category: newCat, item_id_code: editingItem.id ? editingItem.item_id_code : generateNextCode(newCat)})}}>{categoryConfig.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
              <div className="col-span-2 space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">ITEM NAME *</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-orange-500" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-blue-500 font-black ml-2 uppercase text-[9px]">CODE (AUTO)</label><input className="w-full bg-blue-500/10 border border-blue-500/30 p-5 rounded-3xl text-blue-400 font-black italic text-sm" value={editingItem.item_id_code} readOnly /></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">UNIT</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">COLOR</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">SIZE</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-emerald-500 font-black ml-2 uppercase text-[9px]">STOCK QUANTITY</label><input type="number" className="w-full bg-black border border-emerald-500/30 p-5 rounded-3xl outline-none text-emerald-400 font-black text-2xl focus:border-emerald-500" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-red-500 font-black ml-2 uppercase text-[9px]">LOW ALERT AT</label><input type="number" className="w-full bg-black border border-red-500/30 p-5 rounded-3xl outline-none text-red-400 font-black text-2xl focus:border-red-500" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-6 bg-orange-600 hover:bg-orange-500 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={24}/> Update Database</button>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL 2: RECEIVE STOCK (RESTOCK) */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-4 md:p-6 backdrop-blur-3xl animate-in zoom-in duration-300">
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-[56px] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 p-10 md:p-14 shrink-0 text-emerald-500"><h2 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-4"><Archive size={36}/> Receive Shipment</h2><div className="flex gap-2 mt-6 bg-black/60 p-1.5 rounded-[20px] w-fit"><button onClick={() => setRestockView('entry')} className={`px-10 py-3 rounded-2xl text-xs font-black uppercase transition-all ${restockView === 'entry' ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-600'}`}>New Entry</button><button onClick={() => setRestockView('history')} className={`px-10 py-3 rounded-2xl text-xs font-black uppercase transition-all ${restockView === 'history' ? 'bg-emerald-600 text-white' : 'text-zinc-600'}`}>History</button></div><button onClick={() => setIsRestockModalOpen(false)} className="p-4 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all shadow-xl"><X size={32}/></button></div>
            <div className="overflow-y-auto p-10 flex-1 no-scrollbar">
              {restockView === 'entry' ? (
                <div className="space-y-12 animate-in fade-in max-w-4xl mx-auto">
                  <div className="space-y-6">
                    {restockEntries.map((entry, index) => (
                      <div key={entry.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-black/50 p-6 rounded-[32px] border border-white/5 group hover:border-emerald-500/30 transition-all">
                        <div className="md:col-span-8"><select value={entry.inventory_id} onChange={(e) => updateRow(entry.id, 'inventory_id', e.target.value)} className="w-full bg-transparent text-base text-white font-black outline-none p-2 uppercase"><option value="">-- Select Product --</option>{inventory.map(i => <option key={i.id} value={i.id} className="bg-zinc-900">{i.category} | {i.item_id_code} {i.item_name}</option>)}</select></div>
                        <div className="md:col-span-3"><input type="number" min="1" placeholder="QTY" value={entry.qty} onChange={(e) => updateRow(entry.id, 'qty', e.target.value)} className="w-full bg-zinc-950 border-2 border-emerald-500/20 p-5 rounded-2xl text-center font-black text-emerald-400 outline-none focus:border-emerald-500 text-2xl" /></div>
                        <div className="md:col-span-1 flex justify-center"><button onClick={() => removeRow(entry.id)} className="text-zinc-800 hover:text-red-500 p-4 bg-white/5 rounded-2xl transition-colors"><Trash2 size={24}/></button></div>
                      </div>
                    ))}
                    <button onClick={addRow} className="w-full py-5 border-2 border-dashed border-zinc-800 rounded-3xl text-xs font-black uppercase text-zinc-600 hover:border-emerald-500 transition-all flex items-center justify-center gap-3"><Plus size={20}/> Add More Items</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end pt-12 border-t border-white/10 pb-10">
                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-zinc-600 ml-3 tracking-[0.2em] block">Delivery Document</label><label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed ${doFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-500/50'} rounded-[32px] cursor-pointer transition-all`}><Upload size={32} className="text-zinc-700"/><p className="text-xs">{doFile ? doFile.name : "Select Image"}</p><input type="file" className="hidden" accept="image/*" onChange={(e) => setDoFile(e.target.files?.[0] || null)} /></label></div>
                    <button onClick={handleRestockSubmit} disabled={isProcessingRestock} className="w-full h-32 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[40px] font-black uppercase shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4">{isProcessingRestock ? <Loader2 className="animate-spin" size={32}/> : <Save size={32}/>} Confirm Intake</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pb-20">
                  {history.map(h => (
                    <div key={h.id} className="bg-black/40 border border-white/5 p-8 rounded-[40px] flex justify-between items-center group shadow-xl">
                      <div className="flex items-center gap-8"><a href={h.receipt_url} target="_blank" rel="noopener noreferrer" className="p-5 bg-emerald-500/10 text-emerald-500 rounded-[24px] shadow-lg"><FileText size={32}/></a><div><p className="text-white font-black text-lg uppercase italic">{h.item_name}</p><div className="flex gap-6 mt-2 text-zinc-600 font-bold uppercase text-[10px] tracking-widest"><span>{new Date(h.created_at).toLocaleString()}</span><span>By: {h.added_by}</span></div></div></div>
                      <div className="text-right"><p className="text-emerald-500 font-black text-2xl">+{h.quantity_added}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() { return ( <Suspense fallback={<div>Loading...</div>}><InventoryContent /></Suspense> ) }
