'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  HardHat, Headphones, Eye, Wind, Hand, Footprints, MoreHorizontal, 
  Plus, AlertTriangle, Lock, Shirt, Users, ChevronRight, ShoppingBag
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [crews, setCrews] = useState<any[]>([])
  const [targetCrewId, setTargetCrewId] = useState<string>('')
  const [inventory, setInventory] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 })
  const [activeCat, setActiveCat] = useState('All')

  const loadCart = useCallback(() => { 
    setCart(JSON.parse(localStorage.getItem('kmt_cart') || '[]')) 
  }, [])

  useEffect(() => {
    setMounted(true)
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    setTargetCrewId(u.id)
    
    const isAdminCheck = ["safety officer", "chief officer", "barge master"].includes((u.position || "").toLowerCase().trim())
    setIsAdmin(isAdminCheck)
    loadCart()

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
      if (inv) setInventory(inv)
      if (isAdminCheck) {
        const { data: cr } = await supabase.from('crews').select('*').order('full_name')
        if (cr) setCrews(cr)
      }
    }
    fetchData()
    window.addEventListener('cart-updated', loadCart)
    return () => window.removeEventListener('cart-updated', loadCart)
  }, [router, loadCart])

  useEffect(() => {
    async function fetchQuotas() {
      if (!targetCrewId) return;
      const currentYear = new Date().getFullYear()
      const { data: reqs } = await supabase.from('ppe_requests').select('items').eq('crew_id', targetCrewId).neq('status', 'rejected').gte('created_at', `${currentYear}-01-01`)
      let sc = 0; let bc = 0;
      reqs?.forEach(r => {
        r.items?.forEach((i:any) => {
          if (i.item_name.toLowerCase().includes('suit')) sc++;
          if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bc++;
        })
      })
      setQuotas({ suit: sc, boot: bc })
      
      const tc = crews.find(c => c.id === targetCrewId)
      if (tc && targetCrewId !== user?.id) localStorage.setItem('kmt_target_crew', JSON.stringify(tc))
      else localStorage.removeItem('kmt_target_crew')
    }
    fetchQuotas()
  }, [targetCrewId, crews, user])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('kmt_cart', JSON.stringify(cart))
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: cart.length }))
    }
  }, [cart, mounted])

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

  const activeProfile = targetCrewId === user?.id ? user : crews.find(c => c.id === targetCrewId) || user

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const name = item.item_name.toLowerCase()
      const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');
      
      // Filter by Category
      if (activeCat !== 'All' && item.category !== activeCat) return false;

      // Identity Lock
      if (isSuit) return String(item.size) === String(activeProfile?.suit_size) && String(item.color) === String(activeProfile?.suit_color);
      if (isBoot) return String(item.size) === String(activeProfile?.boot_size);
      return true;
    })
  }, [inventory, activeCat, activeProfile])

  const addToCart = (variant: any) => {
    const stock = Number(variant.quantity || 0)
    const inCartCount = cart.filter((i: any) => i.id === variant.id).length
    if (inCartCount >= stock) return toast.error("Out of stock!");

    const name = variant.item_name.toLowerCase()
    const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');

    if (isSuit || isBoot) {
      const limit = isSuit ? 2 : 1
      const currentQuota = isSuit ? quotas.suit : quotas.boot
      const inCartItems = cart.filter((i: any) => {
        const n = i.item_name.toLowerCase()
        return isSuit ? n.includes('suit') : (n.includes('safety boot') && !n.includes('rubber'))
      }).length
      
      if (currentQuota + inCartItems >= limit) {
         if (isAdmin) toast.warning(`Admin Override: Over quota (${limit}/year)`);
         else return toast.error(`Quota limit reached (${limit}/year)`);
      }
    }
    setCart([...cart, { ...variant, cartId: Date.now() }])
    toast.success('Added to Cart')
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-black text-white pb-32 pt-28 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* 🛠️ IDENTITY & QUOTA HEADER */}
        <div className="bg-zinc-900 border border-orange-500/20 rounded-[40px] p-6 md:p-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12"><ShoppingBag size={200}/></div>
           
           <div className="w-full md:w-auto space-y-4 relative z-10">
              <div className="flex items-center gap-4">
                 <div className="w-16 h-16 bg-orange-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20"><User size={32}/></div>
                 <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Requesting Personnel</p>
                    {isAdmin ? (
                      <select value={targetCrewId} onChange={(e) => setTargetCrewId(e.target.value)} className="bg-transparent text-xl md:text-2xl font-black text-white outline-none cursor-pointer border-b border-orange-500/50 py-1">
                        <option value={user.id}>{user.full_name} (You)</option>
                        {crews.filter(c => c.id !== user.id).map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.full_name}</option>)}
                      </select>
                    ) : (
                      <h2 className="text-xl md:text-2xl font-black text-white uppercase italic">{user.full_name}</h2>
                    )}
                 </div>
              </div>
           </div>

           <div className="flex gap-4 w-full md:w-auto relative z-10">
              <div className="flex-1 md:w-40 bg-black/40 p-5 rounded-[24px] border border-white/5 space-y-2">
                 <div className="flex justify-between text-[8px] font-black uppercase text-zinc-500 tracking-tighter"><span>Boiler Suit</span><span>{quotas.suit}/2</span></div>
                 <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${quotas.suit >= 2 ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${(quotas.suit/2)*100}%` }}></div></div>
              </div>
              <div className="flex-1 md:w-40 bg-black/40 p-5 rounded-[24px] border border-white/5 space-y-2">
                 <div className="flex justify-between text-[8px] font-black uppercase text-zinc-500 tracking-tighter"><span>Safety Boots</span><span>{quotas.boot}/1</span></div>
                 <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${quotas.boot >= 1 ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${(quotas.boot/1)*100}%` }}></div></div>
              </div>
           </div>
        </div>

        {/* 🎯 CATEGORY SELECTOR */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-4 px-2">
           <button onClick={() => setActiveCat('All')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${activeCat === 'All' ? 'bg-orange-600 border-orange-400 text-white shadow-lg' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>All Items</button>
           {categoryConfig.map(cat => {
              const Icon = cat.icon;
              return (
                <button key={cat.name} onClick={() => setActiveCat(cat.name)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border whitespace-nowrap ${activeCat === cat.name ? 'bg-orange-600 border-orange-400 text-white shadow-lg' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
                   <Icon size={16}/> {cat.label}
                </button>
              )
           })}
        </div>

        {/* 🛒 ITEM GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
           {filteredInventory.map((item) => {
              const stock = Number(item.quantity || 0)
              const inCartCount = cart.filter(i => i.id === item.id).length
              const currentStock = stock - inCartCount
              return (
                <div key={item.id} className="group bg-zinc-900/50 border border-white/5 rounded-[32px] p-5 md:p-6 flex flex-col justify-between hover:border-orange-500/50 transition-all shadow-xl">
                   <div className="space-y-4">
                      <div className="flex justify-between items-start">
                         <span className="bg-black/40 text-zinc-600 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter">{item.item_id_code}</span>
                         {currentStock <= 0 && <span className="text-red-500"><AlertTriangle size={16}/></span>}
                      </div>
                      <div className="space-y-1">
                         <h3 className="text-white font-black text-xs md:text-sm uppercase leading-tight italic">{item.item_name}</h3>
                         <p className="text-[10px] text-zinc-500 font-bold uppercase">{item.color} | {item.size}</p>
                      </div>
                   </div>

                   <div className="mt-8 flex items-end justify-between pt-4 border-t border-white/5">
                      <div className="flex flex-col">
                         {isAdmin ? (
                            <span className="text-xs font-black text-white">{currentStock} <span className="text-[8px] text-zinc-600 uppercase">{item.unit}</span></span>
                         ) : (
                            <span className={`text-[9px] font-black uppercase italic ${currentStock > 0 ? 'text-emerald-500' : 'text-red-600'}`}>{currentStock > 0 ? '● In Stock' : 'Out of Stock'}</span>
                         )}
                         <span className="text-[7px] text-zinc-700 font-black uppercase">Availability</span>
                      </div>
                      <button 
                        onClick={() => addToCart(item)} 
                        disabled={currentStock <= 0}
                        className="w-10 h-10 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/10 active:scale-90 transition-all"
                      >
                         {currentStock > 0 ? <Plus size={20}/> : <Lock size={16}/>}
                      </button>
                   </div>
                </div>
              )
           })}
        </div>
        {filteredInventory.length === 0 && <div className="py-20 text-center text-zinc-700 font-black uppercase tracking-widest italic">No items found in this section.</div>}
      </div>
    </div>
  )
}

export default function PPEPage() {
  return ( <Suspense fallback={<div>Loading Storefront...</div>}><PPEContent /></Suspense> )
}
