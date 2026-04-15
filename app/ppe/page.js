'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, Settings,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, Image as ImageIcon,
  Footprints, MoreHorizontal, X, Package, ShieldAlert, ShieldCheck, Save
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
  
  // Settings State สำหรับรูป Size Chart
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })

  const FULL_ACCESS_POSITIONS = ['Safety Officer', 'Chief Officer', 'Barge Master']
  const hasFullAccess = user ? FULL_ACCESS_POSITIONS.includes(user.position) : false

  useEffect(() => {
    setMounted(true)
    const cachedUser = localStorage.getItem('kmt_user')
    const savedCharts = localStorage.getItem('kmt_size_charts')
    
    if (!cachedUser) {
      router.push('/login')
      return
    }
    
    const u = JSON.parse(cachedUser)
    setUser(u)
    if (savedCharts) setSizeCharts(JSON.parse(savedCharts))

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
      const { data: reqs } = await supabase
        .from('ppe_requests')
        .select('*')
        .eq('crew_id', u.id)
        .gte('request_date', startOfYear)
      if (reqs) setHistory(reqs)
    }
    fetchData()
  }, [router])

  const categories = [
    { name: 'Head', keywords: ['helmet', 'hat'], icon: <HardHat size={18}/> },
    { name: 'Ears', keywords: ['ear'], icon: <Headphones size={18}/> },
    { name: 'Eyes', keywords: ['glass', 'goggle'], icon: <Eye size={18}/> },
    { name: 'Respiratory', keywords: ['mask', 'respirator'], icon: <Wind size={18}/> },
    { name: 'Body', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={18}/> },
    { name: 'Hands', keywords: ['glove'], icon: <Hand size={18}/> },
    { name: 'Foots', keywords: ['boot', 'shoe'], icon: <Footprints size={18}/> },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={18}/> }
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

  // คำนวณ Limit แบบเข้มงวด (History + Cart)
  const getLimitStatus = (itemName) => {
    const lowerName = itemName.toLowerCase()
    const inCartCount = cart.filter(c => c.item_name.toLowerCase().includes(lowerName)).length
    const inHistoryCount = history.filter(h => h.item_name.toLowerCase().includes(lowerName)).length
    const totalCount = inCartCount + inHistoryCount

    if (lowerName.includes('suit') && totalCount >= 2) return { reached: true, msg: 'Limit: 2 ชุด/ปี' }
    if (lowerName.includes('safety boot') && totalCount >= 1) return { reached: true, msg: 'Limit: 1 คู่/ปี' }
    return { reached: false }
  }

  const addToCart = (variant) => {
    const limit = getLimitStatus(variant.item_name)
    if (limit.reached) {
      alert(limit.msg)
      return
    }
    setCart([...cart, { ...variant, cartId: Date.now() }])
  }

  const handleSaveSettings = () => {
    localStorage.setItem('kmt_size_charts', JSON.stringify(sizeCharts))
    setShowSettings(false)
    alert('Settings Saved!')
  }

  const handleCheckout = async () => {
    setLoading(true)
    const reqs = cart.map(i => ({
      crew_id: user.id,
      item_name: i.item_name,
      size: i.size || i.Size || i.item_size || 'N/A',
      color: i.color || i.Color || null,
      status: 'pending',
      request_date: new Date().toISOString()
    }))
    
    const { error } = await supabase.from('ppe_requests').insert(reqs)
    if (!error) {
      alert('บันทึกคำขอเบิกเรียบร้อยแล้ว')
      setCart([])
      setShowCart(false)
      window.location.reload()
    } else {
      alert('Error: ' + error.message)
    }
    setLoading(false)
  }

  // ป้องกัน Prerender Error
  if (!mounted || !user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-xs font-black uppercase tracking-widest">Loading System...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans">
      {/* Navbar */}
      <div className="bg-slate-900/95 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-5">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-lg ${hasFullAccess ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
              {hasFullAccess ? <ShieldCheck size={20}/> : user.full_name[0]}
            </div>
            <div className="leading-tight">
              <h2 className="text-sm font-bold truncate max-w-[120px]">{user.full_name}</h2>
              <p className="text-[8px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-1">
                {user.position} {hasFullAccess && <span className="text-amber-500 text-[7px] border border-amber-500/30 px-1 rounded">ADMIN</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 hover:bg-white/10 transition-colors">
              <Settings size={20}/>
            </button>
            <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10 text-blue-400">
              <ShoppingCart size={20} />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">{cart.length}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-md mx-auto p-6 space-y-4">
        {categories.map(cat => {
          const catItems = groupedInventory.filter(group => {
            const n = group.name.toLowerCase()
            return cat.name === 'Others' ? 
              !categories.slice(0, 7).some(c => c.keywords.some(k => n.includes(k))) : 
              cat.keywords.some(k => n.includes(k))
          })
          if (catItems.length === 0) return null
          const isCatOpen = expandedCat === cat.name

          return (
            <div key={cat.name} className="space-y-2">
              <button onClick={() => setExpandedCat(isCatOpen ? null : cat.name)} className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${isCatOpen ? 'bg-blue-600 shadow-xl shadow-blue-600/20' : 'bg-white/5 border border-white/10'}`}>
                <div className="flex items-center gap-3">
                  <div className={`${isCatOpen ? 'text-white' : 'text-blue-500'}`}>{cat.icon}</div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={16}/> : <ChevronDown size={16} className="text-slate-600"/>}
              </button>

              {isCatOpen && (
                <div className="space-y-2 pt-1 animate-in slide-in-from-top-2 duration-300">
                  {catItems.map((group) => {
                    const isItemOpen = expandedItem === group.name
                    const limit = getLimitStatus(group.name)
                    const lowerName = group.name.toLowerCase()
                    const isBoilerSuit = lowerName.includes('suit')
                    const isSafetyBoot = lowerName.includes('safety boot') // ล็อกเฉพาะเซฟตี้
                    
                    return (
                      <div key={group.name} className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                        <button onClick={() => setExpandedItem(isItemOpen ? null : group.name)} className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                          <div className="flex flex-col items-start text-left">
                            <span className="text-xs font-bold">{group.name}</span>
                            {limit.reached && <span className="text-[8px] text-red-500 font-black uppercase flex items-center gap-1 mt-1"><ShieldAlert size={10}/> {limit.msg}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            {(isBoilerSuit && sizeCharts.suit || isSafetyBoot && sizeCharts.boot) && (
                               <a href={isBoilerSuit ? sizeCharts.suit : sizeCharts.boot} target="_blank" className="p-1.5 bg-white/10 rounded-lg text-blue-400" onClick={(e) => e.stopPropagation()}><ImageIcon size={14}/></a>
                            )}
                            <ChevronDown size={14} className={`text-slate-600 transition-transform ${isItemOpen ? 'rotate-180' : ''}`}/>
                          </div>
                        </button>

                        {isItemOpen && (
                          <div className="px-4 pb-4 space-y-2 bg-black/20">
                            {group.variants.map((variant, vIdx) => {
                              const stock = variant.stock ?? variant.Quantity ?? variant.quantity ?? 0
                              const isOutOfStock = stock <= 0
                              
                              // แก้ไขเรื่อง Rubber Boots: ดึงค่าไซส์มาแสดงแน่นอน
                              const vSize = String(variant.size ?? variant.Size ?? variant.item_size ?? "Standard").trim()
                              const vColor = String(variant.color ?? variant.Color ?? variant.item_color ?? "").trim()

                              // Logic ล็อกโปรไฟล์: Rubber Boots (ถ้าชื่อไม่มี 'safety boot') จะไม่โดนล็อก
                              const isLocked = (isBoilerSuit && (vColor !== user.suit_color || vSize !== user.suit_size)) ||
                                               (isSafetyBoot && vSize !== user.boot_size)

                              if (isLocked) return null

                              return (
                                <div key={vIdx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-bold">
                                      {vColor && vSize !== 'Standard' ? `${vColor} - ${vSize}` : (vColor || vSize)}
                                    </span>
                                    {hasFullAccess ? (
                                      <span className={`text-[9px] font-black uppercase ${isOutOfStock ? 'text-red-500' : 'text-amber-500'}`}>Stock: {stock}</span>
                                    ) : (
                                      <span className={`text-[9px] font-black uppercase ${isOutOfStock ? 'text-red-500' : 'text-emerald-500'}`}>{isOutOfStock ? 'OUT OF STOCK' : 'AVAILABLE'}</span>
                                    )}
                                  </div>
                                  <button 
                                    disabled={isOutOfStock || limit.reached}
                                    onClick={() => addToCart(variant)}
                                    className="p-2 bg-blue-600 rounded-lg disabled:opacity-10 active:scale-90 transition-all"
                                  >
                                    <Plus size={14}/>
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
              )}
            </div>
          )
        })}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-950/90 z-[70] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="font-black uppercase text-sm tracking-widest text-blue-500">System Settings</h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase">จัดการตารางไซส์อุปกรณ์</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full"><X/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Boiler Suit Size Chart (Image URL)</label>
                <input className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-xs focus:border-blue-500 outline-none transition-all" placeholder="https://image-link.com/suit.jpg" value={sizeCharts.suit} onChange={(e) => setSizeCharts({...sizeCharts, suit: e.target.value})}/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Safety Boots Size Chart (Image URL)</label>
                <input className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-xs focus:border-blue-500 outline-none transition-all" placeholder="https://image-link.com/boots.jpg" value={sizeCharts.boot} onChange={(e) => setSizeCharts({...sizeCharts, boot: e.target.value})}/>
              </div>
              <button onClick={handleSaveSettings} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"><Save size={18}/> Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900">
            <h3 className="text-sm font-black uppercase tracking-widest text-blue-500">Cart Review</h3>
            <button onClick={() => setShowCart(false)} className="p-2 bg-white/10 rounded-full"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <Package size={64}/><p className="text-xs font-bold mt-4 uppercase">Cart is empty</p>
              </div>
            ) : cart.map((item) => (
              <div key={item.cartId} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                <div>
                  <p className="text-xs font-bold">{item.item_name}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{(item.color || item.Color) && `${item.color || item.Color} | `}{item.size || item.Size || item.item_size}</p>
                </div>
                <button onClick={() => setCart(cart.filter(i => i.cartId !== item.cartId))} className="p-2 hover:bg-red-500/10 rounded-xl transition-colors"><Trash2 size={18} className="text-red-500/60"/></button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-white/10 bg-slate-900/50 backdrop-blur-md">
            <button disabled={cart.length === 0 || loading} onClick={handleCheckout} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-20">
              {loading ? 'Processing...' : `Confirm Request (${cart.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
