'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Camera, Search, ChevronRight, Ruler, AlertCircle, X } from 'lucide-react'

export default function AuthPage() {
  const [step, setStep] = useState(1)
  const [isRegister, setIsRegister] = useState(false)
  const [crewList, setCrewList] = useState([])
  const [inventory, setInventory] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSizeChart, setShowSizeChart] = useState(null) // 'suit' or 'boots'
  const router = useRouter()
  
  const [formData, setFormData] = useState({
    id: '', fullName: '', phone: '', email: '', pin: '',
    suitSize: '', suitColor: '', bootSize: '', profileImage: null
  })

  useEffect(() => {
    async function fetchData() {
      const { data: crews } = await supabase.from('crews').select('*').order('full_name')
      if (crews) setCrewList(crews)
      
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
    }
    fetchData()
  }, [])

  // ดึงรายการ Color/Size จาก Inventory (Unique values)
  const availableSuitColors = [...new Set(inventory?.filter(i => i.category?.includes('Body')).map(i => i.color || i.Color))]
  const availableSuitSizes = [...new Set(inventory?.filter(i => i.category?.includes('Body')).map(i => i.size || i.Size))]
  const availableBootSizes = [...new Set(inventory?.filter(i => i.category?.includes('Foot')).map(i => i.size || i.Size))].sort()

  const handleRegister = async () => {
    setLoading(true)
    let profileUrl = ''
    if (formData.profileImage) {
      const fileName = `${Date.now()}_profile.jpg`
      const { data } = await supabase.storage.from('ppe_assets').upload(`profiles/${fileName}`, formData.profileImage)
      if (data) {
        const { data: urlData } = supabase.storage.from('ppe_assets').getPublicUrl(`profiles/${fileName}`)
        profileUrl = urlData.publicUrl
      }
    }

    const { error: updateError } = await supabase.from('crews').update({
      email: formData.email, pin: formData.pin, phone: formData.phone,
      suit_size: formData.suitSize, suit_color: formData.suitColor, boot_size: formData.bootSize,
      profile_url: profileUrl
    }).eq('id', formData.id)

    if (updateError) { setError('Registration Error'); setLoading(false); }
    else { alert('ลงทะเบียนสำเร็จ!'); setIsRegister(false); setStep(1); setShowConfirm(false); setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[3rem] p-8 shadow-2xl relative">
        
        {isRegister ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-center text-blue-400">REGISTER PROFILE</h2>

            {/* Step 3: Size Selection with Dynamic Links to Inventory */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in">
                <div className="space-y-4">
                  <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Boiler Suit</label>
                      <button onClick={() => setShowSizeChart('suit')} className="flex items-center gap-1 text-[10px] text-blue-400 font-bold border border-blue-400/30 px-2 py-1 rounded-lg">
                        <Ruler size={12}/> SIZE CHART
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select className="bg-slate-900 border border-white/10 p-3 rounded-xl text-sm" onChange={e => setFormData({...formData, suitColor: e.target.value})}>
                        <option value="">Select Color</option>
                        {availableSuitColors.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="bg-slate-900 border border-white/10 p-3 rounded-xl text-sm" onChange={e => setFormData({...formData, suitSize: e.target.value})}>
                        <option value="">Select Size</option>
                        {availableSuitSizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Safety Boots</label>
                      <button onClick={() => setShowSizeChart('boots')} className="flex items-center gap-1 text-[10px] text-blue-400 font-bold border border-blue-400/30 px-2 py-1 rounded-lg">
                        <Ruler size={12}/> SIZE CHART
                      </button>
                    </div>
                    <select className="w-full bg-slate-900 border border-white/10 p-4 rounded-xl text-sm" onChange={e => setFormData({...formData, bootSize: e.target.value})}>
                      <option value="">Choose Size (EU)</option>
                      {availableBootSizes.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => setShowConfirm(true)} className="w-full py-4 bg-blue-600 rounded-2xl font-bold">NEXT</button>
              </div>
            )}

            {/* Steps อื่นๆ (1, 2, 4) ยังคงเหมือนเดิม... */}
            {/* [โค้ดส่วนที่เหลือจะรวมอยู่ในไฟล์เดียวกัน] */}
          </div>
        ) : (
          /* Login Form... */
          <div /> 
        )}

        {/* --- Confirmation Pop-up --- */}
        {showConfirm && (
          <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-6 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-slate-900 text-xl font-black mb-4 uppercase italic">ยืนยันข้อมูลไซส์?</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed font-bold">
                "กรุณาใส่ขนาดให้ตรงตามจริง <br/>จะให้เบิกตาม Size ที่ลงทะเบียนเท่านั้น"
              </p>
              <div className="space-y-3">
                <button onClick={() => { setShowConfirm(false); setStep(4); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black tracking-widest uppercase">ยืนยันข้อมูลถูกต้อง</button>
                <button onClick={() => setShowConfirm(false)} className="w-full py-4 text-slate-400 font-bold">กลับไปกรอกอีกครั้ง</button>
              </div>
            </div>
          </div>
        )}

        {/* --- Size Chart Modal --- */}
        {showSizeChart && (
          <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-3xl p-2 animate-in fade-in">
              <button onClick={() => setShowSizeChart(null)} className="absolute -top-12 right-0 text-white flex items-center gap-1 font-bold">
                CLOSE <X size={20}/>
              </button>
              <div className="overflow-auto max-h-[80vh]">
                <img 
                  src={showSizeChart === 'suit' ? '/suit-size.png' : '/boots-size.png'} 
                  className="w-full h-auto object-contain rounded-2xl" 
                  alt="Size Chart"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
