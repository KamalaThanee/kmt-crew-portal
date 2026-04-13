'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, ChevronDown, ChevronUp, HardHat, Eye, Ear, Wind, Shirt, Footprints, Box, HandMetal } from 'lucide-react'

export default function PPERequest() {
  const [groupedItems, setGroupedItems] = useState({})
  const [expandedCat, setExpandedCat] = useState(null)
  const [selectedItemName, setSelectedItemName] = useState(null)
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  
  // จำลองตำแหน่งผู้ใช้งาน (ในอนาคตจะดึงจากระบบ Login)
  // ถ้าเป็น 'Crew' จะมองไม่เห็นยอดคงเหลือ
  const [userRole, setUserRole] = useState('Crew') 

  // ปรับการดึงไอคอนให้ยืดหยุ่นขึ้น (รองรับทั้งมี s และไม่มี s)
  const getCatConfig = (catName) => {
    const name = catName.toLowerCase()
    if (name.includes('head')) return { icon: <HardHat size={20}/>, light: "bg-blue-50 text-blue-600" }
    if (name.includes('eye')) return { icon: <Eye size={20}/>, light: "bg-cyan-50 text-cyan-600" }
    if (name.includes('ear')) return { icon: <Ear size={20}/>, light: "bg-orange-50 text-orange-600" }
    if (name.includes('respiratory')) return { icon: <Wind size={20}/>, light: "bg-purple-50 text-purple-600" }
    if (name.includes('body')) return { icon: <Shirt size={20}/>, light: "bg-emerald-50 text-emerald-600" }
    if (name.includes('hand')) return { icon: <HandMetal size={20}/>, light: "bg-yellow-50 text-yellow-700" }
    if (name.includes('foot')) return { icon: <Footprints size={20}/>, light: "bg-amber-50 text-amber-700" }
    return { icon: <Box size={20}/>, light: "bg-slate-50 text-slate-600" }
  }

  useEffect(() => {
    async function fetchStock() {
      const { data, error } = await supabase.from('ppe_inventory').select('*').gt('quantity', 0)
      if (!error && data) {
        const grouped = data.reduce((acc, item) => {
          const cat = item.category || item.Category || "Other"
          if (!acc[cat]) acc[cat] = {}
          const name = item.item_name || item.ItemName
          if (!acc[cat][name]) acc[cat][name] = []
          acc[cat][name].push(item)
          return acc
        }, {})
        setGroupedItems(grouped)
      }
      setLoading(false)
    }
    fetchStock()
  }, [])

  const addToCart = (option) => {
    if (cart.find(i => i.id === option.id)) return
    setCart([...cart, { ...option, qty: 1 }])
    setSelectedItemName(null)
  }

  const isAdmin = ['SO', 'CO', 'Bargemaster'].includes(userRole)

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="sticky top-0 bg-white shadow-sm z-40 p-4 px-6 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-xl text-slate-800">KMT PPE Store</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Role: {userRole}</p>
        </div>
        <button onClick={() => setShowCart(true)} className="relative p-2 bg-slate-100 rounded-full">
          <ShoppingCart size={24} className="text-slate-600" />
          {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{cart.length}</span>}
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {loading ? <p className="text-center py-10">Loading...</p> : 
          Object.keys(groupedItems).sort().map(cat => {
            const config = getCatConfig(cat)
            return (
              <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button onClick={() => setExpandedCat(expandedCat === cat ? null : cat)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className={`${config.light} p-2.5 rounded-2xl`}>{config.icon}</div>
                    <span className="font-bold text-slate-700">{cat}</span>
                  </div>
                  {expandedCat === cat ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>
                {expandedCat === cat && (
                  <div className="p-3 bg-slate-50 space-y-2 border-t border-slate-100">
                    {Object.keys(groupedItems[cat]).map(name => (
                      <div key={name} className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm">
                        <span className="text-sm font-semibold text-slate-600">{name}</span>
                        <button onClick={() => setSelectedItemName({name, cat})} className="text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-lg">SELECT</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        }
      </div>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Your Requests</h2>
              <button onClick={() => setShowCart(false)} className="text-slate-300 text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                  <div>
                    <p className="font-bold text-sm">{item.item_name || item.ItemName}</p>
                    <p className="text-blue-600 font-bold text-[10px]">SIZE: {item.size || item.Size}</p>
                  </div>
                  <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400 text-xs">Remove</button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="pt-6 border-t mt-4">
                <textarea className="w-full border rounded-2xl p-4 bg-slate-50 text-sm h-24 mb-4" placeholder="Reason..." value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg">CONFIRM</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Size Selection Modal - จุดที่ซ่อนยอดคงเหลือ */}
      {selectedItemName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="font-bold text-xl mb-6 text-slate-800">{selectedItemName.name}</h3>
            <div className="space-y-3">
              {groupedItems[selectedItemName.cat][selectedItemName.name].map(opt => (
                <button key={opt.id} onClick={() => addToCart(opt)} className="w-full flex justify-between items-center p-4 border border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <span className="font-bold text-slate-700">Size: {opt.size || opt.Size}</span>
                  {/* ซ่อนยอดคงเหลือถ้าไม่ใช่ Admin */}
                  {isAdmin && (
                    <div className="text-right">
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Stock</span>
                      <span className="text-emerald-500 font-black">{opt.quantity || opt.Quantity}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedItemName(null)} className="w-full mt-6 text-slate-400 text-sm font-semibold">CANCEL</button>
          </div>
        </div>
      )}
    </div>
  )
}
