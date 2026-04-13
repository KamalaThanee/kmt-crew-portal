'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PPERequest() {
  const [items, setItems] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')

  useEffect(() => {
    async function fetchStock() {
      // ดึงข้อมูลโดยระบุชื่อคอลัมน์ให้ตรงกับที่ Import (ถ้าคุณใช้ชื่อเดิมคือ Category, ItemName, etc.)
      const { data, error } = await supabase
        .from('ppe_inventory')
        .select('*')
      
      if (error) {
        console.error('Error fetching stock:', error)
      } else {
        setItems(data || [])
      }
      setLoading(false)
    }
    fetchStock()
  }, [])

  const addToCart = (item) => {
    // เช็คว่ามีของในตะกร้าหรือยัง
    if (cart.find(i => i.id === item.id)) return
    setCart([...cart, { ...item, qty: 1 }])
  }

  const handleRequest = async () => {
    if (!reason) return alert('กรุณาใส่เหตุผลในการเบิกครับ')
    alert('ระบบกำลังบันทึกคำขอและแจ้งเตือน Safety Officer...')
    // ส่วนนี้จะเชื่อมต่อกับตาราง ppe_requests ในขั้นตอนต่อไป
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">📦 ระบบเบิกอุปกรณ์ PPE</h1>
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm">
            ตะกร้า: {cart.length} รายการ
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ส่วนรายการสินค้า */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold text-slate-500 text-sm uppercase tracking-wider">รายการสินค้าในสต็อก</h2>
            {loading ? <p>กำลังโหลด...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all">
                    <p className="font-bold text-slate-800">{item.item_name || item.ItemName}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600">{item.category || item.Category}</span>
                      <span className="text-[10px] bg-blue-50 px-2 py-1 rounded text-blue-600 font-bold">Size: {item.size || item.Size}</span>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <p className="text-xs text-slate-400">คงเหลือ: {item.quantity || item.Quantity}</p>
                      <button 
                        onClick={() => addToCart(item)}
                        className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-blue-700"
                      >
                        + เลือกเบิก
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ส่วนตะกร้าและการส่งคำขอ */}
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 h-fit sticky top-8">
            <h2 className="text-lg font-bold mb-4">รายการที่จะเบิก</h2>
            {cart.length === 0 ? (
              <p className="text-slate-400 text-sm">ยังไม่ได้เลือกรายการ</p>
            ) : (
              <div className="space-y-4">
                {cart.map((i, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm font-medium">{i.item_name || i.ItemName} ({i.size || i.Size})</span>
                    <button onClick={() => setCart(cart.filter(c => c.id !== i.id))} className="text-red-400 text-xs">ลบ</button>
                  </div>
                ))}
                <div className="mt-6">
                  <label className="text-xs font-bold text-slate-500 uppercase">เหตุผลการเบิก</label>
                  <textarea 
                    className="w-full border rounded-xl p-3 mt-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="เช่น ของเดิมชำรุด, พนักงานใหม่..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleRequest}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-all mt-4"
                >
                  ส่งคำขอเบิก
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
