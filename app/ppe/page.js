'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, Settings,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, 
  Footprints, MoreHorizontal, X, Package, ShieldCheck, 
  Upload, Loader2, Lock, AlertTriangle
} from 'lucide-react'

export default function PPEPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [expandedCat, setExpandedCat] = useState(null)
  const [expandedItem, setExpandedItem] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })

  const ADMIN_ROLES = ['Safety Officer', 'Chief Officer', 'Barge Master']
  const hasFullAccess = useMemo(() => {
    if (!user?.position) return false
    return ADMIN_ROLES.some(pos => pos.toLowerCase() === user.position.toLowerCase())
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
    { name: 'Head', keywords: ['helmet', 'hat'], icon: <HardHat size={20}/>, color: 'border-blue-500' },
    { name: 'Ears', keywords: ['ear'], icon: <Headphones size={20}/>, color: 'border-purple-500' },
    { name: 'Eyes', keywords: ['glass', 'goggle'], icon: <Eye size={20}/>, color: 'border-cyan-500' },
    { name: 'Respiratory', keywords: ['mask', 'respirator'], icon: <Wind size={20}/>, color: 'border-emerald-500' },
    { name: 'Body', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={20}/>, color: 'border-amber-500' },
    { name: 'Hands', keywords: ['glove'], icon: <Hand size={20}/>, color: 'border-orange-500' },
    { name: 'Foots', keywords: ['boot', 'shoe'], icon: <Footprints size={20}/>, color: 'border-indigo-500' },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={20}/>, color: 'border-slate-500' }
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
    const lowerName = variant.item_name.toLowerCase()
    const isSuit = lowerName.includes('suit')
    const isBoot = lowerName.includes('safety boot') && !lowerName.includes('rubber')

    if (isSuit && cart.some(item => item.item_name.toLowerCase().includes('suit'))) {
      alert('จำกัดการเบิก Boiler Suit 1 ชุดต่อครั้งเท่านั้น'); return;
    }
    if (isBoot && cart.some(item => item.item_name.toLowerCase().includes('safety boot') && !item.item_name.toLowerCase().includes('rubber'))) {
      alert('จำกัดการเบิก Safety Boots 1 คู่ต่อครั้งเท่านั้น'); return;
    }
    setCart([...cart, { ...variant, cartId: Date.now() }])
  }

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans">
      <div className="bg-slate-900/95 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-5">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${hasFullAccess ? 'bg-amber-500' : 'bg-blue-600'}`}>
              {hasFullAccess ? <ShieldCheck size={20}/> : user.full_name[0]}
            </div>
            <div><h2 className="text-sm font-bold truncate max-w-[120px]">{user.full_name}</h2><p className="text-[8px] text-blue-400 font-bold uppercase tracking-widest">{user.position}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400"><Settings size={20}/></button>
            <button onClick={() => setShowCart(true)} className="relative p-3 bg-blue-600 rounded-2xl text-white">
              <ShoppingCart size={20} />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">{cart.length}</span>}
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
            <div key={cat.name} className={`rounded-[28px] border-2 transition-all shadow-2xl ${isCatOpen ? `${cat.color} bg-black mb-6` : 'border-white/5 bg-slate-900'}`}>
              {/* Layer 1: Category - Increased Contrast */}
              <button onClick={() => setExpandedCat(isCatOpen ? null : cat.name)} className="w-full p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isCatOpen ? 'bg-blue-600 text-white' : 'bg-black text-slate-400 border border-white/5'}`}>{cat.icon}</div>
                  <span className={`text-base font-black uppercase tracking-tighter ${isCatOpen ? 'text-white' : 'text-slate-100'}`}>{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} className="text-slate-500" />}
              </button>

              {isCatOpen && (
                <div className="px-4 pb-6 space-y-4 animate-in slide-in-from-top-2">
                  {catItems.map((group) => {
                    const isItemOpen = expandedItem === group.name
                    const lowerName = group.name.toLowerCase()
                    const isStrict = lowerName.includes('suit') || (lowerName.includes('safety boot') && !lowerName.includes('rubber'))

                    return (
                      /* Layer 2: Item Name (Sub-category) - Slate 800 for depth */
                      <div key={group.name} className="bg-slate-800 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                        <button onClick={() => setExpandedItem(isItemOpen ? null : group.name)} className={`w-full p-4 flex items-center justify-between ${isItemOpen ? 'bg-black/20' : ''}`}>
                          <span className="text-[12px] font-black text-blue-300 uppercase">{group.name}</span>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform ${isItemOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isItemOpen && (
                          /* Layer 3: Variants - Simple Dark background */
                          <div className="p-3 space-y-2 bg-slate-900/50">
                            {group.variants.map((variant, vIdx) => {
                              // FIX: Map multiple possible column names for stock
                              const stock = Number(variant.quantity || variant.Quantity || variant.stock || variant.Stock || 0)
                              const vSize = String(variant.size ?? variant.Size ?? "STD").trim()
                              const vColor = String(variant.color ?? variant.Color ?? "").trim()
                              
                              const isMySize = isStrict ? 
                                (lowerName.includes('suit') ? (vColor === user.suit_color && vSize === user.suit_size) : (vSize === user.boot_size)) 
                                : true

                              if (!isMySize && !hasFullAccess) return null
                              const isOutOfStock = stock <= 0

                              return (
                                <div key={vIdx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isMySize ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 bg-black/20 opacity-60'}`}>
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-black uppercase">{vColor} {vSize}</span>
                                      {isMySize && <span className="bg-blue-600 text-[8px] px-2 py-0.5 rounded-md font-bold text-white">MY SIZE</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {isOutOfStock ? (
                                        <span className="text-[10px] text-red-500 font-black flex items-center gap-1 uppercase"><AlertTriangle size={12}/> Out of Stock</span>
                                      ) : (
                                        hasFullAccess && <span className="text-[10px] text-amber-500 font-black">STOCK: {stock}</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {isMySize && !isOutOfStock ? (
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

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in slide-in-from-bottom">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900">
            <h3 className="text-sm font-black uppercase text-blue-500">My Selection</h3>
            <button onClick={() => setShowCart(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20"><Package size={64}/><p className="text-[10px] font-black mt-4 uppercase">No Items</p></div>
            ) : cart.map((item) => (
              <div key={item.cartId} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                <div><p className="text-xs font-black uppercase">{item.item_name}</p><p className="text-[10px] text-blue-400 font-bold uppercase">{item.color} {item.size}</p></div>
                <button onClick={() => setCart(cart.filter(i => i.cartId !== item.cartId))} className="p-2 text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-white/10 bg-slate-900/50">
            <button disabled={cart.length === 0 || loading} onClick={async () => {
              setLoading(true);
              const { error } = await supabase.from('ppe_requests').insert(cart.map(i => ({ crew_id: user.id, item_name: i.item_name, size: i.size || i.Size || 'STD', color: i.color || i.Color || null, status: 'pending', request_date: new Date().toISOString() })));
              if (!error) { alert('Request Sent!'); setCart([]); setShowCart(false); window.location.reload(); }
              setLoading(false);
            }} className="w-full py-5 bg-blue-600 rounded-3xl font-black uppercase shadow-2xl">
              {loading ? 'Processing...' : `Confirm Request (${cart.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-950/90 z-[70] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-md rounded-[40px] border border-white/10 p-8 space-y-6">
            <div className="flex justify-between items-center"><h3 className="font-black uppercase text-sm text-blue-500">Charts Sync</h3><button onClick={() => setShowSettings(false)}><X/></button></div>
            {['suit', 'boot'].map(type => (
              <div key={type} className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase">{type} chart</label>
                <input type="file" onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  setUploading(prev => ({ ...prev, [type]: true }));
                  const fileName = `${type}_${Date.now()}.${file.name.split('.').pop()}`;
                  await supabase.storage.from('ppe_assets').upload(`charts/${fileName}`, file);
                  const { data: { publicUrl } } = supabase.storage.from('ppe_assets').getPublicUrl(`charts/${fileName}`);
                  await supabase.from('ppe_settings').update({ [type === 'suit' ? 'suit_chart_url' : 'boot_url']: publicUrl }).eq('id', 1);
                  setUploading(prev => ({ ...prev, [type]: false }));
                  alert('Sync Done');
                }} className="hidden" id={type}/>
                <label htmlFor={type} className="w-full h-24 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center cursor-pointer">
                  {uploading[type] ? <Loader2 className="animate-spin text-blue-500" /> : <Upload className="text-slate-600" />}
                </label>
              </div>
            ))}
            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px]">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
