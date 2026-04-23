'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  HardHat, Headphones, Eye, Wind, Hand, Footprints, MoreHorizontal, 
  Plus, AlertTriangle, Lock, Shirt, ShoppingBag, User, ShieldAlert, XCircle, ChevronDown, Package
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [crews, setCrews] = useState<any[]>([])
  const [targetCrew, setTargetCrew] = useState<any>(null)
  const [targetCrewId, setTargetCrewId] = useState<string>('')
  
  const [inventory, setInventory] = useState<any[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [activeCat, setActiveCat] = useState('All')
  const [expandedItemName, setExpandedItemName] = useState<string | null>(null)
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 })

  const loadCart = useCallback(() => { 
    const current = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
    setCartCount(current.length) 
  }, [])

  useEffect(() => {
    setMounted(true)
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    setTargetCrewId(u.id)
    
    const pos = (u.position || "").toLowerCase().trim()
    const isAdminCheck = ["safety officer", "chief officer", "barge master"].includes(pos)
    setIsAdmin(isAdminCheck)
    loadCart()

    supabase.from('ppe_inventory').select('*').order('item_name').then(({data}) => data && setInventory(data))
    if (isAdminCheck) {
      supabase.from('crews').select('*').order('full_name').then(({data}) => data && setCrews(data))
    }

    const handleCartSync = () => loadCart()
    window.addEventListener('cart-updated', handleCartSync)
    return () => window.removeEventListener('cart-updated', handleCartSync)
  }, [router, loadCart])

  // 🎯 จัดการข้อมูลคนที่เราจะเบิกให้
  useEffect(() => {
    if (!targetCrewId || !mounted) return;
    
    const fetchQuotas = async () => {
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

      if (isAdmin && targetCrewId !== user?.id) {
        const tc = crews.find(c => c.id === targetCrewId)
        if (tc) {
          setTargetCrew(tc)
          localStorage.setItem('kmt_target_crew', JSON.stringify(tc))
        }
      } else {
        setTargetCrew(null)
        localStorage.removeItem('kmt_target_crew')
      }
    }
    fetchQuotas()
  }, [targetCrewId, crews, isAdmin, user, mounted])

  const groupedInventory = useMemo(() => {
    const filtered = inventory.filter(item => activeCat === 'All' || item.category === activeCat);
    const groups: Record<string, any[]> = {};
    const activeProfile = targetCrew || user;
    
    filtered.forEach(item => {
      if (!groups[item.item_name]) groups[item.item_name] = [];
      if (isAdmin) {
        groups[item.item_name].push(item);
      } else {
        const name = item.item_name.toLowerCase();
        const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');
        if (isSuit) {
          if (String(item.size) === String(activeProfile?.suit_size) && String(item.color) === String(activeProfile?.suit_color)) groups[item.item_name].push(item);
        } else if (isBoot) {
          if (String(item.size) === String(activeProfile?.boot_size)) groups[item.item_name].push(item);
        } else {
          groups[item.item_name].push(item);
        }
      }
    });
    return Object.entries(groups).filter(([_, v]) => v.length > 0).map(([name, variants]) => ({ name, variants })).sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, activeCat, isAdmin, user, targetCrew])

  const addToCart = (item: any) => {
    const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
    const inCartOfThis = currentCart.filter((i: any) => i.id === item.id).length
    if (inCartOfThis >= Number(item.quantity)) return toast.error("Stock limit reached");
    
    const name = item.item_name.toLowerCase()
    const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');

    if (isSuit || isBoot) {
      const limit = isSuit ? 2 : 1
      const currentQuota = isSuit ? quotas.suit : quotas.boot
      const inCartItems = currentCart.filter((i: any) => {
        const n = i.item_name.toLowerCase()
        return isSuit ? n.includes('suit') : (n.includes('safety boot') && !n.includes('rubber'))
      }).length
      if (currentQuota + inCartItems >= limit) {
         if (isAdmin) toast.warning(`Admin Override: Over quota (${limit}/year)`);
         else return toast.error(`Quota limit reached (${limit}/year)`);
      }
    }

    const newCart = [...currentCart, { ...item, cartId: Date.now() }]
    localStorage.setItem('kmt_cart', JSON.stringify(newCart))
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }))
    toast.success(`${item.item_name} added to cart`)
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-black text-white pb-32 pt-20 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/5 pb-6">
           <div>
              <h1 className="text-2xl md:text-4xl font-black italic uppercase text-white tracking-tighter">Request PPE</h1>
              <p className="text-orange-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                {isAdmin ? <ShieldAlert size={12}/> : <User size={12}/>}
                {isAdmin ? 'Admin Mode Activated' : `Personnel: ${user.full_name}`}
              </p>
           </div>
           {isAdmin && (
             <select value={targetCrewId} onChange={(e) => setTargetCrewId(e.target.value)} className="bg-zinc-900 border border-orange-500/30 p-3 rounded-xl text-white text-[10px] font-black uppercase outline-none">
                <option value={user.id}>Select Crew Member (Self)</option>
                {crews.filter(c => c.id !== user.id).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
             </select>
           )}
           <div className="bg-zinc-900 border border-orange-500/20 px-5 py-2.5 rounded-2xl flex items-center gap-4 shadow-xl">
              <ShoppingBag className="text-orange-500" size={20}/>
              <span className="text-xl font-black">{cartCount} <span className="text-[10px] text-zinc-500 uppercase tracking-widest ml-1">Items</span></span>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {groupedInventory.map((group) => {
              const isExpanded = expandedItemName === group.name;
              return (
                <div key={group.name} className={`bg-zinc-900/50 border transition-all rounded-[32px] overflow-hidden ${isExpanded ? 'border-orange-500/50 bg-zinc-900 shadow-2xl' : 'border-white/5 hover:border-white/10'}`}>
                   <button onClick={() => setExpandedItemName(isExpanded ? null : group.name)} className="w-full p-6 flex items-center justify-between outline-none">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-orange-500 border border-white/5"><Package size={24}/></div>
                         <div className="text-left">
                            <h3 className="text-white font-black text-sm uppercase italic">{group.name}</h3>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">{group.variants.length} Options Available</p>
                         </div>
                      </div>
                      <ChevronDown className={`text-zinc-600 transition-transform ${isExpanded ? 'rotate-180 text-orange-500' : ''}`} />
                   </button>
                   {isExpanded && (
                      <div className="px-4 pb-6 space-y-2 animate-in slide-in-from-top-2">
                         {group.variants.map((v, vIdx) => {
                            const inCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]').filter((i:any) => i.id === v.id).length;
                            const currentStock = v.quantity - inCart;
                            return (
                               <div key={vIdx} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                  <div>
                                     <p className="text-white text-[10px] font-black uppercase">{v.color} | {v.size}</p>
                                     <p className={`text-[8px] font-bold mt-1 ${currentStock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{currentStock > 0 ? `● ${currentStock} Available` : 'Out of Stock'}</p>
                                  </div>
                                  <button onClick={() => addToCart(v)} disabled={currentStock <= 0} className="w-9 h-9 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white rounded-xl flex items-center justify-center transition-all active:scale-90">
                                     {currentStock > 0 ? <Plus size={18}/> : <Lock size={14}/>}
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
      </div>
    </div>
  )
}

export default function PPEPage() { return ( <Suspense fallback={<div>Loading...</div>}><PPEContent /></Suspense> ) }
