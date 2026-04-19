'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  HardHat, Headphones, Eye, Wind, Shirt, Hand, 
  Footprints, MoreHorizontal, ChevronDown, ChevronUp, 
  Plus, AlertTriangle, X, Lock
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
    
    const adminRoles = ["Safety Officer", "Chief Officer", "Barge Master"]
    setIsAdmin(adminRoles.includes(u.position))

    loadCart()

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      
      const currentYear = new Date().getFullYear()
      const startOfYear = `${currentYear}-01-01T00:00:00Z`
      const { data: reqs } = await supabase.from('ppe_requests').select('item_name').eq('crew_id', u.id).neq('status', 'rejected').gte('request_date', startOfYear)
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

  const groupedInventory = useMemo(() => {
    const groups: any = {}
    inventory.forEach((item: any) => {
      const name = item.item_name || "Unknown"
      if (!groups[name]) groups[name] = { name, variants: [] }
      groups[name].variants.push(item)
    })
    return Object.values(groups)
  }, [inventory])

  const categories = [
    { name: 'Head', keywords: ['helmet', 'hat'], icon: <HardHat size={20}/>, color: 'border-blue-500' },
    { name: 'Ears', keywords: ['ear'], icon: <Headphones size={20}/>, color: 'border-purple-500' },
    { name: 'Eyes', keywords: ['glass', 'goggle'], icon: <Eye size={20}/>, color: 'border-cyan-500' },
    { name: 'Respiratory', keywords: ['mask', 'respirator'], icon: <Wind size={20}/>, color: 'border-emerald-500' },
    { name: 'Body', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={20}/>, color: 'border-amber-500' },
    { name: 'Hands', keywords: ['glove'], icon: <Hand size={20}/>, color: 'border-orange-500' },
    { name: 'Foots', keywords: ['boot', 'shoe'], icon: <Footprints size={20}/>, color: 'border-indigo-500' },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={20}/>, color: 'border-slate-500' }
  ]

  const addToCart = (variant: any) => {
    const stock = Number(variant.quantity || 0)
    const inCartItems = cart.filter((i: any) => i.id === variant.id).length
    if (inCartItems >= stock) return toast.error("สต๊อกไม่พอ");

    const name = variant.item_name.toLowerCase()
    const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');

    if (isSuit || isBoot) {
      const limit = isSuit ? 2 : 1
      const currentQuota = isSuit ? quotas.suit : quotas.boot
      const inCartCount = cart.filter((i: any) => isSuit ? i.item_name.toLowerCase().includes('suit') : (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber'))).length
      if (currentQuota + inCartCount >= limit) return toast.warning(`โควตาจำกัด ${limit} ${isSuit ? 'ชุด' : 'คู่'} ต่อปี`);
    }

    const newCart = [...cart, { ...variant, cartId: Date.now() }]
    setCart(newCart)
    localStorage.setItem('kmt_cart', JSON.stringify(newCart))
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }))
    toast.success('เพิ่มลงตะกร้าแล้ว')
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans pt-4">
      <div className="max-w-md mx-auto p-4 space-y-4">
        {categories.map(cat => {
          const catItems: any = groupedInventory.filter((group: any) => {
            const n = group.name.toLowerCase()
            return cat.name === 'Others' ? !categories.slice(0, 7).some(c => c.keywords.some(k => n.includes(k))) : cat.keywords.some(k => n.includes(k))
          })
          if (catItems.length === 0) return null
          const isCatOpen = expandedCat === cat.name
          return (
            <div key={cat.name} className={`rounded-[28px] border-2 transition-all ${isCatOpen ? `${cat.color} bg-black mb-6 shadow-2xl` : 'border-white/5 bg-slate-900'}`}>
              <button onClick={() => setExpandedCat(isCatOpen ? null : cat.name)} className="w-full p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isCatOpen ? 'bg-blue-600 text-white' : 'bg-black text-slate-400 border border-white/5'}`}>{cat.icon}</div>
                  <span className={`text-base font-black uppercase tracking-tighter ${isCatOpen ? 'text-white' : 'text-slate-300'}`}>{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} className="text-slate-500" />}
              </button>
              {isCatOpen && (
                <div className="px-4 pb-6 space-y-4 animate-in slide-in-from-top duration-300">
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
                      <div key={group.name} className="bg-slate-800 rounded-2xl overflow-hidden border border-white/10">
                        <button onClick={() => setExpandedItem(expandedItem === group.name ? null : group.name)} className="w-full p-4 flex items-center justify-between gap-2 text-left">
                          <span className="text-[12px] font-black text-blue-300 uppercase leading-tight">{group.name}</span>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform shrink-0 ${expandedItem === group.name ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedItem === group.name && (
                          <div className="p-3 space-y-2 bg-slate-900/50">
                            {visibleVariants.map((variant: any, vIdx: number) => {
                              const stock = Number(variant.quantity || 0)
                              const inCartCount = cart.filter((i: any) => i.id === variant.id).length
                              const currentStock = stock - inCartCount
                              const canAdd = currentStock > 0
                              return (
                                <div key={vIdx} className="flex items-center justify-between p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-black uppercase">{variant.color} {variant.size}</span>
                                      {(isSuit || isBoot) && <span className="bg-blue-600 text-[7px] px-2 py-0.5 rounded-md font-black text-white uppercase tracking-wider">MY SIZE</span>}
                                    </div>
                                    <div className="text-[10px] font-bold">
                                      {currentStock <= 0 ? (
                                        <span className="text-red-500 uppercase flex items-center gap-1"><AlertTriangle size={10}/> Out of Stock</span>
                                      ) : isAdmin ? (
                                        <span className="text-slate-500">Stock: {currentStock}</span>
                                      ) : (
                                        <span className="text-emerald-500 uppercase tracking-widest text-[9px]">● In Stock</span>
                                      )}
                                    </div>
                                  </div>
                                  {canAdd ? (
                                    <button onClick={() => addToCart(variant)} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-500 transition-colors active:scale-95"><Plus size={18}/></button>
                                  ) : (
                                    <div className="p-3 text-slate-700 bg-white/5 rounded-xl"><Lock size={18}/></div>
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
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black tracking-[0.3em] animate-pulse text-xs">KMT PORTAL INITIALIZING...</div>}>
      <PPEContent />
    </Suspense>
  )
}
