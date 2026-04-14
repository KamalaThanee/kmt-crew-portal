'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Minus, 
  Trash2, 
  User as UserIcon, 
  LogOut,
  HardHat,
  Shirt,
  HandMetal,
  Footprints,
  MoreHorizontal,
  CheckCircle2,
  X
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
    if (!cachedUser) { router.push('/login'); return; }
    setUser(JSON.parse(cachedUser))

    async function fetchInventory() {
      const { data } = await supabase.from('ppe_inventory').select('*')
      if (data) setInventory(data)
    }
    fetchInventory()
  }, [router])

  // 1. จัดหมวดหมู่จากหัวลงเท้า
  const categories = [
    { name: 'Head & Face', icon: <HardHat size={20}/>, keywords: ['helmet', 'glass', 'ear', 'mask'] },
    { name: 'Body Protection', icon: <Shirt size={20}/>, keywords: ['suit', 'coverall', 'vest'] },
    { name: 'Hand Protection', icon: <HandMetal size={20}/>, keywords: ['glove'] },
    { name: 'Footwear', icon: <Footprints size={20}/>, keywords: ['boot', 'shoe'] },
    { name: 'Others', icon: <MoreHorizontal size={20}/>, keywords: [] }
  ]

  // 2. จัดกลุ่มสินค้าตามชื่อ (Unique Items)
  const groupedInventory = useMemo(() => {
    return inventory.reduce((acc, item) => {
      const baseName = item.item_name.split('(')[0].trim()
      if (!acc[baseName]) {
        acc[baseName] = { 
          name: baseName, 
          options: [],
          category: item.category 
        }
      }
      acc[baseName].options.push(item)
      return acc;
    }, {})
  }, [inventory])

  const addToCart = (item) => {
    setCart([...cart, { ...item, cartId: Date.now() }])
    setExpandedId(null)
  }

  const removeFromCart = (cartId) => {
    setCart(cart.filter(i => i.cartId !== cartId))
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
      alert('เบิกของเรียบร้อยแล้ว!')
      setCart([])
      setShowCart(false)
    }
    setLoading(false)
  }

  const getCatIcon = (itemName) => {
    const name = itemName.toLowerCase()
    if (name.includes('helmet') || name.includes('glass')) return <HardHat className="text-orange-500" />
    if (name.includes('suit')) return <Shirt className="text-blue-500" />
    if (name.includes('glove')) return <HandMetal className="text-emerald-500" />
    if (name.includes('boot')) return <Footprints className="text-yellow-600" />
    return <Box className="text-slate-400" />
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      {/* Top Bar */}
      <div className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/5 p-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-blue-500 overflow-hidden bg-slate-800">
              {user.profile_url ? <img src={user.profile_url} className="w-full h-full object-cover" /> : <UserIcon className="p-2 text-slate-500" />}
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">KMT CREW</p>
              <h2 className="text-sm font-black">{user.full_name}</h2>
            </div>
          </div>
          
          <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10">
            <ShoppingCart size={22} className="text-blue-400" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-10">
        {categories.map((cat) => {
          const catItems = Object.values(groupedInventory).filter(group => {
            const name = group.name.toLowerCase()
            return cat.keywords.length === 0 ? 
              !categories.slice(0, 4).some(c => c.keywords.some(k => name.includes(k))) :
              cat.keywords.some(k => name.includes(k))
          })

          if (catItems.length === 0) return null

          return (
            <div key={cat.name} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                {cat.icon}
                <span className="text-xs font-black uppercase tracking-[0.2em]">{cat.name}</span>
              </div>

              <div className="grid gap-3">
                {catItems.map((group) => (
                  <div key={group.name} className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden transition-all">
                    <button 
                      onClick={() => setExpandedId(expandedId === group.name ? null : group.name)}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                          {getCatIcon(group.name)}
                        </div>
                        <span className="font-bold text-sm text-left">{group.name}</span>
                      </div>
                      {expandedId === group.name ? <ChevronUp size={18}/> : <ChevronDown size={18} className="text-slate-600"/>}
                    </button>

                    {expandedId === group.name && (
                      <div className="p-4 bg-black/20 border-t border-white/5 grid grid-cols-1 gap-2 animate-in slide-in-from-top-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-1">Select Color & Size:</p>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {group.options.map((opt, i) => (
                            <div key={i} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                              <div className="text-xs font-bold">
                                {opt.color && <span className="text-blue-400 mr-2">{opt.color}</span>}
                                <span>{opt.size || opt.Size}</span>
                              </div>
                              <button 
                                onClick={() => addToCart(opt)}
                                className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 active:scale-95 transition-all"
                              >
                                <Plus size={16}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950/95 z-[60] flex flex-col backdrop-blur-xl animate-in fade-in">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-xl font-black italic uppercase">Review Request</h3>
            <button onClick={() => setShowCart(false)} className="p-2 bg-white/5 rounded-full"><X/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <ShoppingCart size={64} className="mb-4 opacity-20" />
                <p className="font-bold">Your cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.cartId} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                      {getCatIcon(item.item_name)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{item.item_name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {item.color && `${item.color} | `} Size: {item.size || item.Size}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.cartId)} className="text-red-500/50 hover:text-red-500 p-2">
                    <Trash2 size={18}/>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-8 border-t border-white/10 space-y-4 bg-slate-900/50">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-bold text-xs uppercase">Total Items</span>
              <span className="text-xl font-black">{cart.length}</span>
            </div>
            <button 
              disabled={cart.length === 0 || loading}
              onClick={handleCheckout}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 disabled:opacity-20 transition-all"
            >
              {loading ? 'PROCESSING...' : 'Confirm All Requests'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
