'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, Search, AlertCircle, Box } from 'lucide-react'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInv = async () => {
      // ดึงข้อมูลทั้งหมด
      const { data } = await supabase.from('ppe_inventory').select('*').order('category')
      if (data) setInventory(data)
      setLoading(false)
    }
    fetchInv()
  }, [])

  // 1. ค้นหาได้ทั้ง ชื่อ, โค้ด, และ หมวดหมู่
  const filtered = inventory.filter(i => 
    (i.item_name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (i.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (i.category?.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // 2. จัดกลุ่มตามคอลัมน์ 'category' จริงๆ ใน Database
  const groupedInventory = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filtered.forEach(item => {
      const catName = item.category || 'Uncategorized'
      if (!groups[catName]) groups[catName] = []
      groups[catName].push(item)
    })
    return groups
  }, [filtered])

  if (loading) return <div className="p-10 text-center animate-pulse text-blue-500 font-black tracking-widest mt-20">LOADING INVENTORY...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto pb-32 pt-20 font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase italic text-white flex items-center gap-3">
          <Package className="text-blue-500" /> Inventory Control
        </h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Real-time stock monitoring</p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
        <input 
          type="text" placeholder="Search by item name, code, or category..." 
          className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-blue-500 outline-none"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-10">
        {Object.keys(groupedInventory).length === 0 && (
          <div className="text-center py-20 text-slate-600 font-bold uppercase tracking-widest">No items found</div>
        )}

        {Object.entries(groupedInventory).map(([category, items]) => (
          <div key={category} className="space-y-4 animate-in fade-in">
            {/* หัวข้อ Category */}
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Box className="text-blue-500" size={20} />
              <h2 className="font-black uppercase tracking-tighter text-sm text-white">{category}</h2>
              <span className="ml-auto text-[10px] bg-white/5 px-2 py-1 rounded text-slate-500 font-bold">{items.length} Items</span>
            </div>

            {/* รายการสินค้าใน Category นั้นๆ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => {
                const isLow = item.quantity <= item.threshold;
                return (
                  <div key={item.id} className={`bg-slate-900 border ${isLow ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5'} p-5 rounded-[24px] flex flex-col justify-between min-h-[140px]`}>
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">{item.item_id_code || 'NO-CODE'}</p>
                        {isLow && <AlertCircle className="text-red-500 animate-pulse" size={16}/>}
                      </div>
                      <h3 className="text-white font-bold text-sm leading-tight mb-1">{item.item_name}</h3>
                      {/* จัดการค่า Null ให้แสดงผลสวยงาม */}
                      <p className="text-blue-400 text-[10px] font-bold uppercase">
                        {item.color || 'No Color'} | SIZE: {item.size || 'N/A'}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-end pt-4 mt-auto border-t border-white/5 mt-4">
                      <div>
                        <p className="text-slate-500 text-[9px] uppercase font-bold tracking-widest">In Stock</p>
                        <p className={`text-2xl font-black leading-none mt-1 ${isLow ? 'text-red-500' : 'text-white'}`}>
                          {item.quantity} <span className="text-[10px] text-slate-500 font-normal ml-1 uppercase">{item.unit || 'PC'}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-[9px] uppercase font-bold tracking-widest">Threshold</p>
                        <p className="text-slate-300 font-bold text-sm mt-1">{item.threshold}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
