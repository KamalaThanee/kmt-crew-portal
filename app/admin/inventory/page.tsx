'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Package, Search, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

function InventoryContent() {
  const searchParams = useSearchParams()
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [showLowStock, setShowLowStock] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (searchParams.get('filter') === 'low') setShowLowStock(true)
    async function fetchInv() {
      const { data } = await supabase.from('ppe_inventory').select('*')
      if (data) setInventory(data)
      setLoading(false)
    }
    fetchInv()
  }, [searchParams])

  const categoryOrder = ['Head Protection', 'Ears Protection', 'Eyes Protection', 'Respiratory Protection', 'Body Protection', 'Hands Protection', 'Foots Protection', 'Other']
  const categoryConfig = [
    { name: 'Head Protection', label: 'Head' }, { name: 'Ears Protection', label: 'Ears' },
    { name: 'Eyes Protection', label: 'Eyes' }, { name: 'Respiratory Protection', label: 'Resp' },
    { name: 'Body Protection', label: 'Body' }, { name: 'Hands Protection', label: 'Hands' },
    { name: 'Foots Protection', label: 'Foots' }, { name: 'Other', label: 'Other' },
  ]

  const toggleCat = (catName: string) => { setSelectedCats(prev => prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]) }

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || item.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = selectedCats.length === 0 || selectedCats.includes(item.category);
      const matchesStock = showLowStock ? item.quantity <= item.threshold : true;
      return matchesSearch && matchesCat && matchesStock;
    }).sort((a, b) => {
      const catA = categoryOrder.indexOf(a.category); const catB = categoryOrder.indexOf(b.category);
      if (catA !== catB) return catA - catB;
      return (a.item_id_code || "").localeCompare(b.item_id_code || "", undefined, { numeric: true });
    })
  }, [inventory, searchTerm, selectedCats, showLowStock])

  const exportToExcel = () => {
    try {
      const dataToExport = filteredInventory.map(item => ({
        'Item Code': item.item_id_code,
        'Item Name': item.item_name,
        'Category': item.category,
        'Color': item.color || '-',
        'Size': item.size || '-',
        'Qty': item.quantity,
        'Unit': item.unit,
        'Status': item.quantity <= item.threshold ? 'LOW STOCK' : 'OK'
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory");
      XLSX.writeFile(wb, `KMT_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel Exported!");
    } catch (err) {
      toast.error("Export failed");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">KMT INVENTORY...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-2 md:pt-6 font-sans">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-4xl font-black uppercase italic text-white flex items-center gap-3"><Package className="text-blue-500" size={32}/> Inventory</h1>
        <button onClick={exportToExcel} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-blue-400 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"><Download size={18}/> Export Excel</button>
      </div>

      <div className="space-y-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/><input type="text" placeholder="Search item..." className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 text-white outline-none focus:border-blue-500" onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <button onClick={() => setShowLowStock(!showLowStock)} className={`py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border transition-all ${showLowStock ? 'bg-red-500 border-red-500 text-white shadow-xl' : 'bg-white/5 border-white/5 text-slate-400'}`}><AlertTriangle size={16} /> {showLowStock ? 'Low Stock Active' : 'Filter Low Stock'}</button>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          {categoryConfig.map(cat => {
            const isActive = selectedCats.includes(cat.name);
            return (<button key={cat.name} onClick={() => toggleCat(cat.name)} className={`px-5 py-3 rounded-2xl border transition-all font-black text-[10px] uppercase whitespace-nowrap ${isActive ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-900 border-white/5 text-slate-500 hover:border-white/10'}`}>{cat.label}</button>)
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredInventory.map(item => {
          const isLow = item.quantity <= item.threshold;
          return (
            <div key={item.id} className={`bg-slate-900 border ${isLow ? 'border-red-500/30 shadow-lg shadow-red-500/5' : 'border-white/5'} p-5 rounded-[28px] flex flex-col justify-between hover:border-blue-500/30 transition-all`}>
              <div className="space-y-1"><p className="text-blue-500 text-[9px] font-black uppercase">{item.item_id_code}</p><h3 className="text-white font-bold text-sm leading-tight">{item.item_name}</h3><p className="text-slate-500 text-[10px] uppercase">{item.category}</p></div>
              <div className="flex items-end justify-between mt-6 pt-4 border-t border-white/5"><div className="flex items-baseline gap-1"><span className={`text-2xl font-black ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</span><span className="text-[10px] text-slate-600 font-bold uppercase">{item.unit}</span></div>{isLow && <span className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded uppercase animate-pulse">Low</span>}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InventoryContent />
    </Suspense>
  )
}
