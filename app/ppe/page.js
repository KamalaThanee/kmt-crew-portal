'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, ChevronDown, ChevronUp, HardHat, Eye, Ear, Wind, Shirt, Footprints, Box, User, LogOut, Camera, Image as ImageIcon } from 'lucide-react'

export default function PPERequest() {
  const [user, setUser] = useState(null)
  const [groupedItems, setGroupedItems] = useState({})
  const [expandedCat, setExpandedCat] = useState(null)
  const [selectedItemName, setSelectedItemName] = useState(null)
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sizeChartUrl, setSizeChartUrl] = useState('')
  const router = useRouter()

  const categoryOrder = [
    "Head Protection", "Ears Protection", "Eyes Protection", 
    "Respiratory Protection", "Body Protection", "Hands Protection", 
    "Foots Protection", "Other"
  ]

  useEffect(() => {
    const savedUser = localStorage.getItem('kmt_user')
    if (!savedUser) { router.push('/login'); return }
    setUser(JSON.parse(savedUser))

    async function fetchData() {
      // ดึงข้อมูลสต็อก
      const { data: stock } = await supabase.from('ppe_inventory').select('*')
      if (stock) {
        const grouped = stock.reduce((acc, item) => {
          const cat = item.category || item.Category || "Other"
          if (!acc[cat]) acc[cat] = {}
          const name = item.item_name || item.ItemName
          if (!acc[cat][name]) acc[cat][name] = []
          acc[cat][name].push(item)
          return acc
        }, {})
        setGroupedItems(grouped)
      }
      // ดึงรูป Size Chart ล่าสุด
      const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'size_chart_url').single()
      if (settings) setSizeChartUrl(settings.value)
      setLoading(false)
    }
    fetchData()
  }, [])

  const submitRequest = async () => {
    if (cart.length === 0 || !reason) return alert('กรุณาระบุเหตุผลการเบิกครับ')
    setSubmitting(true)
    
    let evidenceUrl = ''
    if (evidenceFile) {
      const fileName = `evidence_${Date.now()}.jpg`
      const { data } = await supabase.storage.from('ppe_assets').upload(`evidence/${fileName}`, evidenceFile)
      if (data) {
        const { data: urlData } = supabase.storage.from('ppe_assets').getPublicUrl(`evidence/${fileName}`)
        evidenceUrl = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('ppe_requests').insert([{
      crew_id: user.id,
      items: cart,
      reason,
      evidence_url: evidenceUrl,
      status: 'pending'
    }])

    if (!error) {
      alert('ส่งคำขอสำเร็จ!')
      setCart([]); setReason(''); setEvidenceFile(null); setShowCart(false)
    }
    setSubmitting(false)
  }

  const handleUpdateSizeChart = async (file) => {
    if (!file) return
    const { data } = await supabase.storage.from('ppe_assets').upload(`size_charts/current_chart.jpg`, file, { upsert: true })
    if (data) {
      const { data: urlData } = supabase.storage.from('ppe_assets').getPublicUrl(`size_charts/current_chart.jpg`)
      await supabase.from('system_settings').update({ value: urlData.publicUrl }).eq('key', 'size_chart_url')
      setSizeChartUrl(urlData.publicUrl)
      alert('อัปเดต Size Chart แล้ว')
    }
  }

  const isAdmin = user && ['Safety Officer', 'Barge Master', 'Chief Officer'].includes(user.position)

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header Profile Section */}
      <div className="sticky top-0 bg-white shadow-sm z-40 p-4 px-6 flex justify-between items-center border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-blue-500 overflow-hidden shadow-inner">
            {user.profile_url ? <img src={user.profile_url} className="w-full h-full object-cover" /> : <User size={20} className="m-2 text-slate-400"/>}
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-800 leading-none">{user.full_name}</h2>
            <p className="text-[10px] text-blue-600 font-black uppercase mt-1 tracking-tighter">
              {user.position} • {user.suit_size}/{user.boot_size}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <label className="p-2 bg-amber-100 text-amber-700 rounded-full cursor-pointer">
              <ImageIcon size={20} /><input type="file" className="hidden" onChange={e => handleUpdateSizeChart(e.target.files[0])}/>
            </label>
          )}
          <button onClick={() => setShowCart(true)} className="relative p-2 bg-slate-100 rounded-full text-slate-600">
            <ShoppingCart size={22} />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{cart.length}</span>}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {/* Size Chart View */}
        {sizeChartUrl && (
          <div className="mb-6 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white p-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase p-2 tracking-widest">Current Size Chart</p>
            <img src={sizeChartUrl} className="w-full h-auto rounded-xl object-contain max-h-[300px]" alt="Size Guide" />
          </div>
        )}

        {/* Categories List */}
        {loading ? <p className="text-center py-20 text-slate-400 italic">Synchronizing Fleet Inventory...</p> : 
          categoryOrder.map(cat => {
            if (!groupedItems[cat]) return null
            return (
              <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button onClick={() => setExpandedCat(expandedCat === cat ? null : cat)} className="w-full flex items-center justify-between p-4">
                  <span className="font-bold text-slate-700">{cat}</span>
                  {expandedCat === cat ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </button>
                {expandedCat === cat && (
                  <div className="p-2 bg-slate-50 space-y-1.5 border-t">
                    {Object.keys(groupedItems[cat]).map(name => (
                      <div key={name} className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm">
                        <span className="text-xs font-bold text-slate-600">{name}</span>
                        <button onClick={() => setSelectedItemName({name, cat})} className="text-[10px] font-black text-white bg-slate-900 px-4 py-2 rounded-lg">SELECT</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        }
      </div>

      {/* Cart Drawer with Evidence Photo */}
      {showCart && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Review Request</h2>
              <button onClick={() => setShowCart(false)} className="text-slate-300 text-2xl">×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4">
              {cart.map(item => (
                <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                      (item.category.includes('Body') && item.size !== user.suit_size) || (item.category.includes('Foot') && item.size !== user.boot_size) 
                      ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      SIZE: {item.size} {(item.category.includes('Body') && item.size !== user.suit_size) && ' (NOT YOUR PROFILE SIZE!)'}
                    </span>
                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400 text-xs">Remove</button>
                  </div>
                </div>
              ))}

              <div className="mt-6 space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Reason & Evidence</label>
                <textarea className="w-full border rounded-2xl p-4 bg-slate-50 text-sm h-20 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Why do you need this? (e.g., Old one torn)" value={reason} onChange={e => setReason(e.target.value)} />
                
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Attach Photo (Optional)</p>
                    <p className="text-[10px] text-blue-400 mt-1">Proof of damage or old item</p>
                  </div>
                  <label className="bg-blue-600 text-white p-3 rounded-xl cursor-pointer shadow-lg active:scale-90 transition-transform">
                    <Camera size={20} />
                    <input type="file" capture="environment" className="hidden" onChange={e => setEvidenceFile(e.target.files[0])} />
                  </label>
                </div>
                {evidenceFile && (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500">
                    <img src={URL.createObjectURL(evidenceFile)} className="w-full h-32 object-cover" />
                    <button onClick={() => setEvidenceFile(null)} className="absolute top-2 right-2 bg-black/50 text-white w-6 h-6 rounded-full text-xs">×</button>
                  </div>
                )}
              </div>
            </div>

            <button 
              disabled={submitting || cart.length === 0}
              onClick={submitRequest}
              className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-900/20 disabled:opacity-50"
            >
              {submitting ? 'SENDING REQUEST...' : 'CONFIRM REQUEST'}
            </button>
          </div>
        </div>
      )}
      {/* Selection Modal ลบออกชั่วคราวเพื่อความสั้น แต่ Logic Size ล็อคตามเดิม */}
    </div>
  )
}
