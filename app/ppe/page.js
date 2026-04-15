'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, 
  HardHat, Headphones, Eye, Wind, Shirt, Hand, 
  Footprints, MoreHorizontal, X, Package, ShieldAlert, ShieldCheck
} from 'lucide-react'

export default function PPEPage() {
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [history, setHistory] = useState([])
  const [expandedCat, setExpandedCat] = useState(null)
  const [expandedItem, setExpandedItem] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // กำหนดตำแหน่งที่มีสิทธิ์เห็น Stock
  const FULL_ACCESS_POSITIONS = ['Safety Officer', 'Chief Officer', 'Barge Master']
  const hasFullAccess = user ? FULL_ACCESS_POSITIONS.includes(user.position) : false

  useEffect(() => {
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const u = JSON.parse(cachedUser)
    setUser(u)

    async function fetchData() {
      // ดึงสต็อก
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      
      // ดึงประวัติการเบิกของปีนี้ (เพื่อคำนวณ Limit)
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

  // คำนวณลิมิตให้แม่นยำขึ้น
  const getLimitStatus = (itemName) => {
    const lowerName = itemName.toLowerCase()
    // รวมรายการใน Cart และ History เพื่อเช็ค Limit แบบ Real-time
    const inCartCount = cart.filter(c => c.item_name.toLowerCase().includes(lowerName)).length
    const inHistoryCount = history.filter(h => h.item_name.toLowerCase().includes(lowerName)).length
    const totalCount = inCartCount + inHistoryCount

    if (lowerName.includes('suit') && totalCount >= 2) return { reached: true, msg: 'เบิกได้สูงสุด 2 ชุด/ปี' }
    if (lowerName.includes('boot') && totalCount >= 1) return { reached: true, msg: 'เบิกได้สูงสุด 1 คู่/ปี' }
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

  const handleCheckout = async () => {
    setLoading(true)
    
    // กรองเอาเฉพาะคอลัมน์ที่มีชัวร์ๆ กันพังเรื่อง color
    const reqs = cart.map(i => {
      const payload = {
        crew_id: user.id,
        item_name: i.item_name,
        size: i.size || i.Size || i.item_size || null,
        status: 'pending',
        request_date: new Date().toISOString()
      }
      // ถ้าในเครื่องมี i.color ให้ลองส่งไป (ถ้า error ตรงนี้ให้เช็ค Supabase)
      if (i.color || i.Color) payload.color = i.color || i.Color
      return payload
    })

    const { error } = await supabase.from('ppe_requests').insert(reqs)
    
    if (!error) {
      alert('บันทึกคำขอเบิกเรียบร้อยแล้ว'); 
      setCart([]); 
      setShowCart(false);
      window.location.reload(); 
    } else {
      console.error("Insert Error:", error)
      alert('เกิดข้อผิดพลาด: ' + error.message + '\n(โปรดตรวจสอบว่าตาราง ppe_requests มีคอลัมน์ color หรือยัง)')
    }
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans">
      {/* Navbar */}
      <div className="bg-slate-900/95 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-5">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-lg ${hasFullAccess ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
              {hasFullAccess ? <ShieldCheck size={20}/> : user.full_name[0]}
            </div>
            <div>
              <h2 className="text-sm font-bold truncate max-w-[150px]">{user.full_name}</h2>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-1">
                {user.position} {hasFullAccess && <span className="text-amber-500 text-[7px] border border-amber-500/30 px-1 rounded">ADMIN</span>}
              </p>
            </div>
          </div>
          <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10">
            <ShoppingCart size={20} className="text-blue-400" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">{cart.length}</span>}
          </button>
        </div>
      </div>

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
              <button 
                onClick={() => setExpandedCat(isCatOpen ? null : cat.name)}
                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${isCatOpen ? 'bg-blue-600 shadow-xl' : 'bg-white/5 border border-white/10'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`${isCatOpen ? 'text-white' : 'text-blue-500'}`}>{cat.icon}</div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={16}/> : <ChevronDown size={16} className="text-slate-600"/>}
              </button>

              {isCatOpen && (
                <div className="space-y-2 pt-1 animate-in slide-in-from-top-2">
                  {catItems.map((group) => {
                    const isItemOpen = expandedItem === group.name
                    const limit = getLimitStatus(group.name)

                    return (
                      <div key={group.name} className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                        <button 
                          onClick={() => setExpandedItem(isItemOpen ? null : group.name)}
                          className="w-full p-4 flex items-center justify-between hover:bg-white/5"
                        >
                          <div className="flex flex-col items-start text-left">
                            <span className="text-xs font-bold">{group.name}</span>
                            {limit.reached && <span className="text-[8px] text-red-500 font-black uppercase flex items-center gap-1 mt-1"><ShieldAlert size={10}/> {limit.msg}</span>}
                          </div>
                          <ChevronDown size={14} className={`text-slate-600 transition-transform ${isItemOpen ? 'rotate-180' : ''}`}/>
                        </button>

                        {isItemOpen && (
                          <div className="px-4 pb-4 space-y-2 bg-black/20">
                            {group.variants.map((variant, vIdx) => {
                              const stock = variant.stock ?? variant.Quantity ?? variant.quantity ?? variant.qty ?? 0
                              const isOutOfStock = stock <= 0
                              
                              const variantSize = variant.size ?? variant.Size ?? variant.item_size
                              const variantColor = variant.color ?? variant.Color ?? variant.item_color

                              const isSuit = group.name.toLowerCase().includes('suit')
                              const isBoot = group.name.toLowerCase().includes('boot')
                              
                              // Logic ล็อกโปรไฟล์
                              const isLocked = (isSuit && (variantColor !== user.suit_color || variantSize !== user.suit_size)) ||
                                               (isBoot && variantSize !== user.boot_size)

                              if (isLocked) return null

                              return (
                                <div key={vIdx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-bold">
                                      {variantColor && variantSize ? `${variantColor} - ${variantSize}` : (variantColor || variantSize || 'Standard')}
                                    </span>
                                    {/* 4. แสดงสต็อกเฉพาะ Admin */}
                                    {hasFullAccess ? (
                                      <span className={`text-[9px] font-black uppercase ${isOutOfStock ? 'text-red-500' : 'text-amber-500'}`}>
                                        Stock: {stock}
                                      </span>
                                    ) : (
                                      <span className={`text-[9px] font-black uppercase ${isOutOfStock ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {isOutOfStock ? 'สินค้าหมด' : 'มีสินค้า'}
                                      </span>
                                    )}
                                  </div>
                                  <button 
                                    disabled={isOutOfStock || limit.reached}
                                    onClick={() => addToCart(variant)}
                                    className="p-2 bg-blue-600 rounded-lg disabled:opacity-10"
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

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-in slide-in-from-bottom">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900">
            <h3 className="text-sm font-black uppercase tracking-widest text-blue-500">Cart Review</h3>
            <button onClick={() => setShowCart(false)} className="p-2 bg-white/10 rounded-full"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map((item) => (
              <div key={item.cartId} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                <div>
                  <p className="text-xs font-bold">{item.item_name}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">
                    {(item.color || item.Color) && `${item.color || item.Color} | `}
                    {item.size || item.Size || item.item_size}
                  </p>
                </div>
                <button onClick={() => setCart(cart.filter(i => i.cartId !== item.cartId))} className="p-2 hover:bg-red-500/10 rounded-xl transition-colors">
                  <Trash2 size={18} className="text-red-500/60"/>
                </button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-white/10 bg-slate-900/50">
            <button disabled={cart.length === 0 || loading} onClick={handleCheckout} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest active:scale-95">
              {loading ? 'Processing...' : `Confirm Request (${cart.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
