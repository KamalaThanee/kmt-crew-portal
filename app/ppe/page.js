'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, ChevronDown, ChevronUp, Plus, Trash2, Settings,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, Image as ImageIcon,
  Footprints, MoreHorizontal, X, Package, ShieldAlert, ShieldCheck, 
  Upload, Loader2, CheckCircle2, Save
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
  const hasFullAccess = user ? FULL_ACCESS_POSITIONS.includes(user.position) : false

  useEffect(() => {
    setMounted(true)
    const cachedUser = localStorage.getItem('kmt_user')
    if (!cachedUser) { router.push('/login'); return; }
    const u = JSON.parse(cachedUser)
    setUser(u)

    async function fetchData() {
      // ดึง Stock
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      
      // ดึงการเบิกย้อนหลัง
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
      const { data: reqs } = await supabase.from('ppe_requests').select('*').eq('crew_id', u.id).gte('request_date', startOfYear)
      if (reqs) setHistory(reqs)

      // ดึง Size Charts จาก Database
      const { data: settings } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
      if (settings) {
        setSizeCharts({ suit: settings.suit_chart_url, boot: settings.boot_url })
      }
    }
    fetchData()
  }, [router])

  const handleFileUpload = async (event, type) => {
    try {
      const file = event.target.files[0]
      if (!file) return
      setUploading(prev => ({ ...prev, [type]: true }))

      const fileExt = file.name.split('.').pop()
      const fileName = `${type}_chart_${Date.now()}.${fileExt}`
      const filePath = `size-charts/${fileName}`

      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage.from('ppe_assets').upload(filePath, file)
      if (uploadError) throw uploadError

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('ppe_assets').getPublicUrl(filePath)

      // 3. Save to Database (ppe_settings) เพื่อให้ซิงค์ทุกเครื่อง
      const column = type === 'suit' ? 'suit_chart_url' : 'boot_url'
      const { error: dbError } = await supabase.from('ppe_settings').update({ [column]: publicUrl }).eq('id', 1)
      if (dbError) throw dbError

      setSizeCharts(prev => ({ ...prev, [type]: publicUrl }))
      alert('Upload & Sync Successful!')
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  // --- Logic เดิมคงไว้ ---
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

  const addToCart = (variant) => {
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
            <div>
              <h2 className="text-sm font-bold truncate max-w-[120px]">{user.full_name}</h2>
              <p className="text-[8px] text-blue-400 font-bold uppercase tracking-widest">{user.position}</p>
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 hover:text-white transition-colors">
            <Settings size={20}/>
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
              <button onClick={() => setExpandedCat(isCatOpen ? null : cat.name)} className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${isCatOpen ? 'bg-blue-600 shadow-xl shadow-blue-600/20' : 'bg-white/5 border border-white/10'}`}>
                <div className="flex items-center gap-3">
                  <div className={`${isCatOpen ? 'text-white' : 'text-blue-500'}`}>{cat.icon}</div>
                  <span className="text-[10px] font-black uppercase tracking-widest">{cat.name}</span>
                </div>
                {isCatOpen ? <ChevronUp size={16}/> : <ChevronDown size={16} className="text-slate-600"/>}
              </button>

              {isCatOpen && (
                <div className="space-y-2 pt-1 animate-in slide-in-from-top-2 duration-300">
                  {catItems.map((group) => {
                    const isItemOpen = expandedItem === group.name
                    const lowerName = group.name.toLowerCase()
                    const isBoilerSuit = lowerName.includes('suit')
                    const isSafetyBoot = lowerName.includes('safety boot') && !lowerName.includes('rubber')
                    
                    return (
                      <div key={group.name} className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                        <button onClick={() => setExpandedItem(isItemOpen ? null : group.name)} className="w-full p-4 flex items-center justify-between">
                          <span className="text-xs font-bold">{group.name}</span>
                          <div className="flex items-center gap-3">
                            {(isBoilerSuit && sizeCharts.suit || isSafetyBoot && sizeCharts.boot) && (
                               <a href={isBoilerSuit ? sizeCharts.suit : sizeCharts.boot} target="_blank" className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400" onClick={(e) => e.stopPropagation()}><ImageIcon size={14}/></a>
                            )}
                            <ChevronDown size={14} className={`text-slate-600 transition-transform ${isItemOpen ? 'rotate-180' : ''}`}/>
                          </div>
                        </button>

                        {isItemOpen && (
                          <div className="px-4 pb-4 space-y-2 bg-black/20">
                            {group.variants.map((variant, vIdx) => {
                              const vSize = String(variant.size ?? variant.Size ?? "Standard").trim()
                              const vColor = String(variant.color ?? variant.Color ?? "").trim()
                              const isLocked = (isBoilerSuit && (vColor !== user.suit_color || vSize !== user.suit_size)) || (isSafetyBoot && vSize !== user.boot_size)
                              if (isLocked) return null
                              return (
                                <div key={vIdx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                  <span className="text-[11px] font-bold">{vColor} {vSize}</span>
                                  <button onClick={() => addToCart(variant)} className="p-2 bg-blue-600 rounded-lg"><Plus size={14}/></button>
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
        <div className="fixed inset-0 bg-slate-950/90 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="font-black uppercase text-sm text-blue-500">System Settings</h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase">อัปโหลดตารางไซส์ให้ซิงค์ทุกเครื่อง</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full"><X/></button>
            </div>
            <div className="p-6 space-y-6">
              {['suit', 'boot'].map(type => (
                <div key={type} className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between items-center">
                    {type === 'suit' ? 'Boiler Suit' : 'Safety Boots'} Chart
                    {sizeCharts[type] && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> Sync Active</span>}
                  </label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, type)} className="hidden" id={`${type}-upload`} disabled={uploading[type]}/>
                  <label htmlFor={`${type}-upload`} className="w-full flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer bg-black/20">
                    {uploading[type] ? <Loader2 className="animate-spin text-blue-500"/> : <Upload className="text-slate-400 mb-2"/>}
                    <span className="text-[10px] font-bold text-slate-500">{uploading[type] ? 'Uploading & Syncing...' : 'Click to Update Image'}</span>
                  </label>
                </div>
              ))}
              <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
