'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, Settings,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, 
  Footprints, MoreHorizontal, X, Package, ShieldCheck, 
  Upload, Loader2, Lock, Check
} from 'lucide-react'

export default function PPEPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [history, setHistory] = useState([])
  const [expandedCat, setExpandedCat] = useState(null)
  const [expandedItem, setExpandedItem] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })

  const FULL_ACCESS_POSITIONS = ['Safety Officer', 'Chief Officer', 'Barge Master']
  
  const hasFullAccess = useMemo(() => {
    if (!user?.position) return false
    return FULL_ACCESS_POSITIONS.some(pos => pos.toLowerCase() === user.position.toLowerCase())
  }, [user])

  useEffect(() => {
    setMounted(true)
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const u = JSON.parse(cachedUser)
    setUser(u)

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      const { data: settings } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
      if (settings) setSizeCharts({ suit: settings.suit_chart_url, boot: settings.boot_url })
    }
    fetchData()
  }, [router])

  const categories = [
    { name: 'Head', keywords: ['helmet', 'hat'], icon: <HardHat size={18}/>, color: 'border-blue-500' },
    { name: 'Ears', keywords: ['ear'], icon: <Headphones size={18}/>, color: 'border-purple-500' },
    { name: 'Eyes', keywords: ['glass', 'goggle'], icon: <Eye size={18}/>, color: 'border-cyan-500' },
    { name: 'Respiratory', keywords: ['mask', 'respirator'], icon: <Wind size={18}/>, color: 'border-emerald-500' },
    { name: 'Body', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={18}/>, color: 'border-amber-500' },
    { name: 'Hands', keywords: ['glove'], icon: <Hand size={18}/>, color: 'border-orange-500' },
    { name: 'Foots', keywords: ['boot', 'shoe'], icon: <Footprints size={18}/>, color: 'border-indigo-500' },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={18}/>, color: 'border-slate-500' }
  ]

  const groupedInventory = useMemo(() => {
    const groups = {}
    inventory.forEach(item => {
      const name = item.item_name || "Unknown Item"
      if (!groups[name]) groups[name] = { name, variants: [] }
      groups[name].variants.push(item)
    })
    return Object.values(groups)
  }, [inventory])

  const addToCart = (variant) => {
    setCart([...cart, { ...variant, cartId: Date.now() }])
  }

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans">
      <div className="bg-slate-900/95 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-5">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${hasFullAccess ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-blue-600'}`}>
              {hasFullAccess ? <ShieldCheck size={20}/> : user.full_name[0]}
            </div>
            <div>
              <h2 className="text-sm font-bold truncate max-w-[120px]">{user.full_name}</h2>
              <p className="text-[8px] text-blue-400 font-bold uppercase tracking-widest">{user.position}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400"><Settings size={20}/></button>
            <button onClick={() => setShowCart(true)} className="relative p-3 bg-blue-600 rounded-2xl border border-blue-400/30 text-white">
              <ShoppingCart size={20} />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950 animate-bounce">{cart.length}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {categories.map(cat => {
          const catItems = groupedInventory.filter(group => {
            const n = group.name.toLowerCase()
            return cat.name === 'Others' ? !categories.slice(0, 7).some(c => c.keywords.some(k => n.includes(k))) : cat.keywords.some(k => n.includes(k))
          })
          if (catItems.length === 0) return null
          const isCatOpen = expandedCat === cat.name

          return (
            <div key={cat.name} className={`rounded-3xl border-l-4 transition-all overflow-hidden ${cat.color} ${isCatOpen ? 'bg-white/[0.03] mb-4' : 'bg-white/5'}`}>
              <button onClick={() => setExpandedCat(isCatOpen ? null : cat.name)} className="w-full p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${isCatOpen ? 'bg-white/10 text-white' : 'text-slate-400'}`}>{cat.icon}</div>
                  <span className="text-[12px] font-black uppercase tracking-widest">{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} className="text-slate-600" />}
              </button>

              {isCatOpen && (
                <div className="px-4 pb-4 space-y-3 animate-in fade-in duration-300">
                  {catItems.map((group) => {
                    const isItemOpen = expandedItem === group.name
                    const lowerName = group.name.toLowerCase()
                    const isStrict = lowerName.includes('suit') || (lowerName.includes('safety boot') && !lowerName.includes('rubber'))

                    return (
                      <div key={group.name} className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-inner">
                        <button onClick={() => setExpandedItem(isItemOpen ? null : group.name)} className="w-full p-4 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300 uppercase">{group.name}</span>
                          <ChevronDown size={14} className={`text-slate-600 transition-transform ${isItemOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isItemOpen && (
                          <div className="px-3 pb-3 space-y-2">
                            {group.variants.map((variant, vIdx) => {
                              const stock = variant.stock ?? variant.Quantity ?? 0
                              const vSize = String(variant.size ?? variant.Size ?? "STD").trim()
                              const vColor = String(variant.color ?? variant.Color ?? "").trim()
                              
                              // Check Selection Limit
                              const isMySize = isStrict ? 
                                (lowerName.includes('suit') ? (vColor === user.suit_color && vSize === user.suit_size) : (vSize === user.boot_size)) 
                                : true

                              // Admin sees all for stock check, Regular only sees their size
                              if (!isMySize && !hasFullAccess) return null

                              return (
                                <div key={vIdx} className={`flex items-center justify-between p-3 rounded-xl border ${isMySize ? 'bg-blue-600/10 border-blue-500/30' : 'bg-black/20 border-white/5 opacity-60'}`}>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black uppercase">{vColor} {vSize}</span>
                                      {isMySize && <span className="bg-blue-500 text-[8px] px-1.5 py-0.5 rounded-md font-bold">MY SIZE</span>}
                                    </div>
                                    {hasFullAccess && <span className="text-[9px] text-amber-500 font-black mt-0.5">STOCK: {stock}</span>}
                                  </div>
                                  
                                  {isMySize ? (
                                    <button onClick={() => addToCart(variant)} className="p-2.5 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20 active:scale-90 transition-transform">
                                      <Plus size={14}/>
                                    </button>
                                  ) : (
                                    <div className="p-2.5 text-slate-600"><Lock size={14}/></div>
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

      {/* Settings Modal (No change in Logic, just UI refinement) */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-950/90 z-[70] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-md rounded-[32px] border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-black uppercase text-sm text-blue-500">System Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-2"><X/></button>
            </div>
            <div className="p-8 space-y-6">
              {['suit', 'boot'].map(type => (
                <div key={type} className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{type === 'suit' ? 'Boiler Suit' : 'Safety Boots'} Chart</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, type)} className="hidden" id={`${type}-up`}/>
                  <label htmlFor={`${type}-up`} className="w-full flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/10 rounded-3xl cursor-pointer hover:border-blue-500 transition-all bg-black/20">
                    <Upload className="text-slate-500 mb-2" size={24}/>
                    <span className="text-[10px] font-black text-slate-500">UPLOAD SYNC CHART</span>
                  </label>
                </div>
              ))}
              <button onClick={() => setShowSettings(false)} className="w-full py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer - Logic unchanged */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in slide-in-from-bottom duration-500">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <ShoppingCart size={20} className="text-blue-500" />
              <h3 className="text-sm font-black uppercase tracking-widest">My Cart</h3>
            </div>
            <button onClick={() => setShowCart(false)} className="p-3 bg-white/5 rounded-2xl"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20"><Package size={64}/><p className="text-[10px] font-black mt-4 uppercase tracking-widest">No Items Selected</p></div>
            ) : cart.map((item) => (
              <div key={item.cartId} className="bg-white/5 p-5 rounded-[24px] flex justify-between items-center border border-white/10">
                <div>
                  <p className="text-xs font-black uppercase">{item.item_name}</p>
                  <p className="text-[10px] text-blue-400 font-bold uppercase mt-1">{item.color} {item.size}</p>
                </div>
                <button onClick={() => setCart(cart.filter(i => i.cartId !== item.cartId))} className="p-3 bg-red-500/10 text-red-500 rounded-xl"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-white/10 bg-slate-900/50">
            <button disabled={cart.length === 0 || loading} onClick={handleCheckout} className="w-full py-6 bg-blue-600 rounded-[24px] font-black uppercase tracking-widest shadow-2xl shadow-blue-600/40 disabled:opacity-20 transition-all active:scale-95">
              {loading ? 'Processing...' : `Confirm Request (${cart.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
