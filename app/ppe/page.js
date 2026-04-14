'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  User as UserIcon, 
  LogOut,
  HardHat,
  Shirt,
  HandMetal,
  Footprints,
  MoreHorizontal,
  X,
  Package
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
  const categoryOrder = [
    { name: 'Head & Face', keywords: ['helmet', 'glass', 'ear', 'mask', 'shield'], icon: <HardHat size={20}/> },
    { name: 'Body Protection', keywords: ['suit', 'coverall', 'vest', 'apron'], icon: <Shirt size={20}/> },
    { name: 'Hand Protection', keywords: ['glove'], icon: <HandMetal size={20}/> },
    { name: 'Footwear', keywords: ['boot', 'shoe'], icon: <Footprints size={20}/> },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={20}/> }
  ]

  // 2. จัดกลุ่มสินค้าตามชื่อพื้นฐาน (ลบวงเล็บสีออกเพื่อ Group)
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
    setCart([...cart, { ...item, cartId: Date.now() }])
    // ไม่ปิด expanded เพื่อให้เลือกไซส์อื่นต่อได้สะดวก
  }

  const removeFromCart = (cartId) => {
    setCart(cart.filter(i => i.cartId !== cartId))
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
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
      alert('✅ ส่งคำขอเบิกสินค้าเรียบร้อยแล้ว!')
      setCart([])
      setShowCart(false)
    } else {
      alert('❌ เกิดข้อผิดพลาด กรุณาลองใหม่')
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
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      {/* Navbar */}
      <div className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-800">
              {user.profile_url ? <img src={user.profile_url} className="w-full h-full object-cover" /> : <UserIcon className="p-2 text-slate-500" />}
            </div>
            <div className="leading-tight">
              <h2 className="text-sm font-black tracking-tight">{user.full_name}</h2>
              <p className="text-[9px] text-blue-400 font-bold uppercase">Online Portal</p>
            </div>
          </div>
          
          <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
            <ShoppingCart size={22} className="text-blue-400" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-lg border-2 border-slate-950">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-10">
        {categoryOrder.map((cat) => {
          // กรองสินค้าเข้าหมวดหมู่
          const catItems = Object.values(groupedInventory).filter(group => {
            const name = group.name.toLowerCase()
            if (cat.name === 'Others') {
              return !categoryOrder.slice(0, 4).some(c => c.keywords.some(k => name.includes(k)))
            }
            return cat.keywords.some(k => name.includes(k))
          })

          if (catItems.length === 0) return null

          return (
            <div key={cat.name} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-500 ml-1">
                {cat.icon}
                <span className="text-xs font-black uppercase tracking-[0.2em]">{cat.name}</span>
              </div>

              <div className="grid gap-3">
                {catItems.map((group) => (
                  <div key={group.name} className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
                    <button 
                      onClick={() => setExpandedId(expandedId === group.name ? null : group.name)}
                      className={`w-full p-5 flex items-center justify-between transition-colors ${expandedId === group.name ? 'bg-white/5' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-inner">
                          {getItemIcon(group.name)}
                        </div>
                        <span className="font-bold text-sm text-left">{group.name}</span>
                      </div>
                      {expandedId === group.name ? <ChevronUp size={18} className="text-blue-400"/> : <ChevronDown size={18} className="text-slate-600"/>}
                    </button>

                    {expandedId === group.name && (
                      <div className="p-4 bg-black/20 border-t border-white/5 space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-[10px] font-bold text-slate-500 uppercase px-2">Available Options:</p>
                        <div className="grid gap-2">
                          {group.options.map((opt, i) => (
                            <div key={i} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                              <div className="flex flex-col">
                                {opt.color && <span className="text-[10px] font-black text-blue-400 uppercase">{opt.color}</span>}
                                <span className="text-sm font-bold">Size: {opt.size || opt.Size}</span>
                              </div>
                              <button 
                                onClick={() => addToCart(opt)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black transition-all active:scale-90"
                              >
                                <Plus size={14}/> ADD
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

      {/* Shopping Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
            <div>
              <h3 className="text-xl font-black italic uppercase tracking-tighter">Your Cart</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Items ready for request</p>
            </div>
            <button onClick={() => setShowCart(false)} className="p-3 bg-white/5 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-all">
              <X size={24}/>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <ShoppingCart size={80} className="mb-4 opacity-10" />
                <p className="font-black uppercase tracking-widest">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.cartId} className="bg-white/5 border border-white/10 p-5 rounded-[2rem] flex items-center justify-between group animate-in zoom-in-95">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                      {getItemIcon(item.item_name)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold leading-tight">{item.item_name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                        {item.color && <span className="text-blue-400">{item.color}</span>}
                        {item.color && ' • '}
                        Size: {item.size || item.Size}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.cartId)} className="p-3 text-slate-600 hover:text-red-500 transition-colors">
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-8 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-6 px-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Total Selection</span>
              <span className="text-2xl font-black text-blue-500">{cart.length} <span className="text-xs text-slate-500">Items</span></span>
            </div>
            <button 
              disabled={cart.length === 0 || loading}
              onClick={handleCheckout}
              className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl shadow-blue-900/40 active:scale-95 disabled:opacity-20 disabled:grayscale transition-all"
            >
              {loading ? 'PROCESSING...' : 'Confirm Request'}
            </button>
          </div>
        </div>
      )}

      {/* Footer Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-2xl border-t border-white/5 p-4 flex justify-around items-center z-40">
        <button className="flex flex-col items-center gap-1 text-blue-500">
          <Package size={20} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Shop</span>
        </button>
        <button onClick={() => router.push('/history')} className="flex flex-col items-center gap-1 text-slate-500">
          <History size={20} />
          <span className="text-[9px] font-black uppercase tracking-tighter">History</span>
        </button>
      </div>
    </div>
  )
}
