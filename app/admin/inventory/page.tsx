'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Package, Search, AlertTriangle, Box, CheckCircle2, 
  HardHat, Headphones, Eye, Wind, Shirt, Hand, Footprints, MoreHorizontal 
} from 'lucide-react'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([]) // 🎯 เปลี่ยนเป็น Array สำหรับ Multi-select
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

  // 🎯 แผนผังไอคอนตามหมวดหมู่
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

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = (item.item_name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
                            (item.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCat = selectedCats.length === 0 || selectedCats.includes(item.category);
      const matchesStock = showLowStock ? item.quantity <= item.threshold : true;
      return matchesSearch && matchesCat && matchesStock;
    }).sort((a, b) => a.item_name.localeCompare(b.item_name))
  }, [inventory, searchTerm, selectedCats, showLowStock])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase text-xs">Loading...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-2 md:pt-6 font-sans">
      <div className="mb-8">
        <h1 className="text-4xl font-black uppercase italic text-white flex items-center gap-3">
          <Package className="text-blue-500" size={32}/> Inventory
        </h1>
      </div>

      <div className="space-y-6 mb-8">
        {/* ค้นหาและปุ่มด่วน */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
            <input type="text" placeholder="Search item..." className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 text-white outline-none focus:border-blue-500" onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setShowLowStock(!showLowStock)} className={`py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border transition-all ${showLowStock ? 'bg-red-500 border-red-500 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}>
            <AlertTriangle size={16} /> {showLowStock ? 'Showing Low Stock' : 'Low Stock Filter'}
          </button>
        </div>

        {/* 🎯 Multi-select Icon Chips */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          {categoryConfig.map(cat => {
            const Icon = cat.icon;
            const isActive = selectedCats.includes(cat.name);
            return (
              <button key={cat.name} onClick={() => toggleCat(cat.name)} className={`flex flex-col items-center justify-center gap-2 min-w-[70px] h-[80px] rounded-2xl border transition-all ${isActive ? 'bg-blue-600 border-blue-400 text-white scale-105 shadow-lg shadow-blue-600/30' : 'bg-slate-900 border-white/5 text-slate-500 hover:border-white/20'}`}>
                <Icon size={24} />
                <span className="text-[8px] font-black uppercase tracking-widest">{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid view (Adaptive) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredInventory.map(item => {
          const isLow = item.quantity <= item.threshold;
          return (
            <div key={item.id} className={`bg-slate-900 border ${isLow ? 'border-red-500/30' : 'border-white/5'} p-5 rounded-[28px] flex flex-col justify-between group hover:border-blue-500/30 transition-all`}>
              <div className="space-y-1">
                 <p className="text-blue-500 text-[9px] font-black uppercase">{item.item_id_code}</p>
                 <h3 className="text-white font-bold text-sm leading-tight">{item.item_name}</h3>
                 <p className="text-slate-500 text-[10px] uppercase">{item.category} | {item.color} {item.size}</p>
              </div>
              <div className="flex items-end justify-between mt-6 pt-4 border-t border-white/5">
                 <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-black ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</span>
                    <span className="text-[10px] text-slate-600 font-bold uppercase">{item.unit}</span>
                 </div>
                 {isLow && <span className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded uppercase animate-pulse">Low</span>}
              </div>
            </div>
          )
        })}
      </div>
      
      {filteredInventory.length === 0 && <div className="py-20 text-center text-slate-700 font-black uppercase text-xs tracking-widest">No items found</div>}
    </div>
  )
}
