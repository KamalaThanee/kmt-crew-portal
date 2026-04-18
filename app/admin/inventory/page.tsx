'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, Search, AlertTriangle, Box } from 'lucide-react'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
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

  const filtered = inventory.filter(i => 
    (i.item_name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (i.item_id_code?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (i.category?.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const groupedInventory = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filtered.forEach(item => {
      const cat = item.category || 'Uncategorized'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })

    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => {
        if (a.item_name !== b.item_name) return a.item_name.localeCompare(b.item_name)
        const colorA = a.color || 'ZZZ'; const colorB = b.color || 'ZZZ';
        if (colorA !== colorB) return colorA.localeCompare(colorB)
        const sizeA = a.size || 'ZZZ'; const sizeB = b.size || 'ZZZ';
        const isNumA = !isNaN(Number(sizeA)); const isNumB = !isNaN(Number(sizeB));
        if (isNumA && isNumB) return Number(sizeA) - Number(sizeB)
        return sizeOrder.indexOf(sizeA.toUpperCase()) - sizeOrder.indexOf(sizeB.toUpperCase())
      })
    })

    return groups
  }, [filtered])

  if (loading) return <div className="p-10 text-center animate-pulse text-blue-500 font-black tracking-widest mt-20">LOADING DATABASE...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto pb-32 pt-20 font-sans">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-white flex items-center gap-3"><Package className="text-blue-500"/> Inventory Master Data</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Enterprise Stock Monitoring System</p>
        </div>
      </div>

      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
        <input 
          type="text" placeholder="Search item, code, or category..." 
          className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white text-sm focus:border-blue-500 outline-none"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-8">
        {Object.entries(groupedInventory).map(([category, items]) => {
          const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)
          return (
            <div key={category} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-950 p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Box className="text-blue-500" size={20} />
                  <h2 className="font-black uppercase tracking-widest text-sm text-white">{category}</h2>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg">
                  Total Items: {totalQty}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-900/50 text-slate-400 uppercase font-black text-[9px] tracking-widest">
                    <tr>
                      <th className="p-4 border-b border-white/5">Item Code</th>
                      <th className="p-4 border-b border-white/5">Item Name</th>
                      <th className="p-4 border-b border-white/5 text-center">Color</th>
                      <th className="p-4 border-b border-white/5 text-center">Size</th>
                      <th className="p-4 border-b border-white/5 text-center">Unit</th>
                      <th className="p-4 border-b border-white/5 text-right">Threshold</th>
                      <th className="p-4 border-b border-white/5 text-right">Qty in Stock</th>
                      <th className="p-4 border-b border-white/5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {items.map(item => {
                      const isLow = item.quantity <= item.threshold;
                      return (
                        <tr key={item.id} className={`hover:bg-white/5 transition-colors ${isLow ? 'bg-red-500/5' : ''}`}>
                          <td className="p-4 font-bold text-slate-500">{item.item_id_code || '-'}</td>
                          <td className="p-4 font-bold text-white">{item.item_name}</td>
                          <td className="p-4 text-center">{item.color || '-'}</td>
                          <td className="p-4 text-center font-bold text-blue-400">{item.size || '-'}</td>
                          <td className="p-4 text-center text-slate-500">{item.unit || 'PC'}</td>
                          <td className="p-4 text-right text-slate-500">{item.threshold}</td>
                          <td className={`p-4 text-right font-black text-sm ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</td>
                          <td className="p-4 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 text-[9px] font-bold px-2 py-1 rounded uppercase"><AlertTriangle size={10}/> Restock</span>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-bold px-2 py-1 rounded uppercase">Normal</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
