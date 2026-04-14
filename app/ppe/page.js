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
  const [expandedId, setExpandedId] = useState(null)
  const [showCart, setShowCart] = useState(false)
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
      const { data, error } = await supabase.from('ppe_inventory').select('*')
      if (!error && data) setInventory(data)
    }
    fetchInventory()
  }, [router])

  // 1. จัดหมวดหมู่จากหัวลงเท้า
  const categoryOrder = [
    { name: 'Head & Face', keywords: ['helmet', 'glass', 'ear', 'mask'], icon: <HardHat size={20}/> },
    { name: 'Body Protection', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={20}/> },
    { name: 'Hand Protection', keywords: ['glove'], icon: <HandMetal size={20}/> },
    { name: 'Footwear', keywords: ['boot', 'shoe'], icon: <Footprints size={20}/> },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={20}/> }
  ]

  // 2. จัดกลุ่มสินค้าตามชื่อหลัก (ลบวงเล็บออก)
  const groupedInventory = useMemo(() => {
    return inventory.reduce((acc, item) => {
      const baseName = item.item_name.split('(')[0].trim()
      if (!acc[baseName]) {
        acc[baseName] = { name: baseName, options: [] }
      }
      acc[baseName].options.push(item)
      return acc
    }, {})
  }, [inventory])

  const addToCart = (item) => {
    setCart(prev => [...prev, { ...item, cartId: Date.now() }])
  }

  const removeFromCart = (cartId) => {
    setCart(prev => prev.filter(i => i.cartId !== cartId))
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)
    
    const requests = cart.map(item => ({
      crew_id: user.id,
      item_name: item.item_name,
      size: item.size || item.Size,
      color: item.color || null,
      status: 'pending',
      request_date: new Date().toISOString()
    }))

    const { error } = await supabase.from('ppe_requests').insert(requests)
    if (!error) {
      alert('✅ ส่งคำขอเรียบร้อยแล้ว!')
      setCart([])
      setShowCart(false)
    } else {
      alert('❌ เกิดข้อผิดพลาดในการส่งข้อมูล')
    }
    setLoading(false)
  }

  const getItemIcon = (name) => {
    const n = name.toLowerCase()
    if (n.includes('helmet') || n.includes('glass')) return <HardHat className="text-orange-500" />
    if (n.includes('suit')) return <Shirt className="text-blue-500" />
    if (n.includes('glove')) return <HandMetal className="text-emerald-500" />
    if (n.includes('boot')) return <Footprints className="text-yellow-600" />
    return <Package className="text-slate-400" />
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Top Navbar */}
      <div className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-blue-500 overflow-hidden">
              {user.profile_url ? <img src={user.profile_url} className="w-full h-full object-cover" /> : <UserIcon className="p-2 text-slate-500" />}
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">{user.full_name}</h2>
              <p className="text-[10px] text-blue-400 font-bold uppercase">Crew Member</p>
            </div>
          </div>
          <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10">
            <ShoppingCart size={22} className="text-blue-400" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-8">
        {categoryOrder.map((cat) => {
          const items = Object.values(groupedInventory).filter(g => {
            const name = g.name.toLowerCase()
            return cat.name === 'Others' ? 
              !categoryOrder.slice(0, 4).some(c => c.keywords.some(k => name.includes(k))) :
              cat.keywords.some(k => name.includes(k))
          })

          if (items.length === 0) return null

          return (
            <div key={cat.name} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-500 px-1">
                {cat.icon}
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{cat.name}</span>
              </div>
              <div className="grid gap-3">
                {items.map((group) => (
                  <div key={group.name} className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
                    <button 
                      onClick={() => setExpandedId(expandedId === group.name ? null : group.name)}
                      className="w-full p-5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-inner">
                          {getItemIcon(group.name)}
                        </div>
                        <span className="font-bold text-sm text-left">{group.name}</span>
                      </div>
                      {expandedId === group.name ? <ChevronUp size={18}/> : <ChevronDown size={18} className="text-slate-600"/>}
                    </button>

                    {expandedId === group.name && (
                      <div className="p-4 bg-black/20 border-t border-white/5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                        {group.options.map((opt, i) => (
                          <div key={i} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                            <div className="flex flex-col">
                              {opt.color && <span className="text-[10px] font-bold text-blue-400 uppercase">{opt.color}</span>}
                              <span className="text-xs font-bold">Size: {opt.size || opt.Size}</span>
                            </div>
                            <button onClick={() => addToCart(opt)} className="p-2 bg-blue-600 rounded-xl hover:bg-blue-500 active:scale-90 transition-all">
                              <Plus size={16}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-xl font-black uppercase italic">Your Cart</h3>
            <button onClick={() => setShowCart(false)} className="p-2 bg-white/5 rounded-full"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-700">
                <ShoppingCart size={64} className="mb-4 opacity-10" />
                <p className="font-bold">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.cartId} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-blue-500">{getItemIcon(item.item_name)}</div>
                    <div>
                      <h4 className="text-sm font-bold">{item.item_name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {item.color && `${item.color} | `}Size: {item.size || item.Size}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.cartId)} className="text-red-500/50 hover:text-red-500"><Trash2 size={18}/></button>
                </div>
              ))
            )}
          </div>
          <div className="p-8 border-t border-white/10 bg-slate-900/80">
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-400 font-bold text-xs uppercase">Total Items</span>
              <span className="text-2xl font-black text-blue-500">{cart.length}</span>
            </div>
            <button 
              disabled={cart.length === 0 || loading}
              onClick={handleCheckout}
              className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest active:scale-95 disabled:opacity-20 transition-all"
            >
              {loading ? 'PROCESSING...' : 'Confirm Request'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 p-4 flex justify-around z-40">
        <button className="flex flex-col items-center gap-1 text-blue-500"><Package size={20}/><span className="text-[10px] font-bold">Shop</span></button>
        <button onClick={() => router.push('/history')} className="flex flex-col items-center gap-1 text-slate-500"><History size={20}/><span className="text-[10px] font-bold">History</span></button>
      </div>
    </div>
  )
}
