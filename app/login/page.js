'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Camera, Search, UserCheck, AlertTriangle } from 'lucide-react'

export default function AuthPage() {
  const [step, setStep] = useState(1)
  const [isRegister, setIsRegister] = useState(false)
  const [crewList, setCrewList] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  
  const [formData, setFormData] = useState({
    id: '', fullName: '', phone: '', email: '', pin: '',
    suitSize: '', suitColor: '', bootSize: '', profileImage: null
  })

  // รายการสำหรับ Dropdown เพื่อกันคนกรอกผิด
  const suitSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']
  const suitColors = ['Orange', 'Navy Blue']
  const bootSizes = Array.from({length: 11}, (_, i) => (37 + i).toString()) // 37 - 47

  useEffect(() => {
    async function getCrews() {
      const { data } = await supabase.from('crews').select('*').order('full_name')
      if (data) setCrewList(data)
    }
    getCrews()
  }, [])

  // ระบบค้นหาชื่อ (Smart Search)
  const filteredCrews = crewList.filter(c => 
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRegister = async () => {
    if(!formData.suitSize || !formData.suitColor || !formData.bootSize) return alert('กรุณาเลือกไซส์ให้ครบครับ')
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

    if (updateError) { setError('ข้อมูลซ้ำหรือผิดพลาด'); setLoading(false); }
    else { alert('ลงทะเบียนสำเร็จ!'); setIsRegister(false); setStep(1); setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[3rem] p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black italic text-blue-500 tracking-tighter">KMT PORTAL</h1>
          <p className="text-slate-400 text-[10px] mt-2 font-bold uppercase tracking-[0.2em]">Safety Management</p>
        </div>

        {isRegister ? (
          <div className="space-y-6">
            {/* Step 1: ค้นหาชื่อ (พิมพ์ได้) */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in">
                <div className="relative">
                  <Search className="absolute left-4 top-4 text-slate-500" size={18} />
                  <input 
                    className="w-full bg-white/10 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="พิมพ์ชื่อเพื่อค้นหา..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
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
                <button onClick={() => formData.id && setStep(2)} className="w-full py-4 bg-blue-600 rounded-2xl font-bold mt-4 shadow-lg">NEXT</button>
              </div>
            )}

            {/* Step 2: ถ่ายรูป (Camera Direct) */}
            {step === 2 && (
              <div className="text-center animate-in fade-in">
                <div className="w-48 h-48 bg-white/10 rounded-full mx-auto mb-6 flex items-center justify-center border-4 border-blue-500/20 overflow-hidden shadow-2xl">
                  {formData.profileImage ? <img src={URL.createObjectURL(formData.profileImage)} className="w-full h-full object-cover" /> : <Camera size={50} className="text-slate-700" />}
                </div>
                <label className="inline-flex items-center gap-2 bg-blue-600 px-8 py-4 rounded-2xl font-bold cursor-pointer shadow-xl active:scale-95 transition-all">
                  <Camera size={20} /> TAKE PHOTO
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => setFormData({...formData, profileImage: e.target.files[0]})} />
                </label>
                <button onClick={() => setStep(3)} className="w-full mt-10 py-4 border border-white/10 rounded-2xl font-bold opacity-50 hover:opacity-100">SKIP / NEXT</button>
              </div>
            )}

            {/* Step 3: Boiler Suit & Boots Dropdowns */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-red-500/10 border-2 border-red-500 p-4 rounded-2xl flex gap-3 items-start">
                  <AlertTriangle className="text-red-500 shrink-0" size={24} />
                  <p className="text-red-500 font-black text-xs leading-relaxed uppercase">
                    * กรุณาใส่ข้อมูลให้ตรงตามจริง <br/>ระบบจะอนุญาตให้เบิกตาม SIZE ที่ลงทะเบียนเท่านั้น
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-3xl border border-white/5">
                    <label className="text-[10px] font-bold text-blue-400 uppercase mb-3 block">Boiler Suit Selection</label>
                    <div className="grid grid-cols-2 gap-3">
                      <select className="bg-slate-900 border border-white/10 p-3 rounded-xl text-sm" onChange={e => setFormData({...formData, suitColor: e.target.value})}>
                        <option value="">Select Color</option>
                        {suitColors.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="bg-slate-900 border border-white/10 p-3 rounded-xl text-sm" onChange={e => setFormData({...formData, suitSize: e.target.value})}>
                        <option value="">Select Size</option>
                        {suitSizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-3xl border border-white/5">
                    <label className="text-[10px] font-bold text-blue-400 uppercase mb-3 block">Safety Boots Size</label>
                    <select className="w-full bg-slate-900 border border-white/10 p-4 rounded-xl text-sm" onChange={e => setFormData({...formData, bootSize: e.target.value})}>
                      <option value="">Choose Your Size (EU)</option>
                      {bootSizes.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => setStep(4)} className="w-full py-4 bg-blue-600 rounded-2xl font-bold shadow-lg shadow-blue-900/40">NEXT</button>
              </div>
            )}

            {/* Step 4: Contact & PIN */}
            {step === 4 && (
              <div className="space-y-4 animate-in fade-in">
                <input placeholder="Email" type="email" className="w-full bg-white/10 p-4 rounded-2xl outline-none" onChange={e => setFormData({...formData, email: e.target.value})} />
                <input placeholder="Phone" className="w-full bg-white/10 p-4 rounded-2xl outline-none" onChange={e => setFormData({...formData, phone: e.target.value})} />
                <input placeholder="Set 6-Digit PIN" type="password" maxLength="6" className="w-full bg-white/10 p-4 rounded-2xl text-center text-3xl tracking-widest font-bold" onChange={e => setFormData({...formData, pin: e.target.value})} />
                <button onClick={handleRegister} disabled={loading} className="w-full py-5 bg-emerald-600 rounded-2xl font-black shadow-xl shadow-emerald-900/20 uppercase tracking-widest">Register Profile</button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <input placeholder="Email" type="email" required className="w-full bg-white/10 p-5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFormData({...formData, email: e.target.value})} />
            <input placeholder="6-DIGIT PIN" type="password" maxLength="6" required className="w-full bg-white/10 p-5 rounded-2xl text-center text-3xl tracking-widest outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFormData({...formData, pin: e.target.value})} />
            {error && <p className="text-red-400 text-xs text-center font-bold bg-red-400/10 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 rounded-2xl font-black shadow-xl shadow-blue-900/40">LOG IN</button>
            <button type="button" onClick={() => setIsRegister(true)} className="w-full mt-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Register New Account</button>
          </form>
        )}
      </div>
    </div>
  )
}
