'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  HardHat, Headphones, Eye, Wind, Shirt, Hand, 
  Footprints, MoreHorizontal, ChevronDown, ChevronUp, 
  Plus, Lock, AlertTriangle
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [inventory, setInventory] = useState<any[]>([]); // ระบุ Type ป้องกัน Build Error
  const [cart, setCart] = useState<any[]>([]);           // ระบุ Type ป้องกัน Build Error
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 })
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    setMounted(true)
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const u = JSON.parse(cachedUser)
    setUser(u)

    const savedCart = localStorage.getItem('kmt_cart') || '[]'
    setCart(JSON.parse(savedCart))

    if (searchParams.get('settings') === 'true') {
      setShowSettings(true)
      window.history.replaceState({}, '', window.location.pathname)
    }

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
  }, [router, searchParams])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('kmt_cart', JSON.stringify(cart))
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: cart.length }))
    }
  }, [cart, mounted])

  const groupedInventory = useMemo(() => {
    const groups: any = {}
    inventory.forEach((item: any) => {
      const name = item.item_name || "Unknown Item"
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
    const lowerName = variant.item_name.toLowerCase()
    const isSuit = lowerName.includes('suit')
    const isBoot = lowerName.includes('safety boot') && !lowerName.includes('rubber')
    const isStrict = isSuit || isBoot

    const vSize = String(variant.size || "STD").trim()
    const vColor = String(variant.color || "").trim()
    const stock = Number(variant.quantity || 0)

    const inCartOfThisVariant = cart.filter((i: any) => i.id === variant.id).length
    if (inCartOfThisVariant >= stock) {
      toast.error("ขออภัย! สินค้าในสต็อกไม่พอ");
      return;
    }

    if (isStrict) {
      const mySize = isSuit ? user.suit_size : user.boot_size;
      const myColor = isSuit ? user.suit_color : null;
      if (vSize !== mySize) {
        toast.error(`ผิดไซส์! คุณลงทะเบียนไซส์ ${mySize} ไว้`);
        return;
      }
      if (isSuit && vColor !== myColor) {
        toast.error(`ผิดสี! คุณลงทะเบียนสี ${myColor} ไว้`);
        return;
      }
    }

    if (isSuit) {
      const inCartSuits = cart.filter((item: any) => item.item_name.toLowerCase().includes('suit')).length
      if (quotas.suit + inCartSuits >= 2) {
        toast.warning("เบิก Boiler suit ได้สูงสุด 2 ชุดต่อปี");
        return;
      }
    }
    if (isBoot) {
      const inCartBoots = cart.filter((item: any) => item.item_name.toLowerCase().includes('safety boot') && !item.item_name.toLowerCase().includes('rubber')).length
      if (quotas.boot + inCartBoots >= 1) {
        toast.warning("เบิก Safety Boots ได้สูงสุด 1 คู่ต่อปี");
        return;
      }
    }

    setCart([...cart, { ...variant, cartId: Date.now() }])
    toast.success(`เพิ่ม ${variant.item_name} แล้ว`);
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-[80vh] bg-slate-950 text-white pb-24 font-sans">
      {/* 🎯 ลด Padding Top ตรงนี้ให้เหลือน้อยที่สุด เพราะ Layout คุมไว้แล้ว */}
      <div className="max-w-md mx-auto p-4 space-y-4 pt-2">
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
                  {catItems.map((group: any) => (
                    <div key={group.name} className="bg-slate-800 rounded-2xl overflow-hidden border border-white/10">
                      <button onClick={() => setExpandedItem(expandedItem === group.name ? null : group.name)} className="w-full p-4 flex items-center justify-between gap-2 text-left">
                        <span className="text-[12px] font-black text-blue-300 uppercase leading-tight">{group.name}</span>
                        <ChevronDown size={16} className={`text-slate-500 transition-transform shrink-0 ${expandedItem === group.name ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedItem === group.name && (
                        <div className="p-3 space-y-2 bg-slate-900/50">
                          {group.variants.map((variant: any, vIdx: number) => {
                            const stock = Number(variant.quantity || 0)
                            const isSuit = group.name.toLowerCase().includes('suit')
                            const isBoot = group.name.toLowerCase().includes('safety boot') && !group.name.toLowerCase().includes('rubber')
                            const isStrict = isSuit || isBoot
                            const mySize = isStrict ? (isSuit ? user.suit_size : user.boot_size) : null;
                            const myColor = isSuit ? user.suit_color : null;
                            const isMySize = isStrict ? (isSuit ? (variant.color === myColor && variant.size === mySize) : (variant.size === mySize)) : true
                            const isOutOfStock = stock <= 0
                            const canRequest = isMySize && !isOutOfStock

                            return (
                              <div key={vIdx} className={`flex items-center justify-between p-4 rounded-xl border ${isMySize ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5 opacity-40'}`}>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-black uppercase">{variant.color} {variant.size}</span>
                                    {isMySize && isStrict && <span className="bg-blue-600 text-[7px] px-2 py-0.5 rounded-md font-black text-white uppercase tracking-wider">MY SIZE</span>}
                                  </div>
                                  <div className="text-[10px] font-bold">
                                    {isOutOfStock ? <span className="text-red-500 uppercase flex items-center gap-1"><AlertTriangle size={10}/> Out of Stock</span> : <span className="text-slate-500">Stock: {stock}</span>}
                                  </div>
                                </div>
                                {canRequest ? (
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
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-6 animate-in fade-in">
           <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black uppercase italic">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full"><MoreHorizontal/></button>
           </div>
           <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <ShieldCheck size={48} className="mb-4 opacity-20"/>
              <p>Settings Content</p>
           </div>
        </div>
      )}
    </div>
  )
}

export default function PPEPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black tracking-[0.3em] animate-pulse">Initializing Portal...</div>}>
      <PPEContent />
    </Suspense>
  )
}
