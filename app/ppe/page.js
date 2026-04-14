'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, 
  User as UserIcon, HardHat, Headphones, Eye, Mask, Shirt, HandMetal, 
  Footprints, MoreHorizontal, X, Package, History
} from 'lucide-react'

export default function PPEPage() {
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [history, setHistory] = useState([])
  const [expandedCat, setExpandedCat] = useState(null)
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
      const { data: reqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).gte('request_date', new Date(new Date().getFullYear(), 0, 1).toISOString())
      if (reqs) setHistory(reqs)
    }
    fetchData()
  }, [router])

  const categories = [
    { name: 'Head', keywords: ['helmet'], icon: <HardHat size={20}/> },
    { name: 'Ears', keywords: ['ear'], icon: <Headphones size={20}/> },
    { name: 'Eyes', keywords: ['glass', 'goggle'], icon: <Eye size={20}/> },
    { name: 'Respiratory', keywords: ['mask'], icon: <Mask size={20}/> },
    { name: 'Body', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={20}/> },
    { name: 'Hands', keywords: ['glove'], icon: <HandMetal size={20}/> },
    { name: 'Foots', keywords: ['boot', 'shoe'], icon: <Footprints size={20}/> },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={20}/> }
  ]

  const checkLimit = (name) => {
    const count = history.filter(h => h.item_name.toLowerCase().includes(name.toLowerCase())).length
    if (name.toLowerCase().includes('suit') && count >= 2) return true
    if (name.toLowerCase().includes('boot') && count >= 1) return true
    return false
  }

  const addToCart = (item) => {
    setCart([...cart, { ...item, cartId: Date.now() }])
  }

  const handleCheckout = async () => {
    setLoading(true)
    const reqs = cart.map(i => ({ crew_id: user.id, item_name: i.item_name, size: i.size || i.Size, color: i.color || null, status: 'pending', request_date: new Date().toISOString() }))
    const { error } = await supabase.from('ppe_requests').insert(reqs)
    if (!error) { alert('สำเร็จ!'); setCart([]); setShowCart(false); }
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans">
      <div className="bg-slate-900/90 sticky top-0 z-50 border-b border-white/10 p-5">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black">{user.full_name[0]}</div>
            <div>
              <h2 className="text-sm font-black">{user.full_name}</h2>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">{user.position}</p>
            </div>
          </div>
          <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10">
            <ShoppingCart size={22} className="text-blue-400" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{cart.length}</span>}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-4">
        {categories.map(cat => {
          const items = inventory.filter(i => {
            const n = i.item_name.toLowerCase()
            return cat.name === 'Others' ? !categories.slice(0, 7).some(c => c.keywords.some(k => n.includes(k))) : cat.keywords.some(k => n.includes(k))
          })
          if (items.length === 0) return null
          const isOpen = expandedCat === cat.name
          return (
            <div key={cat.name} className="bg-white/5 border border-white/10 rounded-[1.5rem] overflow-hidden">
              <button onClick={() => setExpandedCat(isOpen ? null : cat.name)} className="w-full p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${isOpen ? 'bg-blue-600' : 'bg-slate-900'}`}>{cat.icon}</div>
                  <span className="font-black text-xs uppercase tracking-widest">{cat.name}</span>
                </div>
                {isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18} className="text-slate-600"/>}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 space-y-2">
                  {items.map((opt, idx) => {
                    const isSuit = opt.item_name.toLowerCase().includes('suit')
                    const isBoot = opt.item_name.toLowerCase().includes('boot')
                    const isLocked = (isSuit && (opt.color !== user.suit_color || opt.size !== user.suit_size)) || (isBoot && opt.size !== user.boot_size)
                    const isOutOfStock = (opt.stock || opt.Quantity) <= 0
                    const isLimited = checkLimit(opt.item_name)
                    if (isLocked) return null
                    return (
                      <div key={idx} className="bg-black/20 p-4 rounded-xl flex items-center justify-between border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">{opt.color && opt.size ? `${opt.color} - ${opt.size}` : (opt.color || opt.size || opt.Size || opt.item_name)}</span>
                          <span className={`text-[9px] font-bold ${isOutOfStock ? 'text-red-500' : 'text-slate-500'}`}>{isOutOfStock ? 'OUT OF STOCK' : `In Stock: ${opt.stock || opt.Quantity}`}</span>
                        </div>
                        <button disabled={isOutOfStock || isLimited} onClick={() => addToCart(opt)} className="p-2 bg-blue-600 rounded-lg disabled:opacity-10"><Plus size={16}/></button>
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
        <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900">
            <h3 className="font-black uppercase">Your Cart</h3>
            <button onClick={() => setShowCart(false)}><X/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map((item, idx) => (
              <div key={idx} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                <div><p className="text-sm font-bold">{item.item_name}</p><p className="text-[10px] text-slate-500">{item.size || item.Size}</p></div>
                <button onClick={() => setCart(cart.filter((_, i) => i !== idx))}><Trash2 size={18} className="text-red-500/50"/></button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-white/10">
            <button disabled={cart.length === 0 || loading} onClick={handleCheckout} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest">{loading ? '...' : `Confirm (${cart.length} items)`}</button>
          </div>
        </div>
      )}
    </div>
  )
}
