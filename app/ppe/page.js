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
  X,
  Ruler
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
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('kmt_user')
    router.push('/login')
  }

  const filteredItems = inventory.filter(item => {
    if (selectedCategory === 'All') return true
    return item.category === selectedCategory
  })

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
    
    const isBoot = requestItem.item_name.toLowerCase().includes('boot')
    
    const { error } = await supabase.from('ppe_requests').insert({
      crew_id: user.id,
      item_name: requestItem.item_name,
      size: isBoot ? user.boot_size : user.suit_size,
      color: isBoot ? null : user.suit_color,
      status: 'pending',
      request_date: new Date().toISOString()
    })

    if (error) {
      alert('เกิดข้อผิดพลาดในการส่งคำขอ')
    } else {
      alert('ส่งคำขอเบิกเรียบร้อยแล้ว')
      setRequestItem(null)
    }
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      {/* Top Header */}
      <div className="bg-slate-900/50 border-b border-white/10 p-6 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-800">
              {user.profile_url ? (
                <img src={user.profile_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-full h-full p-2 text-slate-500" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-sm leading-none mb-1">{user.full_name}</h2>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Crew Member</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
            <LogOut size={18} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-8">
        {/* Profile Sizes Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-600/20 to-transparent border border-blue-500/20 p-5 rounded-[2rem]">
            <p className="text-[10px] font-bold text-blue-400 uppercase mb-2">My Suit Size</p>
            <p className="text-2xl font-black">{user.suit_size || '-'}</p>
            <p className="text-[10px] text-slate-500 mt-1">Color: {user.suit_color || '-'}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-600/20 to-transparent border border-emerald-500/20 p-5 rounded-[2rem]">
            <p className="text-[10px] font-bold text-emerald-400 uppercase mb-2">My Boot Size</p>
            <p className="text-2xl font-black">{user.boot_size || '-'}</p>
            <p className="text-[10px] text-slate-500 mt-1">EU Standard</p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
          {['All', 'Clothing', 'Footwear', 'Protection'].map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-2.5 rounded-2xl text-xs font-bold transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-white/5 border border-white/5 text-slate-400'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* PPE Cards */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Available Equipment</h3>
          {Object.values(groupedItems).length > 0 ? Object.values(groupedItems).map((item, idx) => (
            <div 
              key={idx}
              onClick={() => setRequestItem(item)}
              className="group bg-white/5 border border-white/10 p-5 rounded-[2.5rem] flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-blue-500/50">
                  <Package className="text-blue-500" size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-base group-hover:text-blue-400 transition-colors">{item.item_name}</h4>
                  <div className="flex gap-2 mt-1">
                    {item.colors.length > 0 && (
                      <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-slate-400 uppercase font-bold">
                        {item.colors.join(' / ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-white/5 p-2 rounded-full">
                <ChevronRight size={16} className="text-slate-600 group-hover:text-white" />
              </div>
            </div>
          )) : (
            <div className="text-center py-10 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
              <Package size={40} className="mx-auto text-slate-700 mb-3" />
              <p className="text-sm text-slate-500 font-bold">No items found in this category</p>
            </div>
          )}
        </div>
      </div>

      {/* Request Dialog */}
      {requestItem && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="bg-blue-50 p-4 rounded-3xl text-blue-600">
                  <Package size={28} />
                </div>
                <button onClick={() => setRequestItem(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <h3 className="text-slate-900 text-2xl font-black mb-2 uppercase italic tracking-tighter">{requestItem.item_name}</h3>
              <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8">ITEM WILL BE PREPARED BASED ON YOUR REGISTERED PROFILE DATA</p>

              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-8">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase">My Size</span>
                  <Ruler size={14} className="text-slate-300" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {requestItem.item_name.toLowerCase().includes('boot') 
                    ? user.boot_size 
                    : `${user.suit_size} - ${user.suit_color}`}
                </div>
              </div>

              <button 
                onClick={handleRequest}
                disabled={loading}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'SENDING REQUEST...' : 'CONFIRM REQUEST'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-2xl border-t border-white/5 p-4 flex justify-around items-center z-40">
        <button className="flex flex-col items-center gap-1 text-blue-500">
          <Box size={20} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Inventory</span>
        </button>
        <button onClick={() => router.push('/history')} className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors">
          <History size={20} />
          <span className="text-[9px] font-black uppercase tracking-tighter">History</span>
        </button>
      </div>
    </div>
  )
}
