'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { HardHat, Headphones, Eye, Wind, Hand, Footprints, MoreHorizontal, ChevronDown, ChevronUp, Plus, AlertTriangle, Lock, Shirt } from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [inventory, setInventory] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const loadCart = useCallback(() => {
    setCart(JSON.parse(localStorage.getItem('kmt_cart') || '[]'))
  }, [])

  useEffect(() => {
    setMounted(true)
    const u = JSON.parse(localStorage.getItem('kmt_user') || 'null')
    if (!u) { router.push('/login'); return; }
    setUser(u)
    setIsAdmin(["safety officer", "chief officer", "barge master"].includes((u.position || "").toLowerCase()))
    loadCart()
    supabase.from('ppe_inventory').select('*').order('item_name').then(({data}) => data && setInventory(data))
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
    const inCartCount = cart.filter((i: any) => i.id === variant.id).length
    if (inCartCount >= stock) return toast.error("สต๊อกไม่พอ");
    setCart([...cart, { ...variant, cartId: Date.now() }])
    toast.success('เพิ่มลงตะกร้าแล้ว')
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-black text-white pb-32 pt-28 px-4 font-sans relative z-10">
      <div className="max-w-md mx-auto space-y-4">
        {categories.map(cat => {
          const catItems: any = groupedInventory.filter((group: any) => {
            const n = group.name.toLowerCase()
            return cat.name === 'Other' ? !categories.slice(0, 7).some(c => c.keywords.some(k => n.includes(k))) : cat.keywords.some(k => n.includes(k))
          })
          if (catItems.length === 0) return null
          const isCatOpen = expandedCat === cat.name
          return (
            <div key={cat.name} className={`rounded-[24px] border transition-all ${isCatOpen ? 'border-orange-500 bg-zinc-900 shadow-xl' : 'border-white/5 bg-zinc-900/50'}`}>
              <button onClick={() => setExpandedCat(isCatOpen ? null : cat.name)} className="w-full p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isCatOpen ? 'bg-orange-500 text-white' : 'bg-black text-zinc-500 border border-white/5'}`}>{cat.icon}</div>
                  <span className={`text-xs font-black uppercase tracking-widest ${isCatOpen ? 'text-white' : 'text-zinc-400'}`}>{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={18} className="text-orange-500"/> : <ChevronDown size={18} className="text-zinc-600" />}
              </button>
              {isCatOpen && (
                <div className="px-4 pb-5 space-y-3 animate-in slide-in-from-top-1">
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
                      <div key={group.name} className="bg-black/40 rounded-xl overflow-hidden border border-white/5">
                        <button onClick={() => setExpandedItem(expandedItem === group.name ? null : group.name)} className="w-full p-4 flex items-center justify-between text-left">
                          <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{group.name}</span>
                          <ChevronDown size={14} className={`text-zinc-600 transition-transform ${expandedItem === group.name ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedItem === group.name && (
                          <div className="p-2 space-y-2">
                            {visibleVariants.map((variant: any, vIdx: number) => {
                              const stock = Number(variant.quantity || 0)
                              const currentStock = stock - cart.filter((i: any) => i.id === variant.id).length
                              return (
                                <div key={vIdx} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-zinc-900/30">
                                  <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-white">{variant.color} {variant.size}</span><span className="text-emerald-500 uppercase text-[8px] font-bold">{currentStock > 0 ? '● In Stock' : 'Out of Stock'}</span></div>
                                  {currentStock > 0 ? <button onClick={() => addToCart(variant)} className="p-2.5 bg-orange-600 text-white rounded-lg shadow-lg active:scale-90 transition-all"><Plus size={16}/></button> : <div className="p-2.5 text-zinc-800"><Lock size={16}/></div>}
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
