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
  X
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
      // ดึงข้อมูล PPE ทั้งหมดเรียงตามชื่อ
      const { data } = await supabase.from('ppe_inventory').select('*').order('item_name')
      if (data) setInventory(data)
    }
    fetchInventory()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('kmt_user')
    router.push('/login')
  }

  // Filter ข้อมูลตามหมวดหมู่
  const filteredItems = inventory.filter(item => {
    if (selectedCategory === 'All') return true
    return item.category === selectedCategory
  })

  const handleRequest = async () => {
    if (!requestItem) return
    setLoading(true)
    
    const { error } = await supabase.from('ppe_requests').insert({
      crew_id: user.id,
      item_name: requestItem.item_name,
      size: requestItem.size || requestItem.Size || null,
      color: requestItem.color || null,
      status: 'pending',
      request_date: new Date().toISOString()
    })

    if (error) {
      alert('Error sending request')
    } else {
      alert('Request sent successfully!')
      setRequestItem(null)
    }
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-white/10 p-6 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border border-blue-500/50 overflow-hidden bg-slate-800">
              {user.profile_url ? (
                <img src={user.profile_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-full h-full p-2 text-slate-500" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-xs">{user.full_name}</h2>
              <p className="text-[9px] text-blue-400 font-bold uppercase">Ready to Request</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white/5 rounded-lg text-slate-400">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['All', 'Clothing', 'Footwear', 'Protection'].map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 border border-white/5'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* PPE List (Simple List like before) */}
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => setRequestItem(item)}
              className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5">
                  <Package className="text-blue-500/70" size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">{item.item_name}</h4>
                  <div className="flex gap-2 mt-0.5">
                    {item.size && <span className="text-[10px] text-slate-400">Size: {item.size}</span>}
                    {item.color && <span className="text-[10px] text-slate-400">| Color: {item.color}</span>}
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-600" />
            </div>
          ))}
        </div>
      </div>

      {/* Simple Confirmation Modal */}
      {requestItem && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                <Package size={24} />
              </div>
              <button onClick={() => setRequestItem(null)} className="text-slate-300 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <h3 className="text-slate-900 text-xl font-black mb-1 uppercase">{requestItem.item_name}</h3>
            <p className="text-slate-400 text-xs font-bold mb-6">CONFIRM YOUR SELECTION</p>

            <div className="bg-slate-50 p-4 rounded-2xl mb-8 space-y-2">
              {requestItem.size && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Selected Size:</span>
                  <span className="font-bold text-slate-900">{requestItem.size}</span>
                </div>
              )}
              {requestItem.color && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Selected Color:</span>
                  <span className="font-bold text-slate-900">{requestItem.color}</span>
                </div>
              )}
            </div>

            <button 
              onClick={handleRequest}
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              {loading ? 'SENDING...' : 'CONFIRM REQUEST'}
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-white/5 p-4 flex justify-around items-center z-40">
        <button className="flex flex-col items-center gap-1 text-blue-500">
          <Box size={20} />
          <span className="text-[10px] font-bold">PPE</span>
        </button>
        <button onClick={() => router.push('/history')} className="flex flex-col items-center gap-1 text-slate-500">
          <History size={20} />
          <span className="text-[10px] font-bold">HISTORY</span>
        </button>
      </div>
    </div>
  )
}
