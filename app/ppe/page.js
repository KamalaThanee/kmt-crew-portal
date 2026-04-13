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

  // ไอคอนและสีตามหมวดหมู่ (อัปเดต Hand และ Foot)
  const catConfig = {
    "Head Protection": { icon: <HardHat size={20}/>, color: "bg-blue-500", light: "bg-blue-50 text-blue-600" },
    "Eyes Protection": { icon: <Eye size={20}/>, color: "bg-cyan-500", light: "bg-cyan-50 text-cyan-600" },
    "Ears Protection": { icon: <Ear size={20}/>, color: "bg-orange-500", light: "bg-orange-50 text-orange-600" },
    "Respiratory Protection": { icon: <Wind size={20}/>, color: "bg-purple-500", light: "bg-purple-50 text-purple-600" },
    "Body Protection": { icon: <Shirt size={20}/>, color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600" },
    "Hand Protection": { icon: <HandMetal size={20}/>, color: "bg-yellow-600", light: "bg-yellow-50 text-yellow-700" },
    "Foot Protection": { icon: <Footprints size={20}/>, color: "bg-amber-700", light: "bg-amber-50 text-amber-700" },
    "default": { icon: <Box size={20}/>, color: "bg-slate-500", light: "bg-slate-50 text-slate-600" }
  }

  useEffect(() => {
    async function fetchStock() {
      const { data, error } = await supabase.from('ppe_inventory').select('*').gt('quantity', 0)
      if (!error && data) {
        const grouped = data.reduce((acc, item) => {
          const cat = item.category || "Other"
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

  const submitRequest = async () => {
    if (cart.length === 0 || !reason) return alert('กรุณาเลือกของและใส่เหตุผลครับ')
    const { error } = await supabase.from('ppe_requests').insert([{
      items: cart,
      reason,
      status: 'pending'
    }])
    if (!error) {
      alert('ส่งคำขอสำเร็จ!')
      setCart([]); setReason(''); setShowCart(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <div className="sticky top-0 bg-white shadow-sm z-40 p-4 px-6 flex justify-between items-center">
        <h1 className="font-bold text-xl text-slate-800 italic">KMT PPE Store</h1>
        <button onClick={() => setShowCart(true)} className="relative p-2 bg-slate-100 rounded-full transition-transform active:scale-90">
          <ShoppingCart size={24} className="text-slate-600" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold animate-bounce">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3 mt-2">
        {loading ? <p className="text-center py-10 text-slate-400">Loading Inventory...</p> : 
          Object.keys(groupedItems).sort().map(cat => {
            const config = catConfig[cat] || catConfig.default
            return (
              <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button 
                  onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`${config.light} p-2.5 rounded-2xl shadow-inner`}>{config.icon}</div>
                    <span className="font-bold text-slate-700">{cat}</span>
                  </div>
                  {expandedCat === cat ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>
                
                {expandedCat === cat && (
                  <div className="p-3 bg-slate-50 space-y-2 border-t border-slate-100">
                    {Object.keys(groupedItems[cat]).map(name => (
                      <div key={name} className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border border-slate-100">
                        <span className="text-sm font-semibold text-slate-600">{name}</span>
                        <button 
                          onClick={() => setSelectedItemName({name, cat})}
                          className="text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md"
                        >
                          SELECT
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        }
      </div>

      {showCart && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Checkout List</h2>
              <button onClick={() => setShowCart(false)} className="text-slate-300 hover:text-slate-500 font-bold text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {cart.length === 0 ? <p className="text-slate-400 italic text-center mt-10 text-sm">Your cart is empty</p> : 
                cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{item.item_name || item.ItemName}</p>
                      <p className="text-blue-600 font-bold text-[10px] uppercase mt-1">Size: {item.size || item.Size}</p>
                    </div>
                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400 font-medium text-xs hover:underline">Remove</button>
                  </div>
                ))
              }
            </div>
            {cart.length > 0 && (
              <div className="pt-6 border-t mt-4">
                <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">Reason for Request</label>
                <textarea 
                  className="w-full border border-slate-200 rounded-2xl p-4 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 text-sm h-24" 
                  placeholder="e.g. Broken old one, New staff..." value={reason} onChange={(e) => setReason(e.target.value)}
                />
                <button onClick={submitRequest} className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                  CONFIRM REQUEST
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedItemName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-xl mb-1 text-slate-800">{selectedItemName.name}</h3>
            <p className="text-xs text-slate-400 mb-6 uppercase tracking-tighter italic">Select Size from Stock</p>
            <div className="space-y-3">
              {groupedItems[selectedItemName.cat][selectedItemName.name].map(opt => (
                <button key={opt.id} onClick={() => addToCart(opt)} className="w-full flex justify-between items-center p-4 border border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
                  <span className="font-bold text-slate-700">Size: {opt.size || opt.Size}</span>
                  <div className="text-right">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">In Stock</span>
                    <span className="text-emerald-500 font-black">{opt.quantity || opt.Quantity}</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedItemName(null)} className="w-full mt-6 text-slate-400 text-sm font-semibold py-2 hover:text-slate-600">CANCEL</button>
          </div>
        </div>
      )}
    </div>
  )
}
