'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  HardHat, Headphones, Eye, Wind, Hand, Footprints, MoreHorizontal, 
  Plus, AlertTriangle, Lock, Shirt, ShoppingBag, User, ShieldAlert
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [inventory, setInventory] = useState<any[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [activeCat, setActiveCat] = useState('All')

  const loadCart = useCallback(() => { 
    setCartCount(JSON.parse(localStorage.getItem('kmt_cart') || '[]').length) 
  }, [])

  useEffect(() => {
    setMounted(true)
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    setIsAdmin(["safety officer", "chief officer", "barge master"].includes((u.position || "").toLowerCase().trim()))
    loadCart()
    supabase.from('ppe_inventory').select('*').order('item_name').then(({data}) => data && setInventory(data))
    window.addEventListener('cart-updated', loadCart)
    return () => window.removeEventListener('cart-updated', loadCart)
  }, [router, loadCart])

  const categoryConfig = [
    { name: 'Head Protection', icon: HardHat, label: 'Head' },
    { name: 'Ears Protection', icon: Headphones, label: 'Ears' },
    { name: 'Eyes Protection', icon: Eye, label: 'Eyes' },
    { name: 'Respiratory Protection', icon: Wind, label: 'Resp' },
    { name: 'Body Protection', icon: Shirt, label: 'Body' },
    { name: 'Hands Protection', icon: Hand, label: 'Hands' },
    { name: 'Foots Protection', icon: Footprints, label: 'Foots' },
    { name: 'Other', icon: MoreHorizontal, label: 'Other' },
  ]

  // 🎯 Logic การแสดงผลของ: แอดมินเห็นทุกอย่าง พนักงานเห็นแค่ไซส์ตัวเอง
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (activeCat !== 'All' && item.category !== activeCat) return false;
      if (isAdmin) return true; // แอดมินเห็นครบทุกสี ทุกไซส์
      
      const name = item.item_name.toLowerCase()
      const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');
      if (isSuit) return String(item.size) === String(user?.suit_size) && String(item.color) === String(user?.suit_color);
      if (isBoot) return String(item.size) === String(user?.boot_size);
      return true;
    }).sort((a, b) => (a.item_id_code || "").localeCompare(b.item_id_code || "", undefined, {numeric: true}))
  }, [inventory, activeCat, isAdmin, user])

  const addToCart = (item: any) => {
    const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
    if (currentCart.filter((i: any) => i.id === item.id).length >= Number(item.quantity)) return toast.error("Stock limit reached");
    
    const newCart = [...currentCart, { ...item, cartId: Date.now() }]
    localStorage.setItem('kmt_cart', JSON.stringify(newCart))
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }))
    toast.success(`${item.item_name} added to cart`)
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-black text-white pb-32 pt-28 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* 🛠️ SIMPLE HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-8">
           <div>
              <h1 className="text-3xl md:text-5xl font-black italic uppercase text-white tracking-tighter">Request PPE</h1>
              <p className="text-orange-500 text-xs font-bold uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                {isAdmin ? <ShieldAlert size={14}/> : <User size={14}/>}
                {isAdmin ? 'Storekeeper Administrative Mode' : `Personnel: ${user.full_name}`}
              </p>
           </div>
           <div className="bg-zinc-900 border border-orange-500/20 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-xl">
              <ShoppingBag className="text-orange-500" size={20}/>
              <span className="text-xl font-black">{cartCount} <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Items in cart</span></span>
           </div>
        </div>

        {/* 🎯 CATEGORY SELECTOR */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
           <button onClick={() => setActiveCat('All')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all border ${activeCat === 'All' ? 'bg-orange-600 text-white' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>All</button>
           {categoryConfig.map(cat => (
             <button key={cat.name} onClick={() => setActiveCat(cat.name)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all border whitespace-nowrap ${activeCat === cat.name ? 'bg-orange-600 text-white' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
                <cat.icon size={16}/> {cat.label}
             </button>
           ))}
        </div>

        {/* 🛒 ITEM GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
           {filteredInventory.map((item) => {
              const inStock = Number(item.quantity || 0) > 0
              return (
                <div key={item.id} className={`bg-zinc-900/50 border ${inStock ? 'border-white/5' : 'border-red-500/20'} rounded-[32px] p-5 flex flex-col justify-between hover:border-orange-500/50 transition-all shadow-xl group`}>
                   <div className="space-y-3">
                      <span className="text-[8px] font-black uppercase text-zinc-600 bg-black/40 px-2 py-1 rounded-md">{item.item_id_code}</span>
                      <div>
                        <h3 className="text-white font-black text-xs md:text-sm uppercase italic leading-tight">{item.item_name}</h3>
                        <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase">{item.color} | {item.size}</p>
                      </div>
                   </div>
                   <div className="mt-6 flex items-end justify-between pt-4 border-t border-white/5">
                      <div className="flex flex-col">
                         {isAdmin ? <span className="text-xs font-black text-orange-500">{item.quantity} <span className="text-[7px] text-zinc-700">STK</span></span> : <span className={`text-[8px] font-bold uppercase ${inStock ? 'text-emerald-500' : 'text-red-600'}`}>{inStock ? '● In Stock' : 'Out of Stock'}</span>}
                      </div>
                      <button onClick={() => addToCart(item)} disabled={!inStock} className="w-10 h-10 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-900 text-white rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-orange-600/10">
                         {inStock ? <Plus size={18}/> : <Lock size={14}/>}
                      </button>
                   </div>
                </div>
              )
           })}
        </div>
      </div>
    </div>
  )
}

export default function PPEPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><PPEContent /></Suspense> )
}
