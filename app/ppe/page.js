'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, ChevronDown, ChevronUp, HardHat, Eye, Ear, Wind, Shirt, Footprints, Box } from 'lucide-react'

export default function PPERequest() {
  const [groupedItems, setGroupedItems] = useState({})
  const [expandedCat, setExpandedCat] = useState(null)
  const [selectedItemName, setSelectedItemName] = useState(null)
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')

  // ไอคอนและสีตามหมวดหมู่
  const catConfig = {
    "Head Protection": { icon: <HardHat size={20}/>, color: "bg-blue-500", light: "bg-blue-50 text-blue-600" },
    "Eyes Protection": { icon: <Eye size={20}/>, color: "bg-cyan-500", light: "bg-cyan-50 text-cyan-600" },
    "Ears Protection": { icon: <Ear size={20}/>, color: "bg-orange-500", light: "bg-orange-50 text-orange-600" },
    "Respiratory Protection": { icon: <Wind size={20}/>, color: "bg-purple-500", light: "bg-purple-50 text-purple-600" },
    "Body Protection": { icon: <Shirt size={20}/>, color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600" },
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
      {/* Header & Cart Icon */}
      <div className="sticky top-0 bg-white shadow-sm z-40 p-4 px-6 flex justify-between items-center">
        <h1 className="font-bold text-xl text-slate-800">KMT PPE Store</h1>
        <button onClick={() => setShowCart(true)} className="relative p-2 bg-slate-100 rounded-full">
          <ShoppingCart size={24} className="text-slate-600" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {loading ? <p className="text-center py-10">กำลังโหลดรายการ...</p> : 
          Object.keys(groupedItems).map(cat => {
            const config = catConfig[cat] || catConfig.default
            return (
              <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button 
                  onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`${config.light} p-2 rounded-xl`}>{config.icon}</div>
                    <span className="font-bold text-slate-700">{cat}</span>
                  </div>
                  {expandedCat === cat ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </button>
                
                {expandedCat === cat && (
                  <div className="p-2 bg-slate-50 space-y-2 border-t">
                    {Object.keys(groupedItems[cat]).map(name => (
                      <div key={name} className="bg-white p-3 rounded-xl flex justify-between items-center shadow-sm">
                        <span className="text-sm font-medium text-slate-700">{name}</span>
                        <button 
                          onClick={() => setSelectedItemName({name, cat})}
                          className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg"
                        >
                          เลือก
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

      {/* Cart Drawer (สรุปรายการช้อปปิ้ง) */}
      {showCart && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">รายการเบิกของคุณ</h2>
              <button onClick={() => setShowCart(false)} className="text-slate-400 font-bold text-xl">×</button>
            </div>
            {cart.length === 0 ? <p className="text-slate-400 italic">ไม่มีสินค้าในตะกร้า</p> : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between border-b pb-3 text-sm">
                    <div>
                      <p className="font-bold">{item.item_name || item.ItemName}</p>
                      <p className="text-blue-500 font-medium">Size: {item.size || item.Size}</p>
                    </div>
                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400">ลบ</button>
                  </div>
                ))}
                <div className="pt-4">
                  <label className="text-xs font-bold text-slate-400 block mb-2 uppercase">ระบุเหตุผลในการเบิก</label>
                  <textarea 
                    className="w-full border rounded-2xl p-4 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="เช่น ของเก่าชำรุด..." value={reason} onChange={(e) => setReason(e.target.value)}
                  />
                  <button onClick={submitRequest} className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg">ยืนยันการเบิก</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Size Selection Modal */}
      {selectedItemName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-4">เลือกไซส์: {selectedItemName.name}</h3>
            <div className="space-y-2">
              {groupedItems[selectedItemName.cat][selectedItemName.name].map(opt => (
                <button key={opt.id} onClick={() => addToCart(opt)} className="w-full flex justify-between p-4 border rounded-2xl hover:bg-blue-50 transition-all">
                  <span className="font-bold">Size: {opt.size || opt.Size}</span>
                  <span className="text-slate-400 text-sm">คลัง: {opt.quantity || opt.Quantity}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedItemName(null)} className="w-full mt-4 text-slate-400 text-sm">ปิด</button>
          </div>
        </div>
      )}
    </div>
  )
}
