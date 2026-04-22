'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Package, Search, AlertTriangle, Download, Plus, Edit, X, Save, Box, ChevronDown, ChevronRight, Archive } from 'lucide-react'

function InventoryContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
  const [showLowStock, setShowLowStock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedCats, setExpandedCats] = useState<string[]>([]) // 🎯 State สำหรับ Accordion

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

    // Auto-expand all matching categories when searching
    if (searchTerm || showLowStock || selectedCat !== 'All') {
      setExpandedCats(Object.keys(sortedGroups));
    }
    
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
      
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3"><Package className="text-blue-500" size={32}/> Inventory Management</h1>
           <p className="text-zinc-500 tracking-[0.2em] mt-2">Enterprise Stock Database</p>
        </div>
        <div className="flex gap-3">
           {/* 🎯 นำปุ่ม Receive Stock กลับมา */}
           <button onClick={() => router.push('/admin/restock')} className="px-6 py-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all"><Archive size={16}/> Receive Store</button>
           <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsModalOpen(true); }} className="px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all"><Plus size={16}/> Add New Item</button>
           <button onClick={exportToExcel} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-2xl text-blue-400 font-black text-xs uppercase flex items-center gap-2 transition-all"><Download size={16}/> Export</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-zinc-900/50 p-4 rounded-[32px] border border-white/5 mb-8 shadow-xl">
        <div className="relative md:col-span-2"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/><input type="text" placeholder="Search code or name..." className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-all text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <select className="bg-black/50 border border-white/10 rounded-2xl py-4 px-4 text-white outline-none focus:border-orange-500 text-xs font-bold" value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowLowStock(!showLowStock)} className={`rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all ${showLowStock ? 'bg-red-500/20 border-red-500/50 text-red-500 shadow-inner' : 'bg-black/50 border-white/10 text-zinc-500 hover:border-red-500/50 hover:text-red-500'}`}><AlertTriangle size={16}/> {showLowStock ? 'Low Stock Active' : 'Filter Low Stock'}</button>
      </div>

      {/* 🎯 Accordion Table List */}
      <div className="space-y-4">
        {Object.keys(filteredInventoryGrouped).length === 0 && <div className="py-20 text-center text-zinc-600 font-black text-sm">NO ITEMS FOUND</div>}
        {Object.entries(filteredInventoryGrouped).map(([category, items]) => {
          const isExpanded = expandedCats.includes(category);
          return (
            <div key={category} className={`bg-zinc-900 border transition-all rounded-[32px] overflow-hidden ${isExpanded ? 'border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.1)]' : 'border-white/5 shadow-xl'}`}>
              <button onClick={() => setExpandedCats(isExpanded ? expandedCats.filter(c => c !== category) : [...expandedCats, category])} className="w-full p-6 md:p-8 flex items-center justify-between hover:bg-white/5 outline-none transition-colors">
                <div className="flex items-center gap-4 text-orange-500"><Box size={24}/><h2 className="text-sm md:text-base font-black text-white tracking-widest">{category} <span className="text-zinc-600 ml-2">({items.length})</span></h2></div>
                {isExpanded ? <ChevronDown size={24} className="text-orange-500"/> : <ChevronRight size={24} className="text-zinc-600"/>}
              </button>

              {isExpanded && (
                <div className="overflow-x-auto border-t border-white/5 bg-black/20 p-4">
                  <table className="w-full text-left text-[11px] font-black uppercase whitespace-nowrap border-separate border-spacing-y-2">
                    <thead className="text-zinc-500 bg-black/40"><tr className="rounded-2xl overflow-hidden"><th className="p-5 pl-6">Code</th><th className="p-5">Item Name</th><th className="p-5">Spec</th><th className="p-5 text-right">In Stock</th><th className="p-5 text-center">Status</th><th className="p-5 text-center pr-6">Action</th></tr></thead>
                    <tbody className="text-zinc-300">
                      {items.map(item => {
                        const isLow = item.quantity <= item.threshold;
                        return (
                          <tr key={item.id} className="bg-white/5 hover:bg-orange-600/10 transition-colors group">
                            <td className={`p-5 pl-6 rounded-l-2xl border-l-4 ${isLow ? 'border-red-500/50' : 'border-white/5 group-hover:border-orange-500'} text-zinc-500`}>{item.item_id_code}</td>
                            <td className="p-5 text-white text-sm">{item.item_name}</td>
                            <td className="p-5 text-blue-400">{item.color || '-'} {item.size || '-'}</td>
                            <td className={`p-5 text-right font-black text-base ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity} <span className="text-[8px] text-zinc-600 ml-1">{item.unit || 'PC'}</span></td>
                            <td className="p-5 text-center">{isLow ? <span className="bg-red-500/20 text-red-500 px-3 py-1.5 rounded-xl text-[9px] animate-pulse">RESTOCK</span> : <span className="text-emerald-500/30 text-[9px]">OK</span>}</td>
                            <td className="p-5 text-center pr-6 rounded-r-2xl"><button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-3 bg-black/50 border border-white/5 rounded-xl text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-500 transition-all"><Edit size={16}/></button></td>
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

      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-zinc-900 border border-orange-500/20 rounded-[48px] w-full max-w-lg p-10 space-y-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-6 text-orange-500"><h2 className="text-2xl font-black italic">{editingItem.id ? 'Edit' : 'Add New'} Item</h2><button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/5 rounded-full hover:bg-red-500 transition-all text-white"><X size={24}/></button></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2"><label className="text-orange-500 font-black ml-1">Category *</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm" value={editingItem.category} onChange={e => {const newCat = e.target.value; setEditingItem({...editingItem, category: newCat, item_id_code: editingItem.id ? editingItem.item_id_code : generateNextCode(newCat)})}}>{categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="col-span-2 space-y-2"><label className="text-zinc-500 font-black ml-1">Item Name *</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm focus:border-orange-500" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-blue-500 font-black ml-1">Code (Auto)</label><input className="w-full bg-blue-500/10 border border-blue-500/30 p-5 rounded-2xl outline-none text-blue-400 font-black text-sm italic" value={editingItem.item_id_code} readOnly /></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-1">Unit</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm focus:border-orange-500" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-1">Color</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm focus:border-orange-500" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-1">Size</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none text-white font-bold text-sm focus:border-orange-500" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-emerald-500 font-black ml-1">Current Stock</label><input type="number" className="w-full bg-black border border-emerald-500/20 p-5 rounded-2xl outline-none text-emerald-400 font-black text-xl" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-red-500 font-black ml-1">Restock Threshold</label><input type="number" className="w-full bg-black border border-red-500/20 p-5 rounded-2xl outline-none text-red-400 font-black text-xl" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-6 bg-orange-600 hover:bg-orange-500 text-white rounded-[24px] font-black uppercase text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={20}/> Save Inventory Data</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><InventoryContent /></Suspense> )
}
