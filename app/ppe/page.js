'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function PPERequest() {
  const [items, setItems] = useState([])
  const [groupedItems, setGroupedItems] = useState({})
  const [selectedItemName, setSelectedItemName] = useState(null)
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')

  useEffect(() => {
    async function fetchStock() {
      const { data, error } = await supabase.from('ppe_inventory').select('*')
      if (!error && data) {
        setItems(data)
        // จัดกลุ่มข้อมูลตามชื่อสินค้า
        const grouped = data.reduce((acc, item) => {
          const name = item.item_name || item.ItemName
          if (!acc[name]) acc[name] = []
          acc[name].push(item)
          return acc;
        }, {})
        setGroupedItems(grouped)
      }
      setLoading(false)
    }
    fetchStock()
  }, [])

  const addToCart = (sizeOption) => {
    if (cart.find(i => i.id === sizeOption.id)) return
    setCart([...cart, { ...sizeOption, qty: 1 }])
    setSelectedItemName(null) // ปิด Modal หลังเลือก
  }

  const submitRequest = async () => {
    if (cart.length === 0 || !reason) return alert('กรุณาเลือกของและใส่เหตุผลครับ')
    
    const { error } = await supabase.from('ppe_requests').insert([{
      items: cart.map(i => ({ id: i.id, item: i.item_name || i.ItemName, size: i.size || i.Size, qty: 1 })),
      reason: reason,
      status: 'pending'
    }])

    if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
    else {
      alert('ส่งคำขอเบิกสำเร็จ! Safety Officer จะตรวจสอบในลำดับถัดไป')
      setCart([])
      setReason('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-8">📦 ระบบเบิก PPE (Kamala Thanee)</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ส่วนรายการสินค้า (Grouped) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 h-fit">
            {Object.keys(groupedItems).map((name) => (
              <div key={name} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                <h3 className="font-bold text-lg text-slate-800">{name}</h3>
                <p className="text-xs text-slate-400 mb-4">{groupedItems[name][0].category || groupedItems[name][0].Category}</p>
                <button 
                  onClick={() => setSelectedItemName(name)}
                  className="w-full py-2 bg-slate-100 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors"
                >
                  เลือกไซส์ / ดูสต็อก
                </button>
              </div>
            ))}
          </div>

          {/* ส่วนตะกร้า */}
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 h-fit sticky top-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">🛒 รายการที่จะเบิก <span className="text-sm bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{cart.length}</span></h2>
            {cart.length === 0 ? <p className="text-slate-400 text-sm italic">ยังไม่ได้เลือกรายการ...</p> : (
              <div className="space-y-4">
                {cart.map((i, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b pb-2">
                    <div>
                      <p className="text-sm font-bold">{i.item_name || i.ItemName}</p>
                      <p className="text-[10px] text-blue-600 uppercase">Size: {i.size || i.Size}</p>
                    </div>
                    <button onClick={() => setCart(cart.filter(c => c.id !== i.id))} className="text-red-400 text-xs">ลบ</button>
                  </div>
                ))}
                <textarea 
                  className="w-full border rounded-xl p-3 mt-4 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="ใส่เหตุผลการเบิก..." value={reason} onChange={(e) => setReason(e.target.value)} 
                />
                <button onClick={submitRequest} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-all">ยืนยันการเบิก</button>
              </div>
            )}
          </div>
        </div>

        {/* Modal เลือกไซส์ */}
        {selectedItemName && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold mb-1">{selectedItemName}</h2>
              <p className="text-sm text-slate-400 mb-6">กรุณาเลือกไซส์ที่ต้องการ</p>
              <div className="space-y-3">
                {groupedItems[selectedItemName].map((option) => (
                  <button 
                    key={option.id}
                    disabled={(option.quantity || option.Quantity) <= 0}
                    onClick={() => addToCart(option)}
                    className="w-full flex justify-between items-center p-4 border rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50"
                  >
                    <span className="font-bold text-slate-700">Size: {option.size || option.Size}</span>
                    <span className="text-sm text-slate-500">คงเหลือ: {option.quantity || option.Quantity}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setSelectedItemName(null)} className="w-full mt-6 text-slate-400 text-sm font-medium">ยกเลิก</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
