'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, Search, AlertTriangle, Box, Filter, CheckCircle2, ChevronRight } from 'lucide-react'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
  const [showLowStock, setShowLowStock] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInv() {
      const { data } = await supabase.from('ppe_inventory').select('*')
      if (data) setInventory(data)
      setLoading(false)
    }
    fetchInv()
  }, [])

  // 🎯 ตัดคำ Category ให้สั้นลง (เช่น "Body Protection" -> "Body")
  const shortName = (name: string) => name.replace(' Protection', '').replace(' Equipment', '').trim()

  const categories = useMemo(() => {
    return ['All', ...new Set(inventory.map(i => i.category).filter(Boolean))].sort()
  }, [inventory])

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = (item.item_name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
                            (item.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCat = selectedCat === 'All' || item.category === selectedCat;
      return matchesSearch && matchesCat && (showLowStock ? item.quantity <= item.threshold : true);
    }).sort((a, b) => a.item_name.localeCompare(b.item_name))
  }, [inventory, searchTerm, selectedCat, showLowStock])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase text-xs tracking-widest">Loading Inventory...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-20">
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-5xl font-black uppercase italic text-white flex items-center gap-3 tracking-tighter">
          <Package className="text-blue-500" size={32}/> Inventory
        </h1>
        <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ml-1">Real-time supply monitoring</p>
      </div>

      {/* --- Filter Section --- */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
            <input type="text" placeholder="Search..." className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none focus:border-blue-500" onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setShowLowStock(!showLowStock)} className={`py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all border ${showLowStock ? 'bg-red-500 border-red-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-400'}`}>
            <AlertTriangle size={16} className={showLowStock ? 'animate-bounce' : ''}/>
            {showLowStock ? 'Showing Low Stock' : 'Filter Low Stock'}
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCat(cat)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all border ${selectedCat === cat ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
              {shortName(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* --- Desktop View: Enterprise Table --- */}
      <div className="hidden md:block bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-slate-950/50 text-slate-500 uppercase font-black text-[9px] tracking-widest border-b border-white/5">
            <tr><th className="p-5">Code</th><th className="p-5">Item Name</th><th className="p-5 text-center">Category</th><th className="p-5 text-center">Spec</th><th className="p-5 text-right">In Stock</th><th className="p-5 text-center">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {filteredInventory.map(item => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                <td className="p-5 font-bold text-slate-500 group-hover:text-blue-500 transition-colors">{item.item_id_code}</td>
                <td className="p-5 font-bold text-white text-sm">{item.item_name}</td>
                <td className="p-5 text-center"><span className="text-[10px] opacity-50">{shortName(item.category)}</span></td>
                <td className="p-5 text-center font-bold text-blue-400">{item.color} {item.size}</td>
                <td className={`p-5 text-right font-black text-lg ${item.quantity <= item.threshold ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity} <span className="text-[9px] opacity-40">{item.unit}</span></td>
                <td className="p-5 text-center">{item.quantity <= item.threshold ? <span className="bg-red-500/20 text-red-500 text-[8px] font-black px-3 py-1 rounded-full animate-pulse">RESTOCK</span> : <span className="text-emerald-500/30 font-black text-[8px]">STABLE</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Mobile View: Modern Cards --- */}
      <div className="md:hidden space-y-3">
        {filteredInventory.map(item => {
          const isLow = item.quantity <= item.threshold;
          return (
            <div key={item.id} className={`bg-slate-900 border ${isLow ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'} p-5 rounded-[28px] space-y-4`}>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                   <p className="text-blue-500 text-[9px] font-black uppercase tracking-widest">{item.item_id_code}</p>
                   <h3 className="text-white font-bold text-sm leading-tight">{item.item_name}</h3>
                   <p className="text-slate-500 text-[10px] font-medium uppercase tracking-tighter">{item.category} • {item.color} {item.size}</p>
                </div>
                {isLow && <AlertTriangle size={18} className="text-red-500 animate-pulse"/>}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-baseline gap-1">
                   <span className={`text-2xl font-black ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</span>
                   <span className="text-[10px] text-slate-600 font-bold uppercase">{item.unit}</span>
                </div>
                <span className={`text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${isLow ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-500'}`}>
                  {isLow ? 'Low Stock' : 'In Stock'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {filteredInventory.length === 0 && <div className="py-20 text-center text-slate-600 font-black uppercase text-[10px] tracking-[0.3em]">No items match your criteria</div>}
    </div>
  )
}
