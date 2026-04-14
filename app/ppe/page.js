'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, 
  HardHat, Headphones, Eye, Wind, Shirt, Hand, 
  Footprints, MoreHorizontal, X, Package, ShieldAlert
} from 'lucide-react'

export default function PPEPage() {
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [history, setHistory] = useState([])
  const [expandedCat, setExpandedCat] = useState(null)
  const [expandedItem, setExpandedItem] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const u = JSON.parse(cachedUser)
    setUser(u)

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
      const { data: reqs } = await supabase
        .from('ppe_requests')
        .select('*')
        .eq('crew_id', u.id)
        .gte('request_date', startOfYear)
      if (reqs) setHistory(reqs)
    }
    fetchData()
  }, [router])

  const categories = [
    { name: 'Head', keywords: ['helmet'], icon: <HardHat size={18}/> },
    { name: 'Ears', keywords: ['ear'], icon: <Headphones size={18}/> },
    { name: 'Eyes', keywords: ['glass', 'goggle'], icon: <Eye size={18}/> },
    { name: 'Respiratory', keywords: ['mask'], icon: <Wind size={18}/> },
    { name: 'Body', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={18}/> },
    { name: 'Hands', keywords: ['glove'], icon: <Hand size={18}/> },
    { name: 'Foots', keywords: ['boot', 'shoe'], icon: <Footprints size={18}/> },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={18}/> }
  ]

  const groupedInventory = useMemo(() => {
    const groups = {}
    inventory.forEach(item => {
      const name = item.item_name
      if (!groups[name]) groups[name] = { name, variants: [] }
      groups[name].variants.push(item)
    })
    return Object.values(groups)
  }, [inventory])

  const getLimitStatus = (itemName) => {
    const lowerName = itemName.toLowerCase()
    const count = history.filter(h => h.item_name.toLowerCase().includes(lowerName)).length
    if (lowerName.includes('suit') && count >= 2) return { reached: true, msg: 'จำกัด 2 ชุด/ปี' }
    if (lowerName.includes('boot') && count >= 1) return { reached: true, msg: 'จำกัด 1 คู่/ปี' }
    return { reached: false }
  }

  const addToCart = (variant) => {
    setCart([...cart, { ...variant, cartId: Date.now() }])
  }

  const handleCheckout = async () => {
    setLoading(true)
    const reqs = cart.map(i => ({
      crew_id: user.id,
      item_name: i.item_name,
      size: i.size || i.Size,
      color: i.color || null,
      status: 'pending',
      request_date: new Date().toISOString()
    }))
    const { error } = await supabase.from('ppe_requests').insert(reqs)
    if (!error) {
      alert('เบิกอุปกรณ์เรียบร้อยแล้ว'); setCart([]); setShowCart(false);
      window.location.reload(); 
    }
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <div className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-5">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black">{user.full_name[0]}</div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-tight">{user.full_name}</h2>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">{user.position}</p>
            </div>
          </div>
          <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10">
            <ShoppingCart size={20} className="text-blue-400" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{cart.length}</span>}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-4">
        {categories.map(cat => {
          const catItems = groupedInventory.filter(group => {
            const n = group.name.toLowerCase()
            return cat.name === 'Others' ? 
              !categories.slice(0, 7).some(c => c.keywords.some(k => n.includes(k))) : 
              cat.keywords.some(k => n.includes(k))
          })

          if (catItems.length === 0) return null
          const isCatOpen = expandedCat === cat.name

          return (
            <div key={cat.name} className="space-y-2">
              <button 
                onClick={() => setExpandedCat(isCatOpen ? null : cat.name)}
                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${isCatOpen ? 'bg-blue-600 shadow-lg shadow-blue-900/40' : 'bg-white/5 border border-white/10'}`}
              >
                <div className="flex items-center gap-3">
                  {cat.icon}
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={16}/> : <ChevronDown size={16} className="text-slate-500"/>}
              </button>

              {isCatOpen && (
                <div className="space-y-2 pt-1">
                  {catItems.map((group) => {
                    const isItemOpen = expandedItem === group.name
                    const limit = getLimitStatus(group.name)

                    return (
                      <div key={group.name} className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                        <button 
                          onClick={() => setExpandedItem(isItemOpen ? null : group.name)}
                          className="w-full p-4 flex items-center justify-between hover:bg-white/5"
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-xs font-bold">{group.name}</span>
                            {limit.reached && <span className="text-[8px] text-red-500 font-black uppercase flex items-center gap-1 mt-1"><ShieldAlert size={10}/> {limit.msg}</span>}
                          </div>
                          <ChevronDown size={14} className={`text-slate-600 transition-transform ${isItemOpen ? 'rotate-180' : ''}`}/>
                        </button>

                        {isItemOpen && (
                          <div className="px-4 pb-4 space-y-2 bg-black/20">
                            {group.variants.map((variant, vIdx) => {
                              const isSuit = group.name.toLowerCase().includes('suit')
                              const isBoot = group.name.toLowerCase().includes('boot')
                              const isLocked = (isSuit && (variant.color !== user.suit_color || variant.size !== user.suit_size)) ||
                                               (isBoot && variant.size !== user.boot_size)
                              
                              const stock = variant.stock || variant.Quantity || 0
                              const isOutOfStock = stock <= 0

                              if (isLocked) return null

                              return (
                                <div key={vIdx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-bold">
                                      {variant.color && variant.size ? `${variant.color} - ${variant.size}` : (variant.color || variant.size || 'Standard')}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase ${isOutOfStock ? 'text-red-500' : 'text-slate-500'}`}>
                                      {isOutOfStock ? 'OUT OF STOCK' : `Stock: ${stock}`}
                                    </span>
                                  </div>
                                  <button 
                                    disabled={isOutOfStock || limit.reached}
                                    onClick={() => addToCart(variant)}
                                    className="p-2 bg-blue-600 rounded-lg disabled:opacity-10 active:scale-90 transition-transform"
                                  >
                                    <Plus size={14}/>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-in slide-in-from-bottom">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900">
            <h3 className="text-sm font-black uppercase tracking-widest text-blue-500">Cart Review</h3>
            <button onClick={() => setShowCart(false)} className="p-2 bg-white/10 rounded-full"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <Package size={64}/>
                <p className="text-xs font-bold mt-4 uppercase">Cart is empty</p>
              </div>
            ) : cart.map((item) => (
              <div key={item.cartId} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                <div>
                  <p className="text-xs font-bold">{item.item_name}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{item.color && `${item.color} | `}{item.size || item.Size}</p>
                </div>
                <button onClick={() => setCart(cart.filter(i => i.cartId !== item.cartId))}><Trash2 size={18} className="text-red-500/50"/></button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-white/10 bg-slate-900/50 backdrop-blur-md">
            <button 
              disabled={cart.length === 0 || loading}
              onClick={handleCheckout}
              className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-blue-500/30 active:scale-95 transition-all"
            >
              {loading ? 'Processing...' : `Confirm Request (${cart.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
