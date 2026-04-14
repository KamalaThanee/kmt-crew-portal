'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, 
  User as UserIcon, HardHat, Shirt, HandMetal, 
  Footprints, MoreHorizontal, X, Package, History,
  Headphones, Eye, Mask, AlertCircle
} from 'lucide-react'

export default function PPEPage() {
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [requestHistory, setRequestHistory] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const userData = JSON.parse(cachedUser)
    setUser(userData)

    async function fetchData() {
      // ดึงข้อมูลสต็อก
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      
      // ดึงประวัติการเบิกในปีนี้เพื่อเช็ก Limit
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
      const { data: reqs } = await supabase
        .from('ppe_requests')
        .select('*')
        .eq('crew_id', userData.id)
        .gte('request_date', startOfYear)
      if (reqs) setRequestHistory(reqs)
    }
    fetchData()
  }, [router])

  // 3. เรียงลำดับหมวดหมู่ Head > Ears > Eyes > Respiratory > Body > Hands > Foots > Other
  const categoryOrder = [
    { name: 'Head', keywords: ['helmet'], icon: <HardHat size={20}/> },
    { name: 'Ears', keywords: ['ear'], icon: <Headphones size={20}/> },
    { name: 'Eyes', keywords: ['glass', 'goggle'], icon: <Eye size={20}/> },
    { name: 'Respiratory', keywords: ['mask', 'respirator'], icon: <Mask size={20}/> },
    { name: 'Body', keywords: ['suit', 'coverall', 'vest'], icon: <Shirt size={20}/> },
    { name: 'Hands', keywords: ['glove'], icon: <HandMetal size={20}/> },
    { name: 'Foots', keywords: ['boot', 'shoe'], icon: <Footprints size={20}/> },
    { name: 'Others', keywords: [], icon: <MoreHorizontal size={20}/> }
  ]

  const groupedInventory = useMemo(() => {
    return inventory.reduce((acc, item) => {
      const baseName = item.item_name.split('(')[0].trim()
      if (!acc[baseName]) acc[baseName] = { name: baseName, options: [] }
      acc[baseName].options.push(item)
      return acc
    }, {})
  }, [inventory])

  // 6. เช็กขีดจำกัดการเบิกต่อปี
  const checkLimit = (itemName) => {
    const lowerName = itemName.toLowerCase()
    const count = requestHistory.filter(r => r.item_name.toLowerCase().includes(lowerName)).length
    if (lowerName.includes('boiler suit') && count >= 2) return { limited: true, message: 'Limit 2 sets/year reached' }
    if (lowerName.includes('safety boot') && count >= 1) return { limited: true, message: 'Limit 1 pair/year reached' }
    return { limited: false }
  }

  const addToCart = (item) => {
    setCart(prev => [...prev, { ...item, cartId: Date.now() }])
  }

  const handleCheckout = async () => {
    setLoading(true)
    const requests = cart.map(item => ({
      crew_id: user.id,
      item_name: item.item_name,
      size: item.size || item.Size,
      color: item.color || null,
      status: 'pending',
      request_date: new Date().toISOString()
    }))
    const { error } = await supabase.from('ppe_requests').insert(requests)
    if (!error) {
      alert('✅ Request submitted successfully!')
      setCart([]); setShowCart(false); router.refresh();
    }
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* 1. Header: ชื่อ นามสกุล ตำแหน่ง */}
      <div className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-5">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl border-2 border-blue-500/50 p-0.5 bg-slate-800">
              <img src={user.profile_url || '/api/placeholder/150/150'} className="w-full h-full object-cover rounded-[0.8rem]" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight">{user.full_name}</h2>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{user.position || 'Crew Member'}</p>
            </div>
          </div>
          <button onClick={() => setShowCart(true)} className="relative p-3 bg-white/5 rounded-2xl border border-white/10">
            <ShoppingCart size={22} className="text-blue-400" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">{cart.length}</span>}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-6">
        {categoryOrder.map((cat) => {
          const items = Object.values(groupedInventory).filter(g => {
            const name = g.name.toLowerCase()
            return cat.name === 'Others' ? !categoryOrder.slice(0, 7).some(c => c.keywords.some(k => name.includes(k))) : cat.keywords.some(k => name.includes(k))
          })
          if (items.length === 0) return null

          return (
            <div key={cat.name} className="space-y-3">
              <div className="flex items-center gap-2 text-slate-500 px-1 italic">
                {cat.icon} <span className="text-[10px] font-black uppercase tracking-[0.2em]">{cat.name}</span>
              </div>
              
              {/* 2. Accordion: กดดูค่อยขยาย */}
              <div className="grid gap-2">
                {items.map((group) => {
                  const limitStatus = checkLimit(group.name)
                  return (
                    <div key={group.name} className={`bg-white/5 border rounded-[1.5rem] overflow-hidden ${expandedId === group.name ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/5'}`}>
                      <button onClick={() => setExpandedId(expandedId === group.name ? null : group.name)} className="w-full p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">{cat.icon}</div>
                          <div className="text-left">
                            <span className="font-bold text-sm block">{group.name}</span>
                            {limitStatus.limited && <span className="text-[8px] text-red-500 font-bold uppercase">{limitStatus.message}</span>}
                          </div>
                        </div>
                        {expandedId === group.name ? <ChevronUp size={16}/> : <ChevronDown size={16} className="text-slate-600"/>}
                      </button>

                      {expandedId === group.name && (
                        <div className="px-4 pb-4 space-y-2">
                          {group.options.map((opt, i) => {
                            // 5. ล็อก Boiler suit / Safety boots ตามโปรไฟล์
                            const isBoilerSuit = group.name.toLowerCase().includes('boiler suit')
                            const isSafetyBoot = group.name.toLowerCase().includes('safety boot')
                            const isOutOfStock = (opt.stock || opt.Quantity) <= 0 // 4. Check Stock
                            
                            let isLocked = false
                            if (isBoilerSuit) isLocked = (opt.color !== user.suit_color || opt.size !== user.suit_size)
                            if (isSafetyBoot) isLocked = (opt.size !== user.boot_size)

                            if (isLocked) return null; // ไม่แสดงตัวเลือกที่ไม่ตรงโปรไฟล์

                            return (
                              <div key={i} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                <div className="flex flex-col">
                                  {/* 7. Dynamic Labels: โชว์แค่ที่มีข้อมูล */}
                                  <div className="text-[11px] font-bold">
                                    {opt.color && opt.size ? `${opt.color} - ${opt.size}` : (opt.color || opt.size || opt.Size)}
                                  </div>
                                  <span className={`text-[9px] font-bold ${isOutOfStock ? 'text-red-500' : 'text-slate-500'}`}>
                                    {isOutOfStock ? 'OUT OF STOCK' : `In Stock: ${opt.stock || opt.Quantity || 0}`}
                                  </span>
                                </div>
                                <button 
                                  disabled={isOutOfStock || limitStatus.limited}
                                  onClick={() => addToCart(opt)}
                                  className="p-2 bg-blue-600 rounded-lg disabled:opacity-20 disabled:grayscale active:scale-90 transition-all"
                                >
                                  <Plus size={16}/>
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
            </div>
          )
        })}
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-xl font-black uppercase italic tracking-tighter">Your Request</h3>
            <button onClick={() => setShowCart(false)} className="p-2 bg-white/5 rounded-full"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20"><ShoppingCart size={80}/><p className="font-bold mt-4">Empty Cart</p></div>
            ) : (
              cart.map((item) => (
                <div key={item.cartId} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-blue-500"><Package size={24}/></div>
                    <div>
                      <h4 className="text-sm font-bold">{item.item_name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{item.color && `${item.color} | `}Size: {item.size || item.Size}</p>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.cartId)} className="text-red-500/50 p-2"><Trash2 size={20}/></button>
                </div>
              ))
            )}
          </div>
          <div className="p-8 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl">
            <button disabled={cart.length === 0 || loading} onClick={handleCheckout} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest active:scale-95 disabled:opacity-20 transition-all shadow-2xl shadow-blue-500/20">
              {loading ? 'PROCESSING...' : `Confirm Request (${cart.length} items)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
