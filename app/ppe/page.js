'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, ChevronDown, ChevronUp, HardHat, Eye, Ear, Wind, Shirt, Footprints, Box, HandMetal, User, LogOut } from 'lucide-react'

export default function PPERequest() {
  const [user, setUser] = useState(null)
  const [groupedItems, setGroupedItems] = useState({})
  const [expandedCat, setExpandedCat] = useState(null)
  const [selectedItemName, setSelectedItemName] = useState(null)
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const router = useRouter()

  const categoryOrder = [
    "Head Protection", "Ears Protection", "Eyes Protection", 
    "Respiratory Protection", "Body Protection", "Hands Protection", 
    "Foots Protection", "Other"
  ]

  useEffect(() => {
    // ดึงข้อมูลผู้ใช้จาก LocalStorage
    const savedUser = localStorage.getItem('kmt_user')
    if (!savedUser) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(savedUser))

    async function fetchStock() {
      const { data, error } = await supabase.from('ppe_inventory').select('*')
      if (!error && data) {
        const grouped = data.reduce((acc, item) => {
          const cat = item.category || item.Category || "Other"
          if (!acc[cat]) acc[cat] = {}
          const name = item.item_name || item.ItemName
          if (!acc[cat][name]) acc[cat][name] = []
          acc[cat][name].push(item)
          return acc
        }, {})
        setGroupedItems(grouped)
      }
      setLoading(false)
    }
    fetchStock()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('kmt_user')
    router.push('/login')
  }

  const getCatConfig = (catName) => {
    const name = catName.toLowerCase()
    if (name.includes('head')) return { icon: <HardHat size={20}/>, light: "bg-blue-50 text-blue-600" }
    if (name.includes('eye')) return { icon: <Eye size={20}/>, light: "bg-cyan-50 text-cyan-600" }
    if (name.includes('ear')) return { icon: <Ear size={20}/>, light: "bg-orange-50 text-orange-600" }
    if (name.includes('respiratory')) return { icon: <Wind size={20}/>, light: "bg-purple-50 text-purple-600" }
    if (name.includes('body')) return { icon: <Shirt size={20}/>, light: "bg-emerald-50 text-emerald-600" }
    if (name.includes('hand')) return { icon: <HandMetal size={20}/>, light: "bg-yellow-50 text-yellow-700" }
    if (name.includes('foot')) return { icon: <Footprints size={20}/>, light: "bg-amber-50 text-amber-700" }
    return { icon: <Box size={20}/>, light: "bg-slate-50 text-slate-600" }
  }

  const addToCart = (option) => {
    if (cart.find(i => i.id === option.id)) return
    setCart([...cart, { ...option, qty: 1 }])
    setSelectedItemName(null)
  }

  // เช็คสิทธิ์ Admin (อ้างอิงตำแหน่งจากไฟล์ CSV ของคุณ)
  const isAdmin = user && ['Safety Officer', 'Barge Master', 'Chief Officer'].includes(user.position)

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Navbar ปรับปรุงใหม่ */}
      <div className="sticky top-0 bg-white shadow-sm z-40 p-4 px-6 flex justify-between items-center border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2 rounded-xl text-white">
            <User size={20} />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-800 leading-none">{user.full_name}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{user.position}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCart(true)} className="relative p-2 bg-slate-50 rounded-full">
            <ShoppingCart size={22} className="text-slate-600" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{cart.length}</span>}
          </button>
          <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3 mt-4">
        {loading ? <p className="text-center py-10 italic text-slate-400">Loading your store...</p> : 
          categoryOrder.map(cat => {
            if (!groupedItems[cat]) return null;
            const config = getCatConfig(cat)
            return (
              <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button onClick={() => setExpandedCat(expandedCat === cat ? null : cat)} className="w-full flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`${config.light} p-2.5 rounded-2xl`}>{config.icon}</div>
                    <span className="font-bold text-slate-700 text-sm">{cat}</span>
                  </div>
                  {expandedCat === cat ? <ChevronUp size={18} className="text-slate-300"/> : <ChevronDown size={18} className="text-slate-300"/>}
                </button>
                {expandedCat === cat && (
                  <div className="p-2 bg-slate-50 space-y-1.5 border-t border-slate-50">
                    {Object.keys(groupedItems[cat]).map(name => (
                      <div key={name} className="bg-white p-4 rounded-xl flex justify-between items-center border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-xs font-bold text-slate-600">{name}</span>
                        <button onClick={() => setSelectedItemName({name, cat})} className="text-[10px] font-black text-white bg-slate-900 px-4 py-2 rounded-lg tracking-widest uppercase">Select</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        }
      </div>

      {/* Cart Drawer & Size Modal (เหมือนเดิม แต่ใช้ user.id ในการส่งคำขอ) */}
      {/* ... โค้ดส่วนล่างเหมือนเดิม ... */}
      
      {/* Modal เลือกไซส์ */}
      {selectedItemName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-6">{selectedItemName.name}</h3>
            <div className="space-y-3">
              {groupedItems[selectedItemName.cat][selectedItemName.name].map(opt => {
                const stock = opt.quantity || opt.Quantity || 0;
                return (
                  <button 
                    key={opt.id} 
                    disabled={stock <= 0}
                    onClick={() => addToCart(opt)} 
                    className={`w-full flex justify-between items-center p-4 border rounded-2xl transition-all ${stock <= 0 ? 'bg-slate-50 opacity-50' : 'border-slate-100 hover:border-blue-500 hover:bg-blue-50'}`}
                  >
                    <span className="font-bold text-slate-700 text-sm">Size: {opt.size || opt.Size}</span>
                    {isAdmin && <span className="text-[10px] font-bold text-emerald-500">Stock: {stock}</span>}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setSelectedItemName(null)} className="w-full mt-6 text-slate-400 text-xs font-bold uppercase tracking-widest">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
