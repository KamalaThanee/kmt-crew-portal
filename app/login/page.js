'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Camera, Upload, CheckCircle2 } from 'lucide-react'

export default function AuthPage() {
  const [step, setStep] = useState(1) // 1: Select Name, 2: Profile Photo, 3: Sizes, 4: PIN & Contact
  const [isRegister, setIsRegister] = useState(false)
  const [crewList, setCrewList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  
  const [formData, setFormData] = useState({
    id: '', fullName: '', phone: '', email: '', pin: '',
    suitSize: '', suitColor: '', bootSize: '', profileImage: null
  })

  useEffect(() => {
    async function getCrews() {
      const { data } = await supabase.from('crews').select('*').order('full_name')
      if (data) setCrewList(data)
    }
    getCrews()
  }, [])

  const handleRegister = async () => {
    setLoading(true)
    // 1. Upload Image to Supabase Storage (ถ้ามีการถ่ายรูป)
    let profileUrl = ''
    if (formData.profileImage) {
      const fileExt = 'jpg'
      const fileName = `${formData.id}_${Math.random()}.${fileExt}`
      const { data, error: uploadError } = await supabase.storage
        .from('ppe_assets')
        .upload(`profiles/${fileName}`, formData.profileImage)
      if (data) {
        const { data: urlData } = supabase.storage.from('ppe_assets').getPublicUrl(`profiles/${fileName}`)
        profileUrl = urlData.publicUrl
      }
    }

    // 2. Update Crew Profile
    const { error: updateError } = await supabase
      .from('crews')
      .update({
        email: formData.email,
        pin: formData.pin,
        phone: formData.phone,
        suit_size: formData.suitSize,
        suit_color: formData.suitColor,
        boot_size: formData.bootSize,
        profile_url: profileUrl
      })
      .eq('id', formData.id)

    if (updateError) {
      setError('อีเมลนี้ถูกใช้ไปแล้ว หรือข้อมูลไม่ถูกต้อง')
      setLoading(false)
    } else {
      alert('ลงทะเบียนโปรไฟล์สำเร็จ!')
      setIsRegister(false)
      setStep(1)
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
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
      localStorage.setItem('kmt_user', JSON.stringify(data))
      router.push('/ppe')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black italic text-blue-500 tracking-tighter">KMT PORTAL</h1>
          <p className="text-slate-400 text-sm mt-2 font-bold uppercase tracking-widest">PPE Management System</p>
        </div>

        {isRegister ? (
          <div className="space-y-6">
            {/* Step 1: เลือกชื่อ */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 mb-2 block">1. Select Your Name</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    const c = crewList.find(x => x.id === e.target.value)
                    setFormData({...formData, id: c.id, fullName: c.full_name})
                  }}
                >
                  <option value="" className="bg-slate-900">-- Choose Name --</option>
                  {crewList.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.full_name}</option>)}
                </select>
                <button onClick={() => formData.id && setStep(2)} className="w-full mt-6 py-4 bg-blue-600 rounded-2xl font-bold">NEXT STEP</button>
              </div>
            )}

            {/* Step 2: รูปถ่าย Profile (Simplified) */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 text-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block">2. Profile Photo</label>
                <div className="w-40 h-40 bg-white/10 rounded-full mx-auto mb-6 flex items-center justify-center border-2 border-dashed border-white/20 overflow-hidden">
                  {formData.profileImage ? <img src={URL.createObjectURL(formData.profileImage)} className="w-full h-full object-cover" /> : <Camera size={40} className="text-slate-600" />}
                </div>
                <input type="file" accept="image/*" capture="user" className="hidden" id="cam" onChange={(e) => setFormData({...formData, profileImage: e.target.files[0]})} />
                <label htmlFor="cam" className="bg-white/10 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer border border-white/10">TAKE PHOTO / UPLOAD</label>
                <button onClick={() => setStep(3)} className="w-full mt-10 py-4 bg-blue-600 rounded-2xl font-bold">NEXT STEP</button>
              </div>
            )}

            {/* Step 3: Sizes */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 block">3. Personal Sizes</label>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Suit Size (e.g. L)" className="bg-white/5 border border-white/10 p-4 rounded-2xl" onChange={e => setFormData({...formData, suitSize: e.target.value})} />
                  <input placeholder="Suit Color" className="bg-white/5 border border-white/10 p-4 rounded-2xl" onChange={e => setFormData({...formData, suitColor: e.target.value})} />
                </div>
                <input placeholder="Safety Boots Size (e.g. 42)" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl" onChange={e => setFormData({...formData, bootSize: e.target.value})} />
                <p className="text-[10px] text-red-500 font-bold">* บันทึกแล้วแก้ไขไม่ได้ ต้องแจ้ง SO เท่านั้น</p>
                <button onClick={() => setStep(4)} className="w-full mt-6 py-4 bg-blue-600 rounded-2xl font-bold">NEXT STEP</button>
              </div>
            )}

            {/* Step 4: PIN & Submit */}
            {step === 4 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
                <input placeholder="Email" type="email" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl" onChange={e => setFormData({...formData, email: e.target.value})} />
                <input placeholder="Phone" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl" onChange={e => setFormData({...formData, phone: e.target.value})} />
                <input placeholder="Set 6-Digit PIN" type="password" maxLength="6" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-center text-2xl tracking-widest" onChange={e => setFormData({...formData, pin: e.target.value})} />
                <button onClick={handleRegister} disabled={loading} className="w-full py-4 bg-emerald-600 rounded-2xl font-bold shadow-lg shadow-emerald-900/20 uppercase tracking-tighter">Complete Registration</button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in">
            <input placeholder="Email" type="email" required className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFormData({...formData, email: e.target.value})} />
            <input placeholder="PIN" type="password" maxLength="6" required className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFormData({...formData, pin: e.target.value})} />
            {error && <p className="text-red-400 text-xs text-center font-bold">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 rounded-2xl font-bold shadow-lg shadow-blue-900/40">SIGN IN</button>
            <button type="button" onClick={() => setIsRegister(true)} className="w-full mt-4 text-slate-500 text-xs font-bold uppercase tracking-widest">First Time? Register Here</button>
          </form>
        )}
      </div>
    </div>
  )
}
