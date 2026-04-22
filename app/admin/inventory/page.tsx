'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Package, Search, AlertTriangle, Download, Plus, Edit, X, Save, Box } from 'lucide-react'

function InventoryContent() {
  const searchParams = useSearchParams()
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
  const [showLowStock, setShowLowStock] = useState(false)
  const [loading, setLoading] = useState(true)

  // Edit/Add States
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase.from('ppe_inventory').select('*')
    if (data) setInventory(data)
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

    // Sort keys by categoryOrder
    const sortedGroups: Record<string, any[]> = {}
    Object.keys(groups)
      .sort((a, b) => {
        const catA = categoryOrder.indexOf(a); const catB = categoryOrder.indexOf(b);
        if (catA !== -1 && catB !== -1) return catA - catB;
        if (catA !== -1) return -1; if (catB !== -1) return 1;
        return a.localeCompare(b);
      })
      .forEach(key => {
        groups[key] = groups[key].sort((a, b) => (a.item_id_code || "").localeCompare((b.item_id_code || ""), undefined, { numeric: true }))
        sortedGroups[key] = groups[key]
      })

    return sortedGroups
  }, [inventory, searchTerm, selectedCat, showLowStock])

  const handleSaveItem = async () => {
    if (!editingItem.item_name || !editingItem.category) return toast.error('Please fill required fields')
    const { error } = await supabase.from('ppe_inventory').upsert({
      id: editingItem.id || undefined, item_name: editingItem.item_name, item_id_code: editingItem.item_id_code,
      category: editingItem.category, color: editingItem.color, size: editingItem.size,
      quantity: Number(editingItem.quantity), threshold: Number(editingItem.threshold), unit: editingItem.unit || 'Piece'
    })
    if (!error) { toast.success('Inventory Saved'); setIsModalOpen(false); fetchData(); }
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse">LOADING INVENTORY...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-24 font-sans text-white uppercase font-bold text-[10px]">
      
      {/* HEADER & ACTIONS */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3"><Package className="text-blue-500" size={32}/> Inventory Management</h1>
           <p className="text-zinc-500 tracking-[0.2em] mt-2">Enterprise Stock Database</p>
        </div>
        <div className="flex gap-3">
           <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsModalOpen(true); }} className="px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all"><Plus size={16}/> Add Item</button>
           <button onClick={exportToExcel} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-blue-400 font-black text-[10px] uppercase flex items-center gap-2 transition-all"><Download size={16}/> Export</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-zinc-900/50 p-4 rounded-2xl border border-white/5 mb-8">
        <div className="relative md:col-span-2"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/><input type="text" placeholder="Search code or name..." className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-all text-xs" onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <select className="bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white outline-none focus:border-orange-500 text-xs" value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowLowStock(!showLowStock)} className={`rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border transition-all ${showLowStock ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-black/50 border-white/10 text-zinc-500 hover:border-red-500/50 hover:text-red-500'}`}><AlertTriangle size={14}/> {showLowStock ? 'Low Stock Only' : 'Filter Low Stock'}</button>
      </div>

      {/* DATA TABLES (GROUPED BY CATEGORY) */}
      <div className="space-y-8">
        {Object.keys(filteredInventoryGrouped).length === 0 && <div className="py-20 text-center text-zinc-600">NO ITEMS FOUND</div>}
        {Object.entries(filteredInventoryGrouped).map(([category, items]) => (
          <div key={category} className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-black/40 p-5 flex items-center gap-3 border-b border-white/5"><Box className="text-orange-500" size={20}/><h2 className="text-sm font-black text-white tracking-widest">{category} <span className="text-zinc-600 ml-2">({items.length})</span></h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-bold uppercase whitespace-nowrap">
                <thead className="text-zinc-500 bg-zinc-950/30"><tr><th className="p-4 pl-6">Code</th><th className="p-4">Item Name</th><th className="p-4">Spec</th><th className="p-4 text-right">In Stock</th><th className="p-4 text-center">Status</th><th className="p-4 text-center pr-6">Action</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {items.map(item => {
                    const isLow = item.quantity <= item.threshold;
                    return (
                      <tr key={item.id} className={`hover:bg-white/5 transition-colors ${isLow ? 'bg-red-500/5' : ''}`}>
                        <td className="p-4 pl-6 text-zinc-500 font-black">{item.item_id_code}</td>
                        <td className="p-4 text-white text-sm">{item.item_name}</td>
                        <td className="p-4 text-blue-400">{item.color || '-'} {item.size || '-'}</td>
                        <td className={`p-4 text-right font-black text-sm ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity} <span className="text-[8px] text-zinc-600 ml-1">{item.unit || 'PC'}</span></td>
                        <td className="p-4 text-center">{isLow ? <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded text-[8px] animate-pulse">RESTOCK</span> : <span className="text-emerald-500/30 text-[8px]">OK</span>}</td>
                        <td className="p-4 text-center pr-6"><button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 bg-black/50 border border-white/5 rounded-lg text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-500 transition-all"><Edit size={14}/></button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: ADD/EDIT ITEM */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in duration-200">
          <div className="bg-zinc-900 border border-orange-500/20 rounded-[40px] w-full max-w-lg p-8 md:p-10 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-6"><h2 className="text-xl font-black italic text-orange-500">{editingItem.id ? 'Edit' : 'Add New'} Item</h2><button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/5 rounded-full"><X size={20}/></button></div>
            <div className="grid grid-cols-2 gap-4 text-[10px]">
              <div className="col-span-2 space-y-1"><label className="text-zinc-500">Category *</label><select className="w-full bg-black p-4 rounded-xl border border-white/10 outline-none text-white" value={editingItem.category} onChange={e => {const newCat = e.target.value; setEditingItem({...editingItem, category: newCat, item_id_code: editingItem.id ? editingItem.item_id_code : generateNextCode(newCat)})}}>{categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="col-span-2 space-y-1"><label className="text-zinc-500">Item Name *</label><input className="w-full bg-black p-4 rounded-xl border border-white/10 outline-none text-white" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-blue-500">Code (Auto)</label><input className="w-full bg-blue-500/10 p-4 rounded-xl border border-blue-500/30 outline-none text-blue-400 italic" value={editingItem.item_id_code} readOnly /></div>
              <div className="space-y-1"><label className="text-zinc-500">Unit</label><input className="w-full bg-black p-4 rounded-xl border border-white/10 text-white" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-zinc-500">Color</label><input className="w-full bg-black p-4 rounded-xl border border-white/10 text-white" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-zinc-500">Size</label><input className="w-full bg-black p-4 rounded-xl border border-white/10 text-white" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-emerald-500">Current Stock</label><input type="number" className="w-full bg-black p-4 rounded-xl border border-emerald-500/30 text-emerald-400 text-lg" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-red-500">Alert Threshold</label><input type="number" className="w-full bg-black p-4 rounded-xl border border-red-500/30 text-red-400 text-lg" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-[24px] font-black uppercase text-xs active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"><Save size={18}/> Save Database</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><InventoryContent /></Suspense> )
}
