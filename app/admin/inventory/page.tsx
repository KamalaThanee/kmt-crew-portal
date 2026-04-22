'use client'
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { 
  Package, Search, AlertTriangle, Download, Plus, Edit, X, Save, 
  Box, ChevronDown, ChevronRight, Archive, FileText, Loader2, 
  CheckCircle2, Trash2, Upload, Clock, User 
} from 'lucide-react'
import imageCompression from 'browser-image-compression'

function InventoryContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [inventory, setInventory] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
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
    fetchData()
  }, [searchParams])

  const categories = useMemo(() => ['All', ...new Set(inventory.map(i => i.category).filter(Boolean))].sort(), [inventory])

  const generateNextCode = (catName: string) => {
    const catItems = inventory.filter(i => i.category === catName)
    const numbers = catItems.map(i => {
      const match = String(i.item_id_code).match(/\d+$/)
      return match ? parseInt(match[0]) : 0
    })
    return `${catName}-${numbers.length > 0 ? Math.max(...numbers) + 1 : 1}`
  }

  const categoryOrder = ['Head Protection', 'Ears Protection', 'Eyes Protection', 'Respiratory Protection', 'Body Protection', 'Hands Protection', 'Foots Protection', 'Other']

  const filteredInventoryGrouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const filtered = inventory.filter(item => {
      const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || item.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCat = selectedCat === 'All' || item.category === selectedCat
      const matchesStock = showLowStock ? (item.quantity <= item.threshold) : true
      return matchesSearch && matchesCat && matchesStock
    })

    filtered.forEach(item => {
      const cat = item.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })

    const sortedGroups: Record<string, any[]> = {}
    Object.keys(groups).sort((a, b) => {
        const catA = categoryOrder.indexOf(a); const catB = categoryOrder.indexOf(b);
        if (catA !== -1 && catB !== -1) return catA - catB;
        if (catA !== -1) return -1; if (catB !== -1) return 1;
        return a.localeCompare(b);
      }).forEach(key => {
        groups[key] = groups[key].sort((a, b) => (a.item_id_code || "").localeCompare((b.item_id_code || ""), undefined, { numeric: true }))
        sortedGroups[key] = groups[key]
      })

    if (searchTerm || showLowStock || selectedCat !== 'All') setExpandedCats(Object.keys(sortedGroups));
    return sortedGroups
  }, [inventory, searchTerm, selectedCat, showLowStock])

  const handleSaveItem = async () => {
    if (!editingItem.item_name || !editingItem.category) return toast.error('Required fields missing')
    const { error } = await supabase.from('ppe_inventory').upsert({
      id: editingItem.id || undefined, item_name: editingItem.item_name, item_id_code: editingItem.item_id_code,
      category: editingItem.category, color: editingItem.color, size: editingItem.size,
      quantity: Number(editingItem.quantity), threshold: Number(editingItem.threshold), unit: editingItem.unit || 'Piece'
    })
    if (!error) { toast.success('Inventory Saved'); setIsItemModalOpen(false); fetchData(); }
  }

  const exportToExcel = () => {
    const dataToExport: any[] = [];
    Object.values(filteredInventoryGrouped).forEach(items => {
      items.forEach(item => {
        dataToExport.push({
          'Item Code': item.item_id_code, 'Item Name': item.item_name, 'Category': item.category,
          'Color': item.color || '-', 'Size': item.size || '-', 'Qty': item.quantity, 'Unit': item.unit,
          'Status': item.quantity <= item.threshold ? 'LOW STOCK' : 'OK'
        })
      })
    })
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `KMT_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  const addRow = () => setRestockEntries([...restockEntries, { id: Date.now(), inventory_id: '', qty: '' }])
  const removeRow = (id: number) => setRestockEntries(restockEntries.filter(e => e.id !== id))
  const updateRow = (id: number, field: string, value: string) => setRestockEntries(restockEntries.map(e => e.id === id ? { ...e, [field]: value } : e))

  const handleRestockSubmit = async () => {
    const validEntries = restockEntries.filter(e => e.inventory_id && e.qty && Number(e.qty) > 0)
    if (validEntries.length === 0 || !doFile) return toast.error('Items and DO file required')

    setIsProcessingRestock(true)
    try {
      let fileToUpload: Blob = doFile;
      if (doFile.type.includes('image')) {
        fileToUpload = await imageCompression(doFile, { maxSizeMB: 0.3, maxWidthOrHeight: 1024, useWebWorker: true });
      }
      const fileName = `DO_${Date.now()}_${doFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from('do-files').upload(fileName, fileToUpload)
      if (uploadError) throw new Error("Upload failed")
      const { data: { publicUrl } } = supabase.storage.from('do-files').getPublicUrl(fileName)
      const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')

      for (const entry of validEntries) {
        const item = inventory.find(i => String(i.id) === String(entry.inventory_id))
        if (!item) continue;
        await supabase.from('ppe_inventory').update({ quantity: Number(item.quantity) + Number(entry.qty) }).eq('id', item.id)
        await supabase.from('restock_history').insert({
          item_id: item.id, item_name: item.item_name, quantity_added: Number(entry.qty),
          added_by: admin.full_name || 'Admin', receipt_url: publicUrl
        })
      }
      toast.success('Restock Complete'); setRestockEntries([{ id: Date.now(), inventory_id: '', qty: '' }]); setDoFile(null); setRestockView('history'); fetchData();
    } catch (e: any) { toast.error(e.message) } 
    finally { setIsProcessingRestock(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">Loading...</div>

  return (
    <div className="p-4 md:p-12 max-w-[1600px] mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div><h1 className="text-4xl md:text-5xl font-black italic flex items-center gap-4 tracking-tighter text-white"><Package className="text-blue-500" size={40}/> Inventory</h1><p className="text-zinc-500 tracking-[0.3em] mt-2 ml-1">Enterprise Database</p></div>
        <div className="flex flex-wrap gap-3">
           <button onClick={() => { setRestockView('entry'); setIsRestockModalOpen(true); }} className="px-8 py-4 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-[20px] font-black text-xs flex items-center gap-3 transition-all active:scale-95"><Archive size={18}/> Receive Stock</button>
           <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsItemModalOpen(true); }} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-[20px] font-black text-xs flex items-center gap-3 active:scale-95 transition-all"><Plus size={18}/> Add Item</button>
           <button onClick={exportToExcel} className="px-8 py-4 bg-zinc-900 border border-white/10 rounded-[20px] text-blue-400 font-black text-xs flex items-center gap-3 active:scale-95 transition-all"><Download size={18}/> Export</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-900/50 p-6 rounded-[40px] border border-white/5 mb-10 shadow-inner">
        <div className="relative md:col-span-2"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20}/><input type="text" placeholder="Search..." className="w-full bg-black/60 border border-white/10 rounded-[24px] py-4 pl-14 pr-6 text-white outline-none focus:border-orange-500 transition-all text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <select className="bg-black/60 border border-white/10 rounded-[24px] py-4 px-6 text-white outline-none focus:border-orange-500 text-xs font-black cursor-pointer appearance-none text-center" value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <button onClick={() => setShowLowStock(!showLowStock)} className={`rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-3 border transition-all ${showLowStock ? 'bg-red-500/20 border-red-500 text-red-500 shadow-inner' : 'bg-black/40 border-white/10 text-zinc-600 hover:text-red-500'}`}><AlertTriangle size={18}/> {showLowStock ? 'Low Stock Only' : 'Filter Low Stock'}</button>
      </div>

      <div className="space-y-6">
        {Object.entries(filteredInventoryGrouped).map(([category, items]) => {
          const isExpanded = expandedCats.includes(category);
          return (
            <div key={category} className={`border rounded-[40px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-orange-500/30 bg-black/40 shadow-2xl' : 'border-white/5 bg-zinc-900/30'}`}>
              <button onClick={() => setExpandedCats(isExpanded ? expandedCats.filter(c => c !== category) : [...expandedCats, category])} className="w-full p-8 flex items-center justify-between outline-none group transition-colors"><div className="flex items-center gap-5 text-orange-500"><Box size={32}/><h2 className="text-lg font-black text-white tracking-widest uppercase">{category} <span className="text-zinc-600 ml-3">({items.length})</span></h2></div>{isExpanded ? <ChevronDown size={28} className="text-orange-500"/> : <ChevronRight size={28} className="text-zinc-800"/>}</button>
              {isExpanded && (
                <div className="overflow-x-auto border-t border-white/5 bg-black/30 p-6">
                  <table className="w-full text-left text-[12px] font-black uppercase whitespace-nowrap border-separate border-spacing-y-3">
                    <thead className="text-zinc-600 bg-black/20"><tr><th className="p-6 pl-8">Code</th><th className="p-6">Item Name</th><th className="p-6 text-center">Color/Size</th><th className="p-6 text-right">In Stock</th><th className="p-6 text-center">Status</th><th className="p-6 text-center pr-8">Action</th></tr></thead>
                    <tbody className="text-zinc-300">
                      {items.map(item => {
                        const isLow = item.quantity <= item.threshold;
                        return (
                          <tr key={item.id} className="bg-white/5 hover:bg-orange-600/10 transition-all rounded-2xl group">
                            <td className={`p-6 pl-8 rounded-l-[24px] border-l-4 ${isLow ? 'border-red-500/50' : 'border-transparent group-hover:border-orange-500'} text-zinc-500 font-black`}>{item.item_id_code}</td>
                            <td className="p-6 text-white font-bold">{item.item_name}</td>
                            <td className="p-6 text-center text-blue-400 font-black">{item.color || '-'} {item.size || '-'}</td>
                            <td className={`p-6 text-right font-black text-xl ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity} <span className="text-[10px] text-zinc-600 font-normal ml-1">{item.unit || 'PC'}</span></td>
                            <td className="p-6 text-center">{isLow ? <span className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-xl text-[10px] animate-pulse">RESTOCK</span> : <span className="text-emerald-500/30 text-[10px] font-black">OK</span>}</td>
                            <td className="p-6 text-center pr-8 rounded-r-[24px]"><button onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }} className="p-3 bg-black/50 border border-white/10 rounded-xl text-orange-400 hover:text-white transition-all"><Edit size={16}/></button></td>
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
        <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-6 backdrop-blur-3xl animate-in zoom-in duration-300">
          <div className="bg-zinc-900 border border-orange-500/30 rounded-[56px] w-full max-w-xl p-12 space-y-8 shadow-2xl overflow-y-auto max-h-[92vh] no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-8 text-orange-500"><h2 className="text-3xl font-black italic uppercase tracking-tighter">Edit Item</h2><button onClick={() => setIsItemModalOpen(false)} className="p-4 bg-white/5 rounded-full hover:bg-red-500 transition-all text-white"><X size={24}/></button></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2"><label className="text-orange-500 font-black ml-2 uppercase text-[9px]">CATEGORY *</label><select className="w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-orange-500" value={editingItem.category} onChange={e => {const newCat = e.target.value; setEditingItem({...editingItem, category: newCat, item_id_code: editingItem.id ? editingItem.item_id_code : generateNextCode(newCat)})}}>{categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="col-span-2 space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">ITEM NAME *</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-orange-500" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-blue-500 font-black ml-2 uppercase text-[9px]">CODE (AUTO)</label><input className="w-full bg-blue-500/10 border border-blue-500/30 p-5 rounded-3xl text-blue-400 font-black italic text-sm" value={editingItem.item_id_code} readOnly /></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">UNIT</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">COLOR</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">SIZE</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-emerald-500 font-black ml-2 uppercase text-[9px]">STOCK QUANTITY</label><input type="number" className="w-full bg-black border border-emerald-500/30 p-5 rounded-3xl outline-none text-emerald-400 font-black text-2xl focus:border-emerald-500" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-red-500 font-black ml-2 uppercase text-[9px]">LOW ALERT AT</label><input type="number" className="w-full bg-black border border-red-500/30 p-5 rounded-3xl outline-none text-red-400 font-black text-2xl focus:border-red-500" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-6 bg-orange-600 hover:bg-orange-500 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={24}/> Update Master Data</button>
          </div>
        </div>
      )}

      {isRestockModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-4 md:p-6 backdrop-blur-3xl animate-in zoom-in duration-300">
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-[56px] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 p-10 md:p-14 shrink-0">
               <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter text-emerald-500 flex items-center gap-4"><Archive size={36}/> Receive Shipment</h2>
                  <div className="flex gap-2 mt-6 bg-black/60 p-1.5 rounded-[20px] w-fit">
                     <button onClick={() => setRestockView('entry')} className={`px-10 py-3 rounded-2xl text-xs font-black uppercase transition-all ${restockView === 'entry' ? 'bg-emerald-600 text-white' : 'text-zinc-600 hover:text-zinc-200'}`}>New Entry</button>
                     <button onClick={() => setRestockView('history')} className={`px-10 py-3 rounded-2xl text-xs font-black uppercase transition-all ${restockView === 'history' ? 'bg-emerald-600 text-white' : 'text-zinc-600 hover:text-zinc-200'}`}>History</button>
                  </div>
               </div>
               <button onClick={() => setIsRestockModalOpen(false)} className="p-4 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all self-start shadow-xl"><X size={32}/></button>
            </div>
            <div className="overflow-y-auto p-10 md:p-14 flex-1 no-scrollbar pb-24">
              {restockView === 'entry' ? (
                <div className="space-y-12 animate-in fade-in max-w-4xl mx-auto">
                  <div className="space-y-6">
                    <h3 className="text-zinc-600 tracking-widest text-[10px] font-black border-b border-white/5 pb-4 uppercase flex items-center gap-3"><Plus size={18} className="text-emerald-500"/> Line Items</h3>
                    {restockEntries.map((entry, index) => (
                      <div key={entry.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-black/50 p-6 rounded-[32px] border border-white/5 group hover:border-emerald-500/30 transition-all">
                        <div className="md:col-span-8"><select value={entry.inventory_id} onChange={(e) => updateRow(entry.id, 'inventory_id', e.target.value)} className="w-full bg-transparent text-base text-white font-black outline-none cursor-pointer p-2 uppercase"><option value="" className="bg-zinc-900">-- Select Product --</option>{inventory.map(i => <option key={i.id} value={i.id} className="bg-zinc-900">{i.item_id_code ? `[${i.item_id_code}] ` : ''}{i.item_name} {i.color ? ` - ${i.color}` : ''} {i.size ? ` (${i.size})` : ''}</option>)}</select></div>
                        <div className="md:col-span-3"><input type="number" min="1" placeholder="QTY" value={entry.qty} onChange={(e) => updateRow(entry.id, 'qty', e.target.value)} className="w-full bg-zinc-950 border-2 border-emerald-500/20 p-5 rounded-2xl text-center font-black text-emerald-400 outline-none focus:border-emerald-500 text-2xl" /></div>
                        <div className="md:col-span-1 flex justify-center"><button onClick={() => removeRow(entry.id)} className="text-zinc-800 hover:text-red-500 p-4 bg-white/5 rounded-2xl transition-colors"><Trash2 size={24}/></button></div>
                      </div>
                    ))}
                    <button onClick={addRow} className="w-full py-5 border-2 border-dashed border-zinc-800 rounded-3xl text-xs font-black uppercase text-zinc-600 hover:border-emerald-500 transition-all flex items-center justify-center gap-3"><Plus size={20}/> Add More Line Items</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end pt-12 border-t border-white/10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-zinc-600 ml-3 tracking-[0.2em] block">Delivery Document Image</label>
                      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed ${doFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-500/50'} rounded-[32px] cursor-pointer transition-all`}>
                        {doFile ? <div className="text-emerald-500 font-black text-xs uppercase flex items-center gap-3"><CheckCircle2 size={24}/> {doFile.name}</div> : <div className="text-zinc-700 font-black text-[10px] uppercase tracking-widest flex flex-col items-center gap-3"><Upload size={32} className="opacity-20"/> Select DO Image</div>}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => setDoFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <button onClick={handleRestockSubmit} disabled={isProcessingRestock} className="w-full h-32 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[40px] font-black uppercase text-lg tracking-widest shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4">{isProcessingRestock ? <Loader2 className="animate-spin" size={32}/> : <Save size={32}/>} Confirm Intake</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto pb-20">
                  {history.length === 0 && <p className="text-center py-20 text-zinc-800 font-black uppercase text-xs">No records found</p>}
                  {history.map(h => (
                    <div key={h.id} className="bg-black/40 border border-white/5 p-8 rounded-[40px] flex justify-between items-center hover:bg-white/5 transition-all group shadow-xl">
                      <div className="flex items-center gap-8">
                        <a href={h.receipt_url} target="_blank" rel="noopener noreferrer" className="p-5 bg-emerald-500/10 text-emerald-500 rounded-[24px] hover:bg-emerald-500 transition-all"><FileText size={32}/></a>
                        <div><p className="text-white font-black text-lg uppercase italic">{h.item_name}</p><div className="flex gap-6 mt-2 text-zinc-600 font-bold uppercase text-[10px] tracking-widest"><span className="flex items-center gap-2"><Clock size={14}/> {new Date(h.created_at).toLocaleString()}</span><span className="flex items-center gap-2"><User size={14}/> {h.added_by}</span></div></div>
                      </div>
                      <div className="text-right"><p className="text-emerald-500 font-black text-2xl">+{h.quantity_added}</p><p className="text-[10px] text-zinc-700 font-black uppercase mt-1">Stock Added</p></div>
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
