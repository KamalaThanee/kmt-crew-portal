'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, Settings,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, 
  Footprints, MoreHorizontal, X, Package, ShieldCheck, 
  Upload, Loader2, Lock, AlertTriangle, Calendar, CheckCircle2
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 })
  const [expandedCat, setExpandedCat] = useState(null)
  const [expandedItem, setExpandedItem] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })

  const ADMIN_ROLES = ['Safety Officer', 'Chief Officer', 'Barge Master']
  const hasFullAccess = useMemo(() => {
    if (!user?.position && !user?.rank) return false
    const pos = user.position || user.rank || ""
    return ADMIN_ROLES.some(p => p.toLowerCase() === pos.toLowerCase())
  }, [user])

  useEffect(() => {
    setMounted(true)
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const u = JSON.parse(cachedUser)
    setUser(u)

    if (searchParams.get('settings') === 'true') {
      setShowSettings(true)
      window.history.replaceState({}, '', window.location.pathname)
    }

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      const { data: settings } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
      if (settings) setSizeCharts({ suit: settings.suit_chart_url, boot: settings.boot_url })
      const currentYear = new Date().getFullYear()
      const startOfYear = `${currentYear}-01-01T00:00:00Z`
      const { data: reqs } = await supabase.from('ppe_requests').select('item_name').eq('crew_id', u.id).neq('status', 'rejected').gte('request_date', startOfYear)
      if (reqs) {
        setQuotas({ 
          suit: reqs.filter(r => r.item_name.toLowerCase().includes('suit')).length, 
          boot: reqs.filter(r => r.item_name.toLowerCase().includes('safety boot') && !r.item_name.toLowerCase().includes('rubber')).length 
        })
      }
    }
    fetchData()

    const handleOpenCart = () => setShowCart(true)
    const handleOpenSettings = () => setShowSettings(true)
    window.addEventListener('open-cart', handleOpenCart)
    window.addEventListener('open-settings', handleOpenSettings)
    return () => {
      window.removeEventListener('open-cart', handleOpenCart)
      window.removeEventListener('open-settings', handleOpenSettings)
    }
  }, [router, searchParams])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: cart.length }))
  }, [cart])

  const groupedInventory = useMemo(() => {
    const groups = {}
    inventory.forEach(item => {
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

  const getColorHex = (colorName) => {
    const c = colorName.toLowerCase();
    if(c.includes('red')) return 'bg-red-500';
    if(c.includes('navy') || c.includes('blue')) return 'bg-blue-800';
    if(c.includes('orange')) return 'bg-orange-500';
    if(c.includes('yellow')) return 'bg-yellow-400';
    if(c.includes('green')) return 'bg-emerald-500';
    if(c.includes('black')) return 'bg-neutral-900 border border-white/20';
    return 'bg-slate-500';
  }

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans pt-4 md:pt-4">
      {/* 🎯 pt-4 ขยับขึ้นแทนที่ Header เก่าแล้ว */}
      <div className="max-w-md mx-auto p-4 space-y-4 pt-16">
        {categories.map(cat => {
          const catItems = groupedInventory.filter(group => {
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
                  {catItems.map((group) => (
                    <div key={group.name} className="bg-slate-800 rounded-2xl overflow-hidden border border-white/10">
                      <button onClick={() => setExpandedItem(expandedItem === group.name ? null : group.name)} className="w-full p-4 flex items-center justify-between gap-2 text-left">
                        <span className="text-[12px] font-black text-blue-300 uppercase leading-tight">{group.name}</span>
                        <ChevronDown size={16} className={`text-slate-500 transition-transform shrink-0 ${expandedItem === group.name ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedItem === group.name && (
                        <div className="p-3 space-y-2 bg-slate-900/50">
                          {group.variants.map((variant: any, vIdx: number) => {
                            const stock = Number(variant.quantity || 0)
                            const vSize = String(variant.size || "STD").trim()
                            const vColor = String(variant.color || "").trim()
                            const isSuit = group.name.toLowerCase().includes('suit')
                            const isBoot = group.name.toLowerCase().includes('safety boot') && !group.name.toLowerCase().includes('rubber')
                            const isStrict = isSuit || isBoot
                            const isMySize = isStrict ? (isSuit ? (vColor === user.suit_color && vSize === user.suit_size) : (vSize === user.boot_size)) : true
                            const isOutOfStock = stock <= 0
                            if (!isMySize && !hasFullAccess) return null
                            return (
                              <div key={vIdx} className={`flex items-center justify-between p-4 rounded-xl border ${isMySize ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 opacity-60'}`}>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-black uppercase">{vColor} {vSize}</span>
                                    {isMySize && isStrict && <span className="bg-blue-600 text-[7px] px-2 py-0.5 rounded-md font-black text-white">MY SIZE</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-500">{isOutOfStock ? "Out of Stock" : `Stock: ${stock}`}</div>
                                </div>
                                <button disabled={isOutOfStock} onClick={() => setCart([...cart, {...variant, cartId: Date.now()}])} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-20"><Plus size={18}/></button>
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
      {/* Drawer components remain the same... */}
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
