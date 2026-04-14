'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  Box, 
  ChevronRight, 
  History, 
  LogOut, 
  User as UserIcon, 
  Package, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export default function PPEPage() {
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [requestItem, setRequestItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(cachedUser))

    async function fetchInventory() {
      const { data } = await supabase.from('ppe_inventory').select('*')
      if (data) setInventory(data)
    }
    fetchInventory()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('kmt_user')
    router.push('/login')
  }

  // กรองไอเทมตามหมวดหมู่
  const filteredItems = inventory.filter(item => {
    if (selectedCategory === 'All') return true
    return item.category === selectedCategory
  })

  // จัดกลุ่มไอเทมตามชื่อ เพื่อแสดงผล (เช่น Boiler Suit ทุกสี/ไซส์ รวมเป็น Card เดียว)
  const groupedItems = filteredItems.reduce((acc, item) => {
    const key = item.item_name
    if (!acc[key]) {
      acc[key] = { ...item, sizes: [], colors: [] }
    }
    if (item.size && !acc[key].sizes.includes(item.size)) acc[key].sizes.push(item.size)
    if (item.color && !acc[key].colors.includes(item.color)) acc[key].colors.push(item.color)
    return acc
  }, {})

  const handleRequest = async () => {
    if (!requestItem) return
    setLoading(true)
    
    const { error } = await supabase.from('ppe_requests').insert({
      crew_id: user.id,
      item_name: requestItem.item_name,
      size: user.suit_size || user.boot_size, // ดึงจากโปรไฟล์ที่ลงทะเบียนไว้
      color: user.suit_color,
      status: 'pending',
      request_date: new Date().toISOString()
    })

    if (error) {
      alert('เกิดข้อผิดพลาดในการเบิก')
    } else {
      alert('ส่งคำขอเบิกเรียบร้อยแล้ว')
      setRequestItem(null)
    }
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-20">
      {/* Header Profile */}
      <div className="bg-white/5 border-b border-white/10 p-6 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-800">
              {user.profile_url ? (
                <img src={user.profile_url} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="p-2 text-slate-500" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-sm">{user.full_name}</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">{user.rank || 'CREW MEMBER'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <LogOut size={20} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-8">
        {/* Stats / Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-600/20 border border-blue-500/20 p-4 rounded-3xl">
            <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Your Suit Size</p>
            <p className="text-2xl font-black">{user.suit_size} <span className="text-xs font-normal opacity-50">({user.suit_color})</span></p>
          </div>
          <div className="bg-emerald-600/20 border border-emerald-500/20 p-4 rounded-3xl">
            <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Your Boot Size</p>
            <p className="text-2xl font-black">{user.boot_size}</p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {['All', 'Clothing', 'Footwear', 'Protection'].map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-white text-slate-900 shadow-lg' : 'bg-white/5 border border-white/10'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Item List */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Available PPE</h3>
          {Object.values(groupedItems).map((item, idx) => (
            <div 
              key={idx}
              onClick={() => setRequestItem(item)}
              className="group bg-white/5 border border-white/10 p-5 rounded-[2rem] flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer active:scale-95"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-blue-500/50 transition-colors">
                  <Package className="text-blue-500" size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">{item.item_name}</h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Available in: {item.colors.length > 0 ? item.colors.join(', ') : 'Standard'}
                  </p>
                </div>
              </div>
              <ChevronRight className="text-slate-700 group-hover:text-white transition-colors" />
            </div>
          ))}
        </div>
      </div>

      {/* Request Modal */}
      {requestItem && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600">
                  <Package size={32} />
                </div>
                <button onClick={() => setRequestItem(null)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
              </div>
              
              <h3 className="text-slate-900 text-2xl font-black mb-2 uppercase italic">{requestItem.item_name}</h3>
              <p className="text-slate-500 text-sm mb-8">ระบบจะทำการจัดเตรียมของตามขนาดที่ท่านได้ลงทะเบียนไว้ในโปรไฟล์</p>

              <div className="space-y-3 mb-8">
                <div className="flex justify-between p-4 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 text-xs font-bold uppercase">Your Registered Size</span>
                  <span className="text-slate-900 font-black">
                    {requestItem.item_name.toLowerCase().includes('boot') ? user.boot_size : `${user.suit_size} (${user.suit_color})`}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleRequest}
                disabled={loading}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all"
              >
                {loading ? 'SENDING...' : 'Confirm Request'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 p-4 flex justify-around items-center z-40">
        <button className="flex flex-col items-center gap-1 text-blue-500"><Box size={24}/><span className="text-[10px] font-bold">PPE</span></button>
        <button onClick={() => router.push('/history')} className="flex flex-col items-center gap-1 text-slate-500"><History size={24}/><span className="text-[10px] font-bold">HISTORY</span></button>
      </div>
    </div>
  )
}
