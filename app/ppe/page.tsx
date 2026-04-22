'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  HardHat, Headphones, Eye, Wind, ShieldCheck, Hand, 
  Footprints, MoreHorizontal, ChevronDown, ChevronUp, 
  Plus, AlertTriangle, X, Lock, Shirt
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [inventory, setInventory] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 })
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const loadCart = useCallback(() => {
    const saved = localStorage.getItem('kmt_cart') || '[]'
    setCart(JSON.parse(saved))
  }, [])

  useEffect(() => {
    setMounted(true)
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const u = JSON.parse(cachedUser)
    setUser(u)
    setIsAdmin(["safety officer", "chief officer", "barge master"].includes((u.position || "").toLowerCase()))
    loadCart()

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
      if (inv) setInventory(inv)
      const currentYear = new Date().getFullYear()
      const { data: reqs } = await supabase.from('ppe_requests').select('item_name').eq('crew_id', u.id).neq('status', 'rejected').gte('created_at', `${currentYear}-01-01`)
      if (reqs) {
        setQuotas({ 
          suit: reqs.filter((r: any) => r.item_name.toLowerCase().includes('suit')).length, 
          boot: reqs.filter((r: any) => r.item_name.toLowerCase().includes('safety boot') && !r.item_name.toLowerCase().includes('rubber')).length 
        })
      }
    }
    fetchData()
    window.addEventListener('cart-updated', loadCart)
    return () => window.removeEventListener('cart-updated', loadCart)
  }, [router, loadCart])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('kmt_cart', JSON.stringify(cart))
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: cart.length }))
    }
  }, [cart, mounted])

  const categories = [
    { name: 'Head Protection', icon: <HardHat size={20}/>, keywords: ['helmet', 'hat'] },
    { name: 'Ears Protection', icon: <Headphones size={20}/>, keywords: ['ear'] },
    { name: 'Eyes Protection', icon: <Eye size={20}/>, keywords: ['glass', 'goggle'] },
    { name: 'Respiratory Protection', icon: <Wind size={20}/>, keywords: ['mask', 'respirator'] },
    { name: 'Body Protection', icon: <Shirt size={20}/>, keywords: ['suit', 'coverall', 'vest'] },
    { name: 'Hands Protection', icon: <Hand size={20}/>, keywords: ['glove'] },
    { name: 'Foots Protection', icon: <Footprints size={20}/>, keywords: ['boot', 'shoe'] },
    { name: 'Other', icon: <MoreHorizontal size={20}/>, keywords: [] }
  ]

  const groupedInventory = useMemo(() => {
    const groups: any = {}
    inventory.forEach((item: any) => {
      const name = item.item_name || "Unknown"
      if (!groups[name]) groups[name] = { name, variants: [] }
      groups[name].variants.push(item)
    })
    return Object.values(groups)
  }, [inventory])

  const addToCart = (variant: any) => {
    const stock = Number(variant.quantity || 0)
    const inCart = cart.filter((i: any) => i.id === variant.id).length
    if (inCart >= stock) return toast.error("สต๊อกไม่พอ");

    const name = variant.item_name.toLowerCase()
    const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');

    if (isSuit || isBoot) {
      const limit = isSuit ? 2 : 1
      const currentQuota = isSuit ? quotas.suit : quotas.boot
      const inCartCount = cart.filter((i: any) => isSuit ? i.item_name.toLowerCase().includes('suit') : (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber'))).length
      if (currentQuota + inCartCount >= limit) return toast.warning(`โควตาจำกัด ${limit} ${isSuit ? 'ชุด' : 'คู่'} ต่อปี`);
    }

    setCart([...cart, { ...variant, cartId: Date.now() }])
    toast.success('เพิ่มลงตะกร้าแล้ว')
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-black text-white pb-32 pt-24 px-4 font-sans">
      <div className="max-w-md mx-auto space-y-4">
        {categories.map(cat => {
          const catItems: any = groupedInventory.filter((group: any) => {
            const n = group.name.toLowerCase()
            return cat.name === 'Other' ? !categories.slice(0, 7).some(c => c.keywords.some(k => n.includes(k))) : cat.keywords.some(k => n.includes(k))
          })
          if (catItems.length === 0) return null
          const isCatOpen = expandedCat === cat.name
          return (
            <div key={cat.name} className={`rounded-[32px] border transition-all ${isCatOpen ? 'border-orange-500 bg-zinc-900 shadow-[0_0_30px_rgba(249,115,22,0.1)]' : 'border-white/5 bg-zinc-900/50'}`}>
              <button onClick={() => setExpandedCat(isCatOpen ? null : cat.name)} className="w-full p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isCatOpen ? 'bg-orange-500 text-white' : 'bg-black text-zinc-500 border border-white/5'}`}>{cat.icon}</div>
                  <span className={`text-sm font-black uppercase tracking-tighter ${isCatOpen ? 'text-white' : 'text-zinc-400'}`}>{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={20} className="text-orange-500"/> : <ChevronDown size={20} className="text-zinc-600" />}
              </button>
              {isCatOpen && (
                <div className="px-4 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-300">
                  {catItems.map((group: any) => {
                    const name = group.name.toLowerCase()
                    const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');
                    const visibleVariants = group.variants.filter((v: any) => {
                      if (isSuit) return String(v.size) === String(user.suit_size) && String(v.color) === String(user.suit_color);
                      if (isBoot) return String(v.size) === String(user.boot_size);
                      return true;
                    })
                    if (visibleVariants.length === 0) return null;
                    return (
                      <div key={group.name} className="bg-black/40 rounded-2xl overflow-hidden border border-white/5">
                        <button onClick={() => setExpandedItem(expandedItem === group.name ? null : group.name)} className="w-full p-4 flex items-center justify-between text-left">
                          <span className="text-[11px] font-black text-orange-400 uppercase tracking-widest">{group.name}</span>
                          <ChevronDown size={14} className={`text-zinc-600 transition-transform ${expandedItem === group.name ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedItem === group.name && (
                          <div className="p-3 space-y-2 bg-black/20">
                            {visibleVariants.map((variant: any, vIdx: number) => {
                              const stock = Number(variant.quantity || 0)
                              const inCartCount = cart.filter((i: any) => i.id === variant.id).length
                              const currentStock = stock - inCartCount
                              const canAdd = currentStock > 0
                              return (
                                <div key={vIdx} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-zinc-900/30">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-white">{variant.color} {variant.size}</span>
                                    <div className="mt-1">
                                      {currentStock <= 0 ? (
                                        <span className="text-red-500 uppercase text-[8px] font-bold flex items-center gap-1"><AlertTriangle size={10}/> Out of Stock</span>
                                      ) : isAdmin ? (
                                        <span className="text-zinc-500 text-[8px]">STOCK: {currentStock}</span>
                                      ) : (
                                        <span className="text-emerald-500 uppercase text-[8px] font-bold italic">● In Stock</span>
                                      )}
                                    </div>
                                  </div>
                                  {canAdd ? (
                                    <button onClick={() => addToCart(variant)} className="p-3 bg-orange-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><Plus size={16}/></button>
                                  ) : (
                                    <div className="p-3 text-zinc-800"><Lock size={16}/></div>
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PPEPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><PPEContent /></Suspense> )
}
