'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, 
  User as UserIcon, HardHat, Shirt, HandMetal, 
  Footprints, MoreHorizontal, X, Package, History
} from 'lucide-react'

export default function PPEPage() {
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [expandedCat, setExpandedCat] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    setUser(JSON.parse(cachedUser))

    async function fetchInventory() {
      const { data } = await supabase.from('ppe_inventory').select('*').order('item_name')
      if (data) setInventory(data)
    }
    fetchInventory()
  }, [router])

  // แบ่งหมวดหมู่
  const categories = [
    { name: 'Head & Eyes', keywords: ['helmet', 'glass', 'goggle', 'mask'], icon: <HardHat size={20}/> },
    { name: 'Body Protection', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={20}/> },
    { name: 'Hand Protection', keywords: ['glove'], icon: <HandMetal size={20}/> },
    { name: 'Footwear', keywords: ['boot', 'shoe'], icon: <Footprints size={20}/> },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={20}/> }
  ]

  const addToCart = (item) => {
    setCart(prev => [...prev, { ...item, cartId: Date.now() }])
  }

  const handleCheckout = async () => {
    setLoading(true)
    const requests = cart.map(item => ({
      crew_id: user.id,
      item_name: item.item_name,
      size: item.size || item.Size,
      color: item.color,
      status: 'pending',
      request_date: new Date().toISOString()
    }))
    const { error } = await supabase.from('ppe_requests').insert(requests)
    if (!error) {
      alert('เบิกของสำเร็จ!'); setCart([]); setShowCart(false);
    }
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-blue-500 overflow-hidden bg-slate-800">
              {user.profile_url ? <img src={user.profile_url} className="w-full h-full object-cover" /> : <UserIcon className="p-2 text-slate-500" />}
            </div>
            <div className="leading-tight">
              <h2 className="text-sm font-black">{user.full_name}</h2>
              <p className="text-[9px] text-blue-400 font-bold uppercase">{user.position || 'Crew'}</p>
            </div>
          </div>
          <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10">
            <ShoppingCart size={22} className="text-blue-400" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">{cart.length}</span>}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-4">
        {categories.map((cat) => {
          const items = inventory.filter(item => {
            const name = item.item_name.toLowerCase()
            return cat.name === 'Others' ? 
              !categories.slice(0, 4).some(c => c.keywords.some(k => name.includes(k))) :
              cat.keywords.some(k => name.includes(k))
          })

          if (items.length === 0) return null
          const isOpen = expandedCat === cat.name

          return (
            <div key={cat.name} className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
              <button 
                onClick={() => setExpandedCat(isOpen ? null : cat.name)}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isOpen ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                    {cat.icon}
                  </div>
                  <div className="text-left">
                    <span className="font-black text-sm block uppercase tracking-tight">{cat.name}</span>
                    <span className="text-[10px] text-slate-500 font-bold">{items.length} Items</span>
                  </div>
                </div>
                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} className="text-slate-600" />}
              </button>

              {isOpen && (
                <div className="px-6 pb-6 space-y-2 animate-in slide-in-from-top-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-black/20 p-4 rounded-2xl flex items-center justify-between border border-white/5">
                      <div>
                        <h4 className="text-xs font-bold">{item.item_name}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                          {item.color && `${item.color} | `}Size: {item.size || item.Size}
                        </p>
                      </div>
                      <button 
                        onClick={() => addToCart(item)}
                        className="p-2 bg-blue-600 rounded-xl hover:scale-110 transition-transform active:scale-90"
                      >
                        <Plus size={16}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cart Drawer (ย่อ) */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-in slide-in-from-right">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-xl font-black italic uppercase">Review Cart</h3>
            <button onClick={() => setShowCart(false)} className="p-2 bg-white/5 rounded-full"><X/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map((item, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold">{item.item_name}</h4>
                  <p className="text-[10px] text-slate-400 uppercase">{item.size || item.Size}</p>
                </div>
                <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-500 opacity-50"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-white/10">
            <button 
              disabled={cart.length === 0 || loading}
              onClick={handleCheckout}
              className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase active:scale-95 transition-all shadow-2xl shadow-blue-500/20"
            >
              Confirm All
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
