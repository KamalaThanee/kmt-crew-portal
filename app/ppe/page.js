'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, Settings,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, 
  Footprints, MoreHorizontal, X, Package, ShieldCheck, 
  Upload, Loader2, Lock, AlertTriangle, Calendar, CheckCircle2
} from 'lucide-react'

export default function PPEPage() {
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

    // 🎯 ตรวจสอบพารามิเตอร์จาก URL ว่าต้องเปิด Setting เลยไหม
    if (searchParams.get('settings') === 'true') {
      setShowSettings(true)
      // เคลียร์ URL ให้สะอาด
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

  const sizeOrder = { 's': 1, 'm': 2, 'l': 3, 'xl': 4, '2xl': 5, '3xl': 6, '4xl': 7, 'std': 8 }
  const sortVariants = (variants) => {
    return variants.sort((a, b) => {
      const cA = String(a.color || a.Color || '').toLowerCase()
      const cB = String(b.color || b.Color || '').toLowerCase()
      if (cA !== cB) return cA.localeCompare(cB)
      const sA = String(a.size || a.Size || '').toLowerCase()
      const sB = String(b.size || b.Size || '').toLowerCase()
      const numA = sizeOrder[sA] || 99
      const numB = sizeOrder[sB] || 99
      if (numA !== numB) return numA - numB
      return sA.localeCompare(sB)
    })
  }

  const groupedInventory = useMemo(() => {
    const groups = {}
    inventory.forEach(item => {
      const name = item.item_name || "Unknown Item"
      if (!groups[name]) groups[name] = { name, variants: [] }
      groups[name].variants.push(item)
    })
    Object.values(groups).forEach(g => { g.variants = sortVariants(g.variants) })
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

  const addToCart = (variant) => {
    const lowerName = variant.item_name.toLowerCase()
    const isSuit = lowerName.includes('suit')
    const isBoot = lowerName.includes('safety boot') && !lowerName.includes('rubber')
    const vSize = String(variant.size ?? variant.Size ?? "STD").trim()
    const vColor = String(variant.color ?? variant.Color ?? "").trim()
    const stock = Number(variant.quantity || variant.Quantity || variant.stock || variant.Stock || 0)
    const inCartOfThisVariant = cart.filter(i => i.item_name === variant.item_name && i.size === vSize && i.color === vColor).length
    if (inCartOfThisVariant >= stock) { alert(`ไม่สามารถเบิกเกินจำนวน Stock ที่มีได้ (เหลือ ${stock})`); return; }
    if (isSuit) {
      const inCartSuits = cart.filter(item => item.item_name.toLowerCase().includes('suit')).length
      if (quotas.suit + inCartSuits >= 2) { alert('โควตา Boiler Suit ของปีนี้เต็มแล้ว (สูงสุด 2 ชุด/ปี)'); return; }
    }
    if (isBoot) {
      const inCartBoots = cart.filter(item => item.item_name.toLowerCase().includes('safety boot') && !item.item_name.toLowerCase().includes('rubber')).length
      if (quotas.boot + inCartBoots >= 1) { alert('โควตา Safety Boots ของปีนี้เต็มแล้ว (สูงสุด 1 คู่/ปี)'); return; }
    }
    setCart([...cart, { ...variant, size: vSize, color: vColor, cartId: Date.now() }])
  }

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
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans pt-12 md:pt-16">
      <div className="max-w-md mx-auto p-4 space-y-4 pt-10">
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
                <div className="px-4 pb-6 space-y-4">
                  {catItems.map((group) => {
                    const isItemOpen = expandedItem === group.name
                    const lowerName = group.name.toLowerCase()
                    const isSuit = lowerName.includes('suit')
                    const isBoot = lowerName.includes('safety boot') && !lowerName.includes('rubber')
                    const isStrict = isSuit || isBoot
                    return (
                      <div key={group.name} className="bg-slate-800 rounded-2xl overflow-hidden border border-white/10">
                        <button onClick={() => setExpandedItem(isItemOpen ? null : group.name)} className="w-full p-4 flex items-center justify-between gap-2 text-left">
                          <span className="text-[12px] font-black text-blue-300 uppercase leading-tight">{group.name}</span>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform shrink-0 ${isItemOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isItemOpen && (
                          <div className="p-3 space-y-2 bg-slate-900/50">
                            {group.variants.map((variant, vIdx) => {
                              const stock = Number(variant.quantity || variant.Quantity || variant.stock || variant.Stock || 0)
                              const vSize = String(variant.size ?? variant.Size ?? "STD").trim()
                              const vColor = String(variant.color ?? variant.Color ?? "").trim()
                              const inCartOfThisVariant = cart.filter(i => i.item_name === group.name && i.size === vSize && i.color === vColor).length
                              const availableStock = stock - inCartOfThisVariant
                              const isMySize = isStrict ? (isSuit ? (vColor === user.suit_color && vSize === user.suit_size) : (vSize === user.boot_size)) : true
                              const inCartSuits = cart.filter(item => item.item_name.toLowerCase().includes('suit')).length
                              const inCartBoots = cart.filter(item => item.item_name.toLowerCase().includes('safety boot') && !item.item_name.toLowerCase().includes('rubber')).length
                              const isQuotaFull = (isSuit && (quotas.suit + inCartSuits) >= 2) || (isBoot && (quotas.boot + inCartBoots) >= 1)
                              const isOutOfStock = availableStock <= 0
                              if (!isMySize && !hasFullAccess) return null
                              return (
                                <div key={vIdx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isMySize ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 bg-black/20 opacity-60'}`}>
                                  <div className="flex items-center gap-3">
                                    {vColor && hasFullAccess && <div className={`w-3 h-3 rounded-full ${getColorHex(vColor)}`}></div>}
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[11px] font-black uppercase ${!hasFullAccess && vColor ? getColorHex(vColor).replace('bg-', 'text-') : ''}`}>{vColor} {vSize}</span>
                                        {(isStrict && isMySize) && <span className="bg-blue-600 text-[7px] px-2 py-0.5 rounded-md font-black text-white uppercase">MY SIZE</span>}
                                      </div>
                                      <div className="flex flex-col gap-0.5">
                                        {isOutOfStock ? (
                                          <span className="text-[10px] text-red-500 font-black flex items-center gap-1 uppercase"><AlertTriangle size={10}/> Out of Stock</span>
                                        ) : (
                                          <>
                                            {isStrict && isQuotaFull && <span className="text-[9px] text-amber-500 font-black flex items-center gap-1 uppercase"><Calendar size={10}/> Yearly Quota Full</span>}
                                            {hasFullAccess && <span className="text-[10px] text-slate-400 font-black">STOCK: {availableStock} {inCartOfThisVariant > 0 && <span className="text-blue-400">(-{inCartOfThisVariant})</span>}</span>}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {isMySize && !isOutOfStock && (!isStrict || !isQuotaFull) ? (
                                    <button onClick={() => addToCart(variant)} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"><Plus size={18}/></button>
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

      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900 mt-16 md:mt-0">
            <h3 className="text-sm font-black uppercase text-blue-500 tracking-widest">My Selection</h3>
            <button onClick={() => setShowCart(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20"><Package size={64}/><p className="text-[10px] font-black mt-4 uppercase">No Items Selected</p></div>
            ) : cart.map((item) => (
              <div key={item.cartId} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                <div><p className="text-xs font-black uppercase">{item.item_name}</p><p className="text-[10px] text-blue-400 font-bold uppercase">{item.color} {item.size}</p></div>
                <button onClick={() => setCart(cart.filter(i => i.cartId !== item.cartId))} className="p-2 text-red-500 hover:text-red-400 transition-colors"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-white/10 bg-slate-900/50 pb-safe">
            <button disabled={cart.length === 0 || loading} onClick={async () => {
              setLoading(true);
              const { error } = await supabase.from('ppe_requests').insert(cart.map(i => ({ 
                crew_id: user.id, 
                item_name: i.item_name, 
                size: i.size, 
                color: i.color, 
                status: 'pending', 
                request_date: new Date().toISOString() 
              })));
              if (!error) { alert('Request Sent!'); setCart([]); setShowCart(false); window.location.reload(); }
              setLoading(false);
            }} className="w-full py-5 bg-blue-600 rounded-3xl font-black uppercase shadow-2xl active:scale-95 transition-all">
              {loading ? 'Processing...' : `Confirm Request (${cart.length})`}
            </button>
          </div>
        </div>
      )}

      {showSettings && hasFullAccess && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-md rounded-[40px] border border-white/10 p-8 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center"><h3 className="font-black uppercase text-sm text-blue-500 tracking-widest">System Settings</h3><button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full"><X/></button></div>
            <div className="space-y-4">
              {['suit', 'boot'].map(type => {
                const isUploaded = !!sizeCharts[type]
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{type} chart image</label>
                      {isUploaded && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black flex items-center gap-1 uppercase tracking-wider"><CheckCircle2 size={10}/> Uploaded</span>}
                    </div>
                    <input type="file" onChange={async (e) => {
                      const file = e.target.files[0]; if (!file) return;
                      setUploading(prev => ({ ...prev, [type]: true }));
                      const fileName = `${type}_${Date.now()}.${file.name.split('.').pop()}`;
                      await supabase.storage.from('ppe_assets').upload(`charts/${fileName}`, file);
                      const { data: { publicUrl } } = supabase.storage.from('ppe_assets').getPublicUrl(`charts/${fileName}`);
                      await supabase.from('ppe_settings').update({ [type === 'suit' ? 'suit_chart_url' : 'boot_url']: publicUrl }).eq('id', 1);
                      setSizeCharts(prev => ({ ...prev, [type]: publicUrl }))
                      setUploading(prev => ({ ...prev, [type]: false }));
                    }} className="hidden" id={type}/>
                    <label htmlFor={type} className={`w-full h-16 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${isUploaded ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500' : 'border-white/10 hover:border-blue-500'}`}>
                      {uploading[type] ? <Loader2 className="animate-spin text-blue-500" size={20}/> : (
                        <>
                          <Upload className={isUploaded ? "text-emerald-500 mb-1" : "text-slate-600 mb-1"} size={16}/>
                          <span className={`text-[9px] font-black uppercase tracking-wider ${isUploaded ? 'text-emerald-500' : 'text-slate-500'}`}>{isUploaded ? 'Update File' : 'Click to Upload'}</span>
                        </>
                      )}
                    </label>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl font-black uppercase text-[10px] tracking-[0.2em]">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
