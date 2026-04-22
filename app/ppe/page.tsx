'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { HardHat, Headphones, Eye, Wind, Hand, Footprints, MoreHorizontal, ChevronDown, ChevronUp, Plus, AlertTriangle, Lock, Shirt, Users } from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [crews, setCrews] = useState<any[]>([])
  
  const [targetCrewId, setTargetCrewId] = useState<string>('')
  const [inventory, setInventory] = useState<any[]>([])
  const [cartCount, setCartCount] = useState(0) // ใช้แค่นับจำนวนพอ
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 })
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr)
    setUser(u)
    setTargetCrewId(u.id)
    
    const pos = (u.position || "").toLowerCase().trim()
    const isAdminCheck = ["safety officer", "chief officer", "barge master"].includes(pos)
    setIsAdmin(isAdminCheck)
    
    // โหลดจำนวนในตะกร้าตอนเริ่ม
    const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
    setCartCount(currentCart.length)

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
      if (inv) setInventory(inv)
      
      if (isAdminCheck) {
        const { data: cr } = await supabase.from('crews').select('*').order('full_name')
        if (cr) setCrews(cr)
      }
    }
    fetchData()

    // ดักฟังเวลามีการเปิด/ปิด/ลบของในตะกร้า เพื่ออัปเดตหน้าจอ
    const handleCartSync = () => {
      const updatedCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
      setCartCount(updatedCart.length)
    }
    window.addEventListener('cart-updated', handleCartSync)
    return () => window.removeEventListener('cart-updated', handleCartSync)
  }, [router])

  useEffect(() => {
    async function fetchQuotas() {
      if (!targetCrewId) return;
      const currentYear = new Date().getFullYear()
      const { data: reqs } = await supabase.from('ppe_requests').select('items').eq('crew_id', targetCrewId).neq('status', 'rejected').gte('created_at', `${currentYear}-01-01`)
      let sc = 0; let bc = 0;
      reqs?.forEach(r => {
        r.items?.forEach((i:any) => {
          if (i.item_name.toLowerCase().includes('suit')) sc++;
          if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bc++;
        })
      })
      setQuotas({ suit: sc, boot: bc })
      
      if (crews.length > 0 && targetCrewId !== user?.id) {
         const tc = crews.find(c => c.id === targetCrewId)
         localStorage.setItem('kmt_target_crew', JSON.stringify(tc))
      } else {
         localStorage.removeItem('kmt_target_crew')
      }
    }
    fetchQuotas()
  }, [targetCrewId, crews])

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

  const activeProfile = targetCrewId === user?.id ? user : crews.find(c => c.id === targetCrewId) || user

  const addToCart = (variant: any) => {
    // 🎯 โหลดตะกร้าปัจจุบันสดๆ จาก LocalStorage เสมอ ป้องกันการทำงานซ้อนกัน
    const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
    
    const stock = Number(variant.quantity || 0)
    const inCartCount = currentCart.filter((i: any) => i.id === variant.id).length
    if (inCartCount >= stock) return toast.error("Out of stock!");

    const name = variant.item_name.toLowerCase()
    const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');

    if (isSuit || isBoot) {
      const limit = isSuit ? 2 : 1
      const currentQuota = isSuit ? quotas.suit : quotas.boot
      const inCartItems = currentCart.filter((i: any) => {
        const n = i.item_name.toLowerCase()
        return isSuit ? n.includes('suit') : (n.includes('safety boot') && !n.includes('rubber'))
      }).length
      
      if (currentQuota + inCartItems >= limit) {
         if (isAdmin) {
            toast.warning(`Over quota (${limit}/year) - Bypassed by Admin`);
         } else {
            return toast.error(`Quota limit reached (${limit}/year)`);
         }
      }
    }

    // เพิ่มของชิ้นใหม่และเซฟกลับลง LocalStorage
    const newCart = [...currentCart, { ...variant, cartId: Date.now() }]
    localStorage.setItem('kmt_cart', JSON.stringify(newCart))
    
    // แจ้ง Component อื่นๆ (Navbar/CartDrawer) ว่ามีการเปลี่ยนยอด
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }))
    toast.success('Added to Cart')
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-black text-white pb-32 pt-28 px-4 font-sans relative z-0">
      <div className="max-w-md mx-auto space-y-4">
        
        {isAdmin && (
          <div className="bg-zinc-900 border border-orange-500/30 p-5 rounded-[24px] mb-8 shadow-2xl">
             <label className="text-[10px] font-black uppercase text-orange-500 tracking-widest flex items-center gap-2 mb-3"><Users size={14}/> Request On Behalf Of</label>
             <select 
               value={targetCrewId} 
               onChange={(e) => { 
                 setTargetCrewId(e.target.value); 
                 localStorage.setItem('kmt_cart', '[]'); 
                 window.dispatchEvent(new CustomEvent('cart-updated', { detail: 0 })); 
               }} 
               className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-orange-500 font-bold uppercase text-xs"
             >
                <option value={user.id}>Myself ({user.full_name})</option>
                <optgroup label="Crew Members">
                   {crews.filter(c => c.id !== user.id).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </optgroup>
             </select>
             {targetCrewId !== user.id && <p className="text-[9px] text-zinc-500 mt-3 font-bold">⚠️ Quota and sizes will be based on the selected crew member.</p>}
          </div>
        )}

        {categories.map(cat => {
          const catItems: any = groupedInventory.filter((group: any) => {
            const n = group.name.toLowerCase()
            return cat.name === 'Other' ? !categories.slice(0, 7).some(c => c.keywords.some(k => n.includes(k))) : cat.keywords.some(k => n.includes(k))
          })
          if (catItems.length === 0) return null
          const isCatOpen = expandedCat === cat.name
          return (
            <div key={cat.name} className={`rounded-[32px] border transition-all ${isCatOpen ? 'border-orange-500 bg-zinc-900 shadow-[0_0_30px_rgba(249,115,22,0.1)]' : 'border-white/5 bg-zinc-900/50 hover:bg-zinc-900'}`}>
              <button onClick={() => setExpandedCat(isCatOpen ? null : cat.name)} className="w-full p-6 flex items-center justify-between outline-none">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isCatOpen ? 'bg-orange-500 text-white' : 'bg-black text-zinc-500 border border-white/5'}`}>{cat.icon}</div>
                  <span className={`text-xs font-black uppercase tracking-tighter ${isCatOpen ? 'text-white' : 'text-zinc-400'}`}>{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={20} className="text-orange-500"/> : <ChevronDown size={20} className="text-zinc-600" />}
              </button>
              {isCatOpen && (
                <div className="px-4 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-300">
                  {catItems.map((group: any) => {
                    const name = group.name.toLowerCase()
                    const isSuit = name.includes('suit'); const isBoot = name.includes('safety boot') && !name.includes('rubber');
                    const visibleVariants = group.variants.filter((v: any) => {
                      if (isSuit) return String(v.size) === String(activeProfile?.suit_size) && String(v.color) === String(activeProfile?.suit_color);
                      if (isBoot) return String(v.size) === String(activeProfile?.boot_size);
                      return true;
                    })
                    if (visibleVariants.length === 0) return null;
                    return (
                      <div key={group.name} className="bg-black/40 rounded-2xl overflow-hidden border border-white/5">
                        <button onClick={() => setExpandedItem(expandedItem === group.name ? null : group.name)} className="w-full p-4 flex items-center justify-between text-left outline-none">
                          <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{group.name}</span>
                          <ChevronDown size={14} className={`text-zinc-600 transition-transform ${expandedItem === group.name ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedItem === group.name && (
                          <div className="p-2 space-y-2 bg-black/20 border-t border-white/5">
                            {visibleVariants.map((variant: any, vIdx: number) => {
                              const stock = Number(variant.quantity || 0)
                              // 🎯 ดึงยอดตะกร้าปัจจุบันมาเช็คกันของหมด
                              const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
                              const inCartCount = currentCart.filter((i: any) => i.id === variant.id).length
                              const currentStock = stock - inCartCount
                              const canAdd = currentStock > 0
                              return (
                                <div key={vIdx} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-zinc-900/30">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-white tracking-widest">{variant.color} {variant.size}</span>
                                    <div className="mt-1">
                                      {currentStock <= 0 ? (
                                        <span className="text-red-500 uppercase text-[8px] font-bold flex items-center gap-1"><AlertTriangle size={10}/> Out of Stock</span>
                                      ) : isAdmin ? (
                                        <span className="text-zinc-500 text-[8px] uppercase tracking-widest font-black">Stock: <span className="text-white">{currentStock}</span></span>
                                      ) : (
                                        <span className="text-emerald-500 uppercase text-[8px] font-bold italic">● In Stock</span>
                                      )}
                                    </div>
                                  </div>
                                  {canAdd ? (
                                    <button onClick={() => addToCart(variant)} className="p-3 bg-orange-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><Plus size={16}/></button>
                                  ) : (
                                    <div className="p-3 text-zinc-800"><Lock size={16}/></div>
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
    </div>
  )
}

export default function PPEPage() {
  return ( <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse">LOADING...</div>}><PPEContent /></Suspense> )
}
