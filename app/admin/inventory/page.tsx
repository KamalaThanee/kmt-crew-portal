'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, Search, AlertTriangle, Box, Filter, CheckCircle2 } from 'lucide-react'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
  const [showLowStock, setShowLowStock] = useState(false) // State สำหรับคลิกเดียวดูของสต๊อกต่ำ
  const [loading, setLoading] = useState(true)

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

  useEffect(() => {
    const fetchInv = async () => {
      const { data } = await supabase.from('ppe_inventory').select('*')
      if (data) setInventory(data)
      setLoading(false)
    }
    fetchInv()
  }, [])

  // 🎯 ดึงรายชื่อ Category ทั้งหมดจาก DB
  const categories = useMemo(() => {
    return ['All', ...new Set(inventory.map(i => i.category).filter(Boolean))].sort()
  }, [inventory])

  // 🎯 Logic การกรองข้อมูล (Search + Category + Low Stock)
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = (item.item_name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
                            (item.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCat = selectedCat === 'All' || item.category === selectedCat;
      const isLow = item.quantity <= item.threshold;
      const matchesStockStatus = showLowStock ? isLow : true;

      return matchesSearch && matchesCat && matchesStockStatus;
    }).sort((a, b) => {
      // เรียงลำดับ: ชื่อ -> สี -> ไซส์
      if (a.item_name !== b.item_name) return a.item_name.localeCompare(b.item_name)
      const sizeA = a.size || ''; const sizeB = b.size || '';
      return sizeOrder.indexOf(sizeA.toUpperCase()) - sizeOrder.indexOf(sizeB.toUpperCase())
    })
  }, [inventory, searchTerm, selectedCat, showLowStock])

  if (loading) return <div className="p-10 text-center animate-pulse text-blue-500 font-black tracking-widest mt-20 uppercase text-xs">Loading Database...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto pb-32 pt-20 font-sans">
      <div className="mb-10">
        <h1 className="text-4xl font-black uppercase italic text-white flex items-center gap-3 tracking-tighter">
          <Package className="text-blue-500" size={36}/> Inventory
        </h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ml-1">Real-time monitoring system</p>
      </div>

      {/* 🎯 แถบ Filtering: ออกแบบมาให้กดง่ายในคลิกเดียว */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
        <div className="lg:col-span-4 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
          <input 
            type="text" placeholder="Search code or item name..." 
            className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:border-blue-500 outline-none transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="lg:col-span-5 flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Filter size={16} className="text-slate-500 shrink-0 mx-2"/>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all border ${
                selectedCat === cat ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`w-full h-full py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all border ${
              showLowStock 
                ? 'bg-red-500/20 border-red-500 text-red-500 shadow-lg shadow-red-500/20' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'
            }`}
          >
            <AlertTriangle size={16} className={showLowStock ? 'animate-bounce' : ''}/>
            {showLowStock ? 'Showing Low Stock Only' : 'Filter Low Stock'}
          </button>
        </div>
      </div>

      {/* 🎯 ตารางข้อมูลแบบ Enterprise */}
      <div className="bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-950/50 text-slate-400 uppercase font-black text-[9px] tracking-widest">
              <tr>
                <th className="p-5 border-b border-white/5">Item Code</th>
                <th className="p-5 border-b border-white/5">Item Name</th>
                <th className="p-5 border-b border-white/5 text-center">Category</th>
                <th className="p-5 border-b border-white/5 text-center">Color/Size</th>
                <th className="p-5 border-b border-white/5 text-right">In Stock</th>
                <th className="p-5 border-b border-white/5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-600 font-bold uppercase tracking-widest text-xs">No matching items found</td>
                </tr>
              ) : (
                filteredInventory.map(item => {
                  const isLow = item.quantity <= item.threshold;
                  return (
                    <tr key={item.id} className={`hover:bg-white/5 transition-colors ${isLow ? 'bg-red-500/5' : ''}`}>
                      <td className="p-5 font-bold text-slate-500">{item.item_id_code || '-'}</td>
                      <td className="p-5 font-bold text-white text-sm">{item.item_name}</td>
                      <td className="p-5 text-center"><span className="bg-white/5 px-3 py-1 rounded-lg text-slate-400 text-[9px] font-black uppercase">{item.category}</span></td>
                      <td className="p-5 text-center font-bold text-blue-400">{item.color || '-'} {item.size || '-'}</td>
                      <td className={`p-5 text-right font-black text-base ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>
                        {item.quantity} <span className="text-[10px] text-slate-600 font-normal uppercase ml-1">{item.unit || 'PC'}</span>
                      </td>
                      <td className="p-5 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1.5 bg-red-500 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase animate-pulse">
                            <AlertTriangle size={12}/> Restock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black px-3 py-1.5 rounded-full uppercase">
                            <CheckCircle2 size={12}/> Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
