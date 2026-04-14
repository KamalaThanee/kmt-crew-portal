'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Camera, Search, Ruler, AlertTriangle, X } from 'lucide-react'

export default function AuthPage() {
  const [step, setStep] = useState(1)
  const [isRegister, setIsRegister] = useState(false)
  const [crewList, setCrewList] = useState([])
  const [inventory, setInventory] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSizeChart, setShowSizeChart] = useState(null)
  const router = useRouter()
  
  const [formData, setFormData] = useState({
    id: '', fullName: '', phone: '', email: '', pin: '',
    suitSize: '', suitColor: '', bootSize: '', profileImage: null
  })

  // ดึงข้อมูลเมื่อโหลดหน้าเว็บ
  useEffect(() => {
    async function fetchData() {
      const { data: crews } = await supabase.from('crews').select('*').order('full_name')
      if (crews) setCrewList(crews)
      
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
    }
    fetchData()
  }, [])

  // ป้องกัน Error เวลาค้นหาชื่อ
  const filteredCrews = crewList.filter(c => 
    (c.full_name || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  )

  // ---------------------------------------------------------
  // 🛠️ LOGIC ใหม่: การดึงสต็อกให้ตรงกับ Database จริง
  // ---------------------------------------------------------
  
  // 1. สีชุด Boiler Suit: ค้นหาคำว่า "boiler suit" แล้วตัดเอาเฉพาะคำหลังเครื่องหมาย "-"
  const availableSuitColors = [...new Set(
    inventory
      .filter(i => (i.item_name || '').toLowerCase().includes('boiler suit'))
      .map(i => {
        const name = i.item_name || '';
        return name.includes('-') ? name.split('-')[1].trim() : name;
      })
  )].filter(Boolean)

  // 2. ไซส์ชุด Boiler Suit:
  const availableSuitSizes = [...new Set(
    inventory
      .filter(i => (i.item_name || '').toLowerCase().includes('boiler suit'))
      .map(i => i.size || i.Size)
  )].filter(Boolean)

  // 3. ไซส์ Safety Boots: เจาะจงเฉพาะคำว่า "Safety boots" (ตัด Rubber boots ออก)
  const availableBootSizes = [...new Set(
    inventory
      .filter(i => (i.item_name || '').toLowerCase().includes('safety boots'))
      .map(i => i.size || i.Size)
  )].filter(Boolean).sort()

  // ---------------------------------------------------------

  // ฟังก์ชันลงทะเบียน
  const handleRegister = async () => {
    setLoading(true)
    let profileUrl = ''
    
    if (formData.profileImage) {
      try {
        const fileName = `${Date.now()}_profile.jpg`
        const { data } = await supabase.storage.from('ppe_assets').upload(`profiles/${fileName}`, formData.profileImage)
        if (data) {
          const { data: urlData } = supabase.storage.from('ppe_assets').getPublicUrl(`profiles/${fileName}`)
          profileUrl = urlData.publicUrl
        }
      } catch (err) {
        console.error("Upload error", err)
      }
    }

    const { error: updateError } = await supabase.from('crews').update({
      email: formData.email, pin: formData.pin, phone: formData.phone,
      suit_size: formData.suitSize, suit_color: formData.suitColor, boot_size: formData.bootSize,
      profile_url: profileUrl
    }).eq('id', formData.id)

    if (updateError) { 
      setError('ข้อมูลซ้ำหรือผิดพลาด'); 
      setLoading(false); 
    } else { 
      alert('ลงทะเบียนสำเร็จ! กรุณาล็อกอิน'); 
      setIsRegister(false); 
      setStep(1); 
      setShowConfirm(false); 
      setLoading(false); 
    }
  }

  // ฟังก์ชันล็อกอิน
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { data, error: loginError } = await supabase
      .from('crews')
      .select('*')
      .eq('email', formData.email)
      .eq('pin', formData.pin)
      .single()

    if (loginError || !data) {
      setError('Email หรือ PIN ไม่ถูกต้อง')
      setLoading(false)
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('kmt_user', JSON.stringify(data))
      }
      router.push('/ppe')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[3rem] p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black italic text-blue-500 tracking-tighter">KMT PORTAL</h1>
          <p className="text-slate-400 text-[10px] mt-2 font-bold uppercase tracking-[0.2em]">Safety Management</p>
        </div>

        {isRegister ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            {step === 1 && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-4 text-slate-500" size={18} />
                  <input 
                    className="w-full bg-white/10 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="พิมพ์ชื่อเพื่อค้นหา..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                  {filteredCrews.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => { setFormData({...formData, id: c.id, fullName: c.full_name}); setSearchTerm(c.full_name); }}
                      className={`w-full text-left p-4 rounded-xl transition-all ${formData.id === c.id ? 'bg-blue-600 font-bold' : 'bg-white/5 hover:bg-white/10'}`}
                    >
                      {c.full_name}
                    </button>
                  ))}
                </div>
                <button onClick={() => formData.id && setStep(2)} className="w-full py-4 bg-blue-600 rounded-2xl font-bold mt-4 shadow-lg disabled:opacity-50" disabled={!formData.id}>NEXT</button>
              </div>
            )}

            {step === 2 && (
              <div className="text-center">
                <div className="w-48 h-48 bg-white/10 rounded-full mx-auto mb-6 flex items-center justify-center border-4 border-blue-500/20 overflow-hidden shadow-2xl">
                  {formData.profileImage ? (
                    <img src={URL.createObjectURL(formData.profileImage)} className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={50} className="text-slate-700" />
                  )}
                </div>
                <label className="inline-flex items-center gap-2 bg-blue-600 px-8 py-4 rounded-2xl font-bold cursor-pointer shadow-xl active:scale-95 transition-all">
                  <Camera size={20} /> TAKE PHOTO
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => setFormData({...formData, profileImage: e.target.files[0]})} />
                </label>
                <button onClick={() => setStep(3)} className="w-full mt-10 py-4 border border-white/10 rounded-2xl font-bold opacity-50 hover:opacity-100">NEXT STEP</button>
              </div>
            )}

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
                      <select className="bg-slate-900 border border-white/10 p-3 rounded-xl text-sm outline-none" onChange={e => setFormData({...formData, suitColor: e.target.value})}>
                        <option value="">Color</option>
                        {availableSuitColors.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="bg-slate-900 border border-white/10 p-3 rounded-xl text-sm outline-none" onChange={e => setFormData({...formData, suitSize: e.target.value})}>
                        <option value="">Size</option>
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
                    <select className="w-full bg-slate-900 border border-white/10 p-4 rounded-xl text-sm outline-none" onChange={e => setFormData({...formData, bootSize: e.target.value})}>
                      <option value="">Boots Size (EU)</option>
                      {availableBootSizes.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => {
                  if(!formData.suitSize || !formData.suitColor || !formData.bootSize) return alert('กรุณาเลือกไซส์ให้ครบครับ');
                  setShowConfirm(true)
                }} className="w-full py-4 bg-blue-600 rounded-2xl font-bold shadow-lg">NEXT</button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 animate-in fade-in">
                <input placeholder="Email" type="email" className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl outline-none" onChange={e => setFormData({...formData, email: e.target.value})} />
                <input placeholder="Phone" className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl outline-none" onChange={e => setFormData({...formData, phone: e.target.value})} />
                <input placeholder="Set 6-Digit PIN" type="password" maxLength="6" className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-center text-3xl tracking-widest font-bold outline-none" onChange={e => setFormData({...formData, pin: e.target.value})} />
                <button onClick={handleRegister} disabled={loading} className="w-full py-5 bg-emerald-600 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20">
                  {loading ? 'REGISTERING...' : 'Register Profile'}
                </button>
              </div>
            )}
            
            {step !== 1 && (
                <button onClick={() => setStep(step - 1)} className="w-full mt-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">
                  BACK TO PREVIOUS STEP
                </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-500">
            <input placeholder="Email" type="email" required className="w-full bg-white/10 border border-white/10 p-5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFormData({...formData, email: e.target.value})} />
            <input placeholder="6-DIGIT PIN" type="password" maxLength="6" required className="w-full bg-white/10 border border-white/10 p-5 rounded-2xl text-center text-3xl tracking-widest outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFormData({...formData, pin: e.target.value})} />
            {error && <p className="text-red-400 text-xs text-center font-bold bg-red-400/10 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 rounded-2xl font-black shadow-xl shadow-blue-900/40">
              {loading ? 'LOGGING IN...' : 'LOG IN'}
            </button>
            <button type="button" onClick={() => setIsRegister(true)} className="w-full mt-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">
              First Time? Register New Account
            </button>
          </form>
        )}

        {/* --- Confirmation Pop-up --- */}
        {showConfirm && (
          <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-6 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-slate-900 text-xl font-black mb-4 uppercase italic">ยืนยันข้อมูลไซส์?</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed font-bold">
                "กรุณาใส่ขนาดให้ตรงตามจริง <br/>จะให้เบิกตาม Size ที่ลงทะเบียนเท่านั้น"
              </p>
              <div className="space-y-3">
                <button onClick={() => { setShowConfirm(false); setStep(4); }} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black tracking-widest uppercase hover:bg-emerald-700">ยืนยันข้อมูลถูกต้อง</button>
                <button onClick={() => setShowConfirm(false)} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl">กลับไปแก้ไข</button>
              </div>
            </div>
          </div>
        )}

        {/* --- Size Chart Modal --- */}
        {showSizeChart && (
          <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-slate-900 rounded-3xl p-2 animate-in fade-in">
              <button onClick={() => setShowSizeChart(null)} className="absolute -top-12 right-0 text-white flex items-center gap-1 font-bold bg-white/10 px-4 py-2 rounded-full">
                CLOSE <X size={16}/>
              </button>
              <div className="overflow-auto max-h-[80vh] flex items-center justify-center">
                <img 
                  src={showSizeChart === 'suit' ? '/suit-size.png' : '/boots-size.png'} 
                  className="w-full h-auto object-contain rounded-2xl bg-white" 
                  alt="Size Chart"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/600x800?text=Please+Upload+Size+Chart' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
