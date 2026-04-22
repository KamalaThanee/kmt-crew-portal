'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Package, Search, AlertTriangle, Download, Plus, Edit, X, Save, Box, ChevronDown, ChevronRight, Archive, FileText, Loader2, CheckCircle2, Trash2 } from 'lucide-react'
import imageCompression from 'browser-image-compression'

function InventoryContent() {
  const searchParams = useSearchParams()
  const [inventory, setInventory] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
  const [showLowStock, setShowLowStock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedCats, setExpandedCats] = useState<string[]>([])

  // Modals States
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [restockView, setRestockView] = useState<'entry' | 'history'>('entry')

  // Restock States
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
      const matchesStock = showLowStock ? item.quantity <= item.threshold : true
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

  // --- Handlers ---
  const handleSaveItem = async () => {
    if (!editingItem.item_name || !editingItem.category) return toast.error('Please fill required fields')
    const { error } = await supabase.from('ppe_inventory').upsert({
      id: editingItem.id || undefined, item_name: editingItem.item_name, item_id_code: editingItem.item_id_code,
      category: editingItem.category, color: editingItem.color, size: editingItem.size,
      quantity: Number(editingItem.quantity), threshold: Number(editingItem.threshold), unit: editingItem.unit || 'Piece'
    })
    if (!error) { toast.success('Inventory Saved'); setIsItemModalOpen(false); fetchData(); }
    else toast.error('Save failed')
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
    toast.success("Excel Downloaded!");
  }

  // --- Restock Logic ---
  const addRow = () => setRestockEntries([...restockEntries, { id: Date.now(), inventory_id: '', qty: '' }])
  const removeRow = (id: number) => setRestockEntries(restockEntries.filter(e => e.id !== id))
  const updateRow = (id: number, field: string, value: string) => setRestockEntries(restockEntries.map(e => e.id === id ? { ...e, [field]: value } : e))

  const handleRestockSubmit = async () => {
    const validEntries = restockEntries.filter(e => e.inventory_id && e.qty && Number(e.qty) > 0)
    if (validEntries.length === 0) return toast.error('Please add at least one valid item')
    if (!doFile) return toast.error('Delivery Order (DO) document is required')

    setIsProcessingRestock(true)
    try {
      // 1. Upload DO with Ultra Compression
      let fileToUpload: Blob = doFile;
      if (doFile.type.includes('image')) {
        fileToUpload = await imageCompression(doFile, { maxSizeMB: 0.3, maxWidthOrHeight: 1024, useWebWorker: true });
      }
      
      const fileName = `DO_${Date.now()}_${doFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from('do-files').upload(fileName, fileToUpload)
      if (uploadError) throw new Error("File upload failed")
      
      const { data: { publicUrl } } = supabase.storage.from('do-files').getPublicUrl(fileName)
      const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')

      // 2. Process Batch
      for (const entry of validEntries) {
        const item = inventory.find(i => String(i.id) === String(entry.inventory_id))
        if (!item) continue;

        // Update Stock
        await supabase.from('ppe_inventory').update({ quantity: Number(item.quantity) + Number(entry.qty) }).eq('id', item.id)

        // Insert History (1 row per item)
        await supabase.from('restock_history').insert({
          item_id: item.id, item_name: item.item_name, quantity_added: Number(entry.qty),
          added_by: admin.full_name || 'Admin', receipt_url: publicUrl
        })
      }

      toast.success(`Successfully received ${validEntries.length} items`)
      setRestockEntries([{ id: Date.now(), inventory_id: '', qty: '' }]) 
      setDoFile(null)
      setRestockView('history')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || 'Error processing goods receipt')
    } finally {
      setIsProcessingRestock(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase tracking-[0.3em] text-xs">Accessing Inventory...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-24 font-sans text-white uppercase font-bold text-[10px]">
      
      {/* HEADER & ACTIONS */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3 tracking-tighter"><Package className="text-orange-500" size={32}/> Inventory Management</h1>
           <p className="text-zinc-500 tracking-[0.2em] mt-2">Enterprise Stock Database</p>
        </div>
        <div className="flex flex-wrap gap-3">
           <button onClick={() => { setRestockView('entry'); setIsRestockModalOpen(true); }} className="px-6 py-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 transition-all"><Archive size={16}/> Receive Stock</button>
           <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsItemModalOpen(true); }} className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all"><Plus size={16}/> Add Item</button>
           <button onClick={exportToExcel} className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-2xl text-blue-400 font-black text-[10px] uppercase flex items-center gap-2 transition-all"><Download size={16}/> Export</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-zinc-900/50 p-4 rounded-[32px] border border-white/5 mb-8 shadow-2xl">
        <div className="relative md:col-span-2"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/><input type="text" placeholder="Search code or name..." className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-all text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <select className="bg-black/50 border border-white/10 rounded-2xl py-4 px-4 text-white outline-none focus:border-orange-500 text-xs font-bold" value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowLowStock(!showLowStock)} className={`rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border transition-all ${showLowStock ? 'bg-red-500/10 border-red-500 text-red-500 shadow-inner' : 'bg-black/50 border-white/10 text-zinc-500 hover:border-red-500/50 hover:text-red-500'}`}><AlertTriangle size={14}/> {showLowStock ? 'Low Stock Active' : 'Filter Low Stock'}</button>
      </div>

      {/* DATA TABLES */}
      <div className="space-y-4">
        {Object.keys(filteredInventoryGrouped).length === 0 && <div className="py-20 text-center text-zinc-600 font-black text-sm">NO ITEMS FOUND</div>}
        {Object.entries(filteredInventoryGrouped).map(([category, items]) => {
          const isExpanded = expandedCats.includes(category);
          return (
            <div key={category} className={`border rounded-[32px] overflow-hidden transition-all ${isExpanded ? 'border-orange-500/30 bg-black/40 shadow-[0_0_30px_rgba(249,115,22,0.1)]' : 'border-white/5 bg-zinc-900/30 hover:border-white/20'}`}>
              <button onClick={() => setExpandedCats(isExpanded ? expandedCats.filter(c => c !== category) : [...expandedCats, category])} className="w-full p-6 md:p-8 flex items-center justify-between outline-none transition-colors">
                <div className="flex items-center gap-4 text-orange-500"><Box size={24}/><h2 className="text-sm md:text-base font-black text-white tracking-widest uppercase">{category} <span className="text-zinc-600 ml-2">({items.length})</span></h2></div>
                {isExpanded ? <ChevronDown size={24} className="text-orange-500"/> : <ChevronRight size={24} className="text-zinc-600"/>}
              </button>

              {isExpanded && (
                <div className="overflow-x-auto border-t border-white/5 p-4">
                  <table className="w-full text-left text-[11px] font-black uppercase whitespace-nowrap border-separate border-spacing-y-2">
                    <thead className="text-zinc-500 bg-black/40"><tr className="rounded-xl overflow-hidden"><th className="p-4 pl-6">Code</th><th className="p-4">Item Name</th><th className="p-4">Spec</th><th className="p-4 text-right">In Stock</th><th className="p-4 text-center">Status</th><th className="p-4 text-center pr-6">Action</th></tr></thead>
                    <tbody className="text-zinc-300">
                      {items.map(item => {
                        const isLow = item.quantity <= item.threshold;
                        return (
                          <tr key={item.id} className="bg-zinc-900/50 hover:bg-orange-600/10 transition-colors group">
                            <td className={`p-4 pl-6 rounded-l-2xl border-l-4 ${isLow ? 'border-red-500/50' : 'border-white/5 group-hover:border-orange-500'} text-zinc-500`}>{item.item_id_code}</td>
                            <td className="p-4 text-white text-sm">{item.item_name}</td>
                            <td className="p-4 text-blue-400">{item.color || '-'} {item.size || '-'}</td>
                            <td className={`p-4 text-right font-black text-base ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity} <span className="text-[8px] text-zinc-600 ml-1">{item.unit || 'PC'}</span></td>
                            <td className="p-4 text-center">{isLow ? <span className="bg-red-500/10 border border-red-500/20 text-red-500 px-2 py-1 rounded-md text-[8px] animate-pulse">RESTOCK</span> : <span className="text-emerald-500/30 text-[8px]">OK</span>}</td>
                            <td className="p-4 text-center pr-6 rounded-r-2xl"><button onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }} className="p-2 bg-black/50 border border-white/5 rounded-lg text-orange-400 hover:bg-orange-600 hover:text-white transition-all"><Edit size={14}/></button></td>
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

      {/* 🛠️ MODAL 1: ADD/EDIT INVENTORY ITEM */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-zinc-900 border border-orange-500/20 rounded-[48px] w-full max-w-lg p-10 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-6 text-orange-500"><h2 className="text-2xl font-black italic uppercase tracking-tighter">{editingItem.id ? 'Edit' : 'Add New'} Item</h2><button onClick={() => setIsItemModalOpen(false)} className="p-3 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all"><X size={20}/></button></div>
            <div className="grid grid-cols-2 gap-4 text-[10px]">
              <div className="col-span-2 space-y-2"><label className="text-orange-500 font-black ml-1 uppercase">Category *</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm" value={editingItem.category} onChange={e => {const newCat = e.target.value; setEditingItem({...editingItem, category: newCat, item_id_code: editingItem.id ? editingItem.item_id_code : generateNextCode(newCat)})}}>{categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="col-span-2 space-y-2"><label className="font-black ml-1 uppercase">Item Name *</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm focus:border-orange-500" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-blue-500 font-black ml-1 uppercase">Code (Auto)</label><input className="w-full bg-blue-500/10 border border-blue-500/30 p-5 rounded-2xl outline-none text-blue-400 font-black text-sm italic" value={editingItem.item_id_code} readOnly /></div>
              <div className="space-y-2"><label className="font-black ml-1 uppercase">Unit</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm focus:border-orange-500" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})}/></div>
              <div className="space-y-2"><label className="font-black ml-1 uppercase">Color</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm focus:border-orange-500" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-2"><label className="font-black ml-1 uppercase">Size</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm focus:border-orange-500" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-emerald-500 font-black ml-1 uppercase">Current Stock</label><input type="number" className="w-full bg-black border border-emerald-500/20 p-5 rounded-2xl outline-none text-emerald-400 font-black text-lg focus:border-emerald-500" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-red-500 font-black ml-1 uppercase">Alert Threshold</label><input type="number" className="w-full bg-black border border-red-500/20 p-5 rounded-2xl outline-none text-red-400 font-black text-lg focus:border-red-500" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-6 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={20}/> Save Master Data</button>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL 2: RECEIVE STOCK (RESTOCK) */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-6 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-zinc-900 border border-emerald-500/20 rounded-[48px] w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(16,185,129,0.1)]">
            <div className="flex justify-between items-center border-b border-white/5 p-8 md:p-10 shrink-0">
               <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-emerald-500 flex items-center gap-3"><Archive/> Receive Stock</h2>
                  <div className="flex gap-2 mt-4 bg-black/50 p-1 rounded-xl w-fit">
                     <button onClick={() => setRestockView('entry')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${restockView === 'entry' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-white'}`}>New Entry</button>
                     <button onClick={() => setRestockView('history')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${restockView === 'history' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-white'}`}>History</button>
                  </div>
               </div>
               <button onClick={() => setIsRestockModalOpen(false)} className="p-3 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all self-start"><X size={24}/></button>
            </div>

            <div className="overflow-y-auto p-8 md:p-10 flex-1 no-scrollbar">
              {restockView === 'entry' ? (
                <div className="space-y-8 animate-in fade-in">
                  <div className="space-y-4">
                    <h3 className="text-zinc-500 tracking-widest text-xs font-black border-b border-white/5 pb-2 uppercase flex items-center gap-2"><Plus size={16}/> Line Items</h3>
                    <div className="hidden md:grid grid-cols-12 gap-4 text-[10px] font-black uppercase text-zinc-500 tracking-widest px-2">
                      <div className="col-span-8">Product Details</div><div className="col-span-3 text-center">Receive Qty</div><div className="col-span-1"></div>
                    </div>
                    {restockEntries.map((entry, index) => (
                      <div key={entry.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                        <div className="md:col-span-8">
                          <select value={entry.inventory_id} onChange={(e) => updateRow(entry.id, 'inventory_id', e.target.value)} className="w-full bg-transparent text-sm text-white font-bold outline-none cursor-pointer p-2">
                            <option value="" className="bg-zinc-900">-- Select Product --</option>
                            {inventory.map(i => <option key={i.id} value={i.id} className="bg-zinc-900 uppercase">{i.item_id_code ? `[${i.item_id_code}] ` : ''}{i.item_name} {i.color ? ` - ${i.color}` : ''} {i.size ? ` (Size: ${i.size})` : ''}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-3">
                          <input type="number" min="1" placeholder="QTY" value={entry.qty} onChange={(e) => updateRow(entry.id, 'qty', e.target.value)} className="w-full bg-zinc-900 border border-emerald-500/20 p-4 rounded-xl text-center font-black text-emerald-400 outline-none focus:border-emerald-500 text-lg" />
                        </div>
                        <div className="md:col-span-1 flex justify-center">
                          <button onClick={() => removeRow(entry.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-3 bg-white/5 rounded-xl"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                    <button onClick={addRow} className="w-full py-4 border border-dashed border-white/20 rounded-2xl text-xs font-black uppercase text-zinc-500 hover:border-emerald-500 hover:text-emerald-500 transition-colors flex items-center justify-center gap-2"><Plus size={16}/> Add Another Item</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end pt-8 border-t border-white/5">
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-500 mb-2 block tracking-widest">Supporting Document (DO/Invoice)</label>
                      <label className={`flex items-center justify-center w-full h-20 border-2 border-dashed ${doFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-500/50'} rounded-3xl cursor-pointer transition-colors`}>
                        {doFile ? <div className="text-emerald-500 font-black text-xs uppercase flex items-center gap-2"><CheckCircle2 size={20}/> {doFile.name}</div> : <div className="text-blue-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><Upload size={20}/> Select DO File (Image)</div>}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => setDoFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <button onClick={handleRestockSubmit} disabled={isProcessingRestock} className="w-full h-20 bg-emerald-600 hover:bg-emerald-500 rounded-3xl font-black uppercase text-sm tracking-widest shadow-xl shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-white">
                      {isProcessingRestock ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>} Save Goods Receipt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  {history.length === 0 && <p className="text-center py-20 text-zinc-600 font-black uppercase text-xs tracking-widest">No history found</p>}
                  {history.map(h => (
                    <div key={h.id} className="bg-black/40 border border-white/5 p-6 rounded-3xl flex justify-between items-center hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-6">
                        <a href={h.receipt_url} target="_blank" rel="noopener noreferrer" className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg"><FileText size={24}/></a>
                        <div><p className="text-white font-bold text-sm uppercase">{h.item_name}</p><div className="flex gap-4 mt-2"><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{new Date(h.created_at).toLocaleString()}</span><span className="text-[10px] text-zinc-500 uppercase tracking-widest">By: {h.added_by}</span></div></div>
                      </div>
                      <div className="text-right"><p className="text-emerald-500 font-black text-2xl">+{h.quantity_added}</p><p className="text-[8px] text-zinc-600 uppercase font-black tracking-widest">Stock Added</p></div>
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

export default function InventoryPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><InventoryContent /></Suspense> )
}
