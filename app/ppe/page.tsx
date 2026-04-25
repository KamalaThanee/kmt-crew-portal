'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import { 
  HardHat, Headphones, Eye, Wind, Hand, Footprints, MoreHorizontal, 
  Plus, AlertTriangle, Lock, Shirt, ShoppingBag, User, ShieldAlert, ChevronDown, Package
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
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
    const pos = (u.position || "").toLowerCase().trim()
    setIsAdmin(["safety officer", "chief officer", "barge master", "storekeeper", "storekeeper admin"].includes(pos))
    loadCart()

    supabase.from('ppe_inventory').select('*').order('item_name').then(({data}) => data && setInventory(data))
    
    // ดึงโควตาส่วนตัว
    const fetchMyQuotas = async () => {
      const currentYear = new Date().getFullYear()
      const reqQuery = await applyPpeRequestUserFilter(
        supabase.from('ppe_requests')
          .select('items')
          .neq('status', 'rejected')
          .gte('created_at', `${currentYear}-01-01`),
        u,
      )
      const { data: reqs } = await reqQuery
      let sc = 0; let bc = 0;
      reqs?.forEach((r: any) => {
        r.items?.forEach((i:any) => {
          if (i.item_name.toLowerCase().includes('suit')) sc++;
          if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bc++;
        })
      })
      setQuotas({ suit: sc, boot: bc })
    }
    fetchMyQuotas()

    const handleCartSync = () => loadCart()
    window.addEventListener('cart-updated', handleCartSync)
    return () => window.removeEventListener('cart-updated', handleCartSync)
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

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

  const compareSize = (a: any, b: any) => {
    const sa = String(a || '').trim().toUpperCase()
    const sb = String(b || '').trim().toUpperCase()

    const freeRank: Record<string, number> = { 'FREE SIZE': 9998, 'FREESIZE': 9998, 'FS': 9998 }
    if (freeRank[sa] !== undefined || freeRank[sb] !== undefined) {
      const ra = freeRank[sa] ?? 10000
      const rb = freeRank[sb] ?? 10000
      if (ra !== rb) return ra - rb
    }

    const idxA = sizeOrder.indexOf(sa)
    const idxB = sizeOrder.indexOf(sb)
    const hasA = idxA !== -1
    const hasB = idxB !== -1
    if (hasA && hasB) return idxA - idxB
    if (hasA) return -1
    if (hasB) return 1

    const numA = Number(sa)
    const numB = Number(sb)
    const isNumA = !Number.isNaN(numA)
    const isNumB = !Number.isNaN(numB)
    if (isNumA && isNumB) return numA - numB
    if (isNumA) return -1
    if (isNumB) return 1

    return sa.localeCompare(sb, undefined, { numeric: true })
  }

  // 🎯 กรองและจัดกลุ่มสินค้าตาม "กฎเหล็ก"
  const groupedInventory = useMemo(() => {
    const filtered = inventory.filter(item => activeCat === 'All' || item.category === activeCat);
    const groups: Record<string, any[]> = {};
    
    filtered.forEach(item => {
      if (!groups[item.item_name]) groups[item.item_name] = [];
      
      if (isAdmin) {
        groups[item.item_name].push(item); // แอดมินเห็นหมด
      } else {
        // 🔒 IDENTITY LOCK: ลูกเรือเห็นเฉพาะไซส์ตัวเอง
        const name = item.item_name.toLowerCase();
        const isSuit = name.includes('suit'); 
        const isBoot = name.includes('safety boot') && !name.includes('rubber');
        
        if (isSuit) {
          if (String(item.size) === String(user?.suit_size) && String(item.color) === String(user?.suit_color)) groups[item.item_name].push(item);
        } else if (isBoot) {
          if (String(item.size) === String(user?.boot_size)) groups[item.item_name].push(item);
        } else {
          groups[item.item_name].push(item);
        }
      }
    });

    return Object.entries(groups)
      .filter(([_, v]) => v.length > 0)
      .map(([name, variants]) => ({
        name,
        variants: variants.sort((a, b) => {
          const colorA = String(a.color || '').toUpperCase()
          const colorB = String(b.color || '').toUpperCase()
          if (colorA !== colorB) return colorA.localeCompare(colorB, undefined, { numeric: true })
          return compareSize(a.size, b.size)
        })
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, activeCat, isAdmin, user])

  const addToCart = (item: any) => {
    const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
    const inCartOfThis = currentCart.filter((i: any) => i.id === item.id).length
    if (inCartOfThis >= Number(item.quantity)) return toast.error("Stock limit reached");
    
    // 🔒 QUOTA CHECK (เฉพาะลูกเรือเบิกให้ตัวเอง)
    const name = item.item_name.toLowerCase()
    const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');
    if (!isAdmin && (isSuit || isBoot)) {
      const limit = isSuit ? 2 : 1
      const currentQuota = isSuit ? quotas.suit : quotas.boot
      const inCartItems = currentCart.filter((i: any) => {
        const n = i.item_name.toLowerCase()
        return isSuit ? n.includes('suit') : (n.includes('safety boot') && !n.includes('rubber'))
      }).length
      if (currentQuota + inCartItems >= limit) return toast.error(`Quota limit reached (${limit}/year)`);
    }

    const newCart = [...currentCart, { ...item, cartId: Date.now() }]
    localStorage.setItem('kmt_cart', JSON.stringify(newCart))
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }))
    toast.success(`${item.item_name} added`);
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-black text-white pb-32 pt-24 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-8">
           <div>
              <h1 className="text-3xl md:text-5xl font-black italic uppercase text-white tracking-tighter">Request PPE</h1>
              <p className="text-orange-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                {isAdmin ? <ShieldAlert size={12}/> : <User size={12}/>}
                {isAdmin ? 'Storekeeper Administrative Mode' : `Personnel: ${user.full_name}`}
              </p>
           </div>
           <div className="bg-zinc-900 border border-orange-500/20 px-5 py-2.5 rounded-2xl flex items-center gap-4 shadow-xl">
              <ShoppingBag className="text-orange-500" size={20}/>
              <span className="text-xl font-black">{cartCount} <span className="text-[10px] text-zinc-500 uppercase tracking-widest ml-1">Items</span></span>
           </div>
        </div>

        {/* 🎯 CATEGORY SELECTOR */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
           <button onClick={() => setActiveCat('All')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all border ${activeCat === 'All' ? 'bg-orange-600 text-white shadow-lg' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>All</button>
           {categoryConfig.map(cat => (
             <button key={cat.name} onClick={() => setActiveCat(cat.name)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all border whitespace-nowrap ${activeCat === cat.name ? 'bg-orange-600 text-white' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
                <cat.icon size={16}/> {cat.label}
             </button>
           ))}
        </div>

        {/* 🛒 GROUPED ITEM GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {groupedInventory.map((group) => {
              const isExpanded = expandedItemName === group.name;
              return (
                <div key={group.name} className={`bg-zinc-900/50 border transition-all rounded-[32px] overflow-hidden ${isExpanded ? 'border-orange-500/50 bg-zinc-900 shadow-2xl' : 'border-white/5 hover:border-white/10'}`}>
                   <button onClick={() => setExpandedItemName(isExpanded ? null : group.name)} className="w-full p-6 flex items-center justify-between outline-none">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-orange-500 border border-white/5"><Package size={24}/></div>
                         <div className="text-left">
                            <h3 className="text-white font-black text-sm uppercase italic leading-tight">{group.name}</h3>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">{group.variants.length} Options Available</p>
                         </div>
                      </div>
                      <ChevronDown className={`text-zinc-600 transition-transform ${isExpanded ? 'rotate-180 text-orange-500' : ''}`} />
                   </button>
                   {isExpanded && (
                      <div className="px-4 pb-6 space-y-2 animate-in slide-in-from-top-2">
                         {group.variants.map((v, vIdx) => {
                            const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
                            const inCart = currentCart.filter((i:any) => i.id === v.id).length;
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
