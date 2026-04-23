'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  HardHat, Headphones, Eye, Wind, Hand, Footprints, MoreHorizontal, 
  Plus, AlertTriangle, Lock, Shirt, ShoppingBag, User, ShieldAlert, XCircle, ChevronDown
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [inventory, setInventory] = useState<any[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [activeCat, setActiveCat] = useState('All')
  const [expandedItemName, setExpandedItemName] = useState<string | null>(null) // 🎯 สำหรับยุบขยายชื่อสินค้า

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

  // 🎯 จัดกลุ่มสินค้าตามชื่อ (Grouping by Name)
  const groupedInventory = useMemo(() => {
    const filtered = inventory.filter(item => activeCat === 'All' || item.category === activeCat);
    const groups: Record<string, any[]> = {};
    
    filtered.forEach(item => {
      if (!groups[item.item_name]) groups[item.item_name] = [];
      
      if (isAdmin) {
        groups[item.item_name].push(item);
      } else {
        // ลูกเรือเห็นเฉพาะไซส์ตัวเองสำหรับชุดและรองเท้า
        const name = item.item_name.toLowerCase();
        const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');
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
      .filter(([_, variants]) => variants.length > 0)
      .map(([name, variants]) => ({ name, variants }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
    <div className="min-h-screen bg-black text-white pb-32 pt-20 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* 🛠️ HEADER - กระชับพื้นที่ขึ้น */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/5 pb-6">
           <div>
              <h1 className="text-2xl md:text-4xl font-black italic uppercase text-white tracking-tighter">Request PPE</h1>
              <p className="text-orange-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                {isAdmin ? <ShieldAlert size={12} className="animate-pulse"/> : <User size={12}/>}
                {isAdmin ? 'Admin Mode' : `Personnel: ${user.full_name}`}
              </p>
           </div>
           <div className="bg-zinc-900 border border-orange-500/20 px-4 py-2 rounded-xl flex items-center gap-3 shadow-xl">
              <ShoppingBag className="text-orange-500" size={18}/>
              <span className="text-lg font-black">{cartCount} <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Items</span></span>
           </div>
        </div>

        {/* 🎯 CATEGORY SELECTOR */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
           <button onClick={() => setActiveCat('All')} className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border ${activeCat === 'All' ? 'bg-orange-600 border-orange-400 text-white shadow-lg' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>All</button>
           {categoryConfig.map(cat => (
             <button key={cat.name} onClick={() => setActiveCat(cat.name)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border whitespace-nowrap ${activeCat === cat.name ? 'bg-orange-600 border-orange-400 text-white shadow-lg' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
                <cat.icon size={14}/> {cat.label}
             </button>
           ))}
        </div>

        {/* 🛒 GROUPED ITEM GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {groupedInventory.map((group) => {
              const isExpanded = expandedItemName === group.name;
              const totalStock = group.variants.reduce((sum, v) => sum + v.quantity, 0);
              
              return (
                <div key={group.name} className={`bg-zinc-900/50 border transition-all rounded-[32px] overflow-hidden ${isExpanded ? 'border-orange-500/50 bg-zinc-900 shadow-2xl' : 'border-white/5 hover:border-white/10'}`}>
                   {/* Main Card Header */}
                   <button onClick={() => setExpandedItemName(isExpanded ? null : group.name)} className="w-full p-6 flex items-center justify-between outline-none">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-orange-500 border border-white/5"><Package size={24}/></div>
                         <div className="text-left">
                            <h3 className="text-white font-black text-sm uppercase italic">{group.name}</h3>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">{group.variants.length} Variants Available</p>
                         </div>
                      </div>
                      <ChevronDown className={`text-zinc-600 transition-transform ${isExpanded ? 'rotate-180 text-orange-500' : ''}`} />
                   </button>

                   {/* Variants List (Expanded) */}
                   {isExpanded && (
                      <div className="px-4 pb-6 space-y-2 animate-in slide-in-from-top-2">
                         {group.variants.map((v, vIdx) => {
                            const inStock = v.quantity > 0;
                            const inCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]').filter((i:any) => i.id === v.id).length;
                            const currentStock = v.quantity - inCart;
                            
                            return (
                               <div key={vIdx} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all">
                                  <div>
                                     <p className="text-white text-[10px] font-black uppercase">{v.color} | {v.size}</p>
                                     <p className={`text-[8px] font-bold mt-1 ${currentStock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {currentStock > 0 ? `● ${currentStock} In Stock` : 'Out of Stock'}
                                     </p>
                                  </div>
                                  <button onClick={() => addToCart(v)} disabled={currentStock <= 0} className="w-9 h-9 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-900 text-white rounded-xl flex items-center justify-center transition-all active:scale-90">
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
