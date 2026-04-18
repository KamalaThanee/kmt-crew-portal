'use client'
import { toast } from 'sonner';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  HardHat, Headphones, Eye, Wind, ShieldCheck, Hand, 
  Footprints, MoreHorizontal, ChevronDown, ChevronUp, 
  Plus, AlertTriangle, Upload, Loader2, Image as ImageIcon, X, Shirt
} from 'lucide-react'

function PPEContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [inventory, setInventory] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 })
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })

  const loadCart = useCallback(() => {
    const saved = localStorage.getItem('kmt_cart') || '[]'
    setCart(JSON.parse(saved))
  }, [])

  useEffect(() => {
    setMounted(true)
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const u = JSON.parse(cachedUser)
    setUser(u)
    loadCart()

    if (searchParams.get('settings') === 'true') setShowSettings(true)

    async function fetchData() {
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      
      const { data: st } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
      if (st) setSizeCharts({ suit: st.suit_chart_url || '', boot: st.boot_url || '' })

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

    window.addEventListener('cart-updated', loadCart)
    return () => window.removeEventListener('cart-updated', loadCart)
  }, [router, searchParams, loadCart])

  const handleUpload = async (type: 'suit' | 'boot', file: File) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_chart_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('size-charts').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('size-charts').getPublicUrl(fileName);
      const column = type === 'suit' ? 'suit_chart_url' : 'boot_url';
      await supabase.from('ppe_settings').update({ [column]: publicUrl }).eq('id', 1);
      
      setSizeCharts(prev => ({ ...prev, [type]: publicUrl }));
      toast.success('อัปเดต Size Chart สำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const groupedInventory = useMemo(() => {
    const groups: any = {}
    inventory.forEach((item: any) => {
      const name = item.item_name || "Unknown"
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
    const stock = Number(variant.quantity || 0)
    const inCart = cart.filter((i: any) => i.id === variant.id).length
    if (inCart >= stock) { toast.error("สต๊อกไม่พอ"); return; }

    const name = variant.item_name.toLowerCase()
    const isSuit = name.includes('suit')
    const isBoot = name.includes('safety boot') && !name.includes('rubber')

    if (isSuit || isBoot) {
      const limit = isSuit ? 2 : 1
      const currentQuota = isSuit ? quotas.suit : quotas.boot
      const inCartCount = cart.filter((i: any) => isSuit ? i.item_name.toLowerCase().includes('suit') : (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber'))).length
      if (currentQuota + inCartCount >= limit) {
        toast.warning(`โควตาจำกัด ${limit} ${isSuit ? 'ชุด' : 'คู่'} ต่อปี`);
        return;
      }
    }

    const newCart = [...cart, { ...variant, cartId: Date.now() }]
    setCart(newCart)
    localStorage.setItem('kmt_cart', JSON.stringify(newCart))
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }))
    toast.success('เพิ่มลงตะกร้าแล้ว')
  };

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 font-sans">
      <div className="max-w-md mx-auto p-4 space-y-4 pt-4">
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
                  {catItems.map((group: any) => {
                    // 🎯 FILTER: กรองเฉพาะไซส์และสีของตัวเองเท่านั้น สำหรับ Suit และ Boots
                    const name = group.name.toLowerCase()
                    const isSuit = name.includes('suit')
                    const isBoot = name.includes('safety boot') && !name.includes('rubber')
                    
                    const visibleVariants = group.variants.filter((v: any) => {
                      if (isSuit) return String(v.size) === String(user.suit_size) && String(v.color) === String(user.suit_color);
                      if (isBoot) return String(v.size) === String(user.boot_size);
                      return true; // หมวดอื่นโชว์ปกติ
                    })

                    if (visibleVariants.length === 0) return null;

                    return (
                      <div key={group.name} className="bg-slate-800 rounded-2xl overflow-hidden border border-white/10">
                        <button onClick={() => setExpandedItem(expandedItem === group.name ? null : group.name)} className="w-full p-4 flex items-center justify-between gap-2 text-left">
                          <span className="text-[12px] font-black text-blue-300 uppercase leading-tight">{group.name}</span>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform shrink-0 ${expandedItem === group.name ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedItem === group.name && (
                          <div className="p-3 space-y-2 bg-slate-900/50">
                            {visibleVariants.map((variant: any, vIdx: number) => {
                              const stock = Number(variant.quantity || 0)
                              const inCartCount = cart.filter((i: any) => i.id === variant.id).length
                              const currentStock = stock - inCartCount
                              const canAdd = currentStock > 0

                              return (
                                <div key={vIdx} className="flex items-center justify-between p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-black uppercase">{variant.color} {variant.size}</span>
                                      {(isSuit || isBoot) && <span className="bg-blue-600 text-[7px] px-2 py-0.5 rounded-md font-black text-white uppercase tracking-wider">MY REGISTERED SIZE</span>}
                                    </div>
                                    <div className="text-[10px] font-bold">
                                      {currentStock <= 0 ? <span className="text-red-500 uppercase flex items-center gap-1"><AlertTriangle size={10}/> Out of Stock</span> : <span className="text-slate-500">Stock: {currentStock}</span>}
                                    </div>
                                  </div>
                                  {canAdd ? (
                                    <button onClick={() => addToCart(variant)} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-500 transition-colors active:scale-95"><Plus size={18}/></button>
                                  ) : (
                                    <div className="p-3 text-slate-700 bg-white/5 rounded-xl"><X size={18}/></div>
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

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-6 overflow-y-auto animate-in fade-in">
           <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black uppercase italic">Charts Management</h2>
              <button onClick={() => setShowSettings(false)} className="p-3 bg-white/5 rounded-full"><X/></button>
           </div>
           <div className="space-y-8 pb-20">
              {[ {id: 'suit', label: 'Boiler Suit Chart'}, {id: 'boot', label: 'Safety Boot Chart'} ].map((item: any) => (
                <div key={item.id} className="p-6 bg-slate-900 rounded-[32px] border border-white/5 space-y-4">
                  <div className="flex items-center gap-3"><ImageIcon className="text-blue-500"/><span className="font-black uppercase tracking-tighter text-sm">{item.label}</span></div>
                  {sizeCharts[item.id as 'suit' | 'boot'] ? (
                    <div className="relative group">
                      <img src={sizeCharts[item.id as 'suit' | 'boot']} alt="Chart" className="w-full h-48 object-contain bg-black rounded-2xl border border-white/10" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                        <p className="text-[10px] font-bold uppercase text-white">Current Chart</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-black rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-600">
                      <ImageIcon size={32} className="mb-2 opacity-20"/>
                      <p className="text-[10px] uppercase font-bold">No chart uploaded</p>
                    </div>
                  )}
                  <label className="flex items-center justify-center w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl cursor-pointer transition-all gap-2 font-bold uppercase tracking-widest text-xs">
                    {uploading[item.id as 'suit' | 'boot'] ? <Loader2 className="animate-spin"/> : <Upload size={18}/>}
                    {sizeCharts[item.id as 'suit' | 'boot'] ? 'Update Chart' : 'Upload Chart'}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(item.id, e.target.files[0])} disabled={uploading[item.id as 'suit' | 'boot']} />
                  </label>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  )
}

export default function PPEPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black tracking-[0.3em] animate-pulse text-xs">KMT PORTAL INITIALIZING...</div>}>
      <PPEContent />
    </Suspense>
  )
}
