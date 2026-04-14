'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [formData, setFormData] = useState({ fullName: '', lastFour: '', email: '', pin: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [crewList, setCrewList] = useState([]) // สำหรับให้เลือกชื่อ
  const router = useRouter()

  // ดึงรายชื่อพนักงานทั้งหมดมาให้เลือกตอนลงทะเบียน
  useEffect(() => {
    async function getCrews() {
      const { data } = await supabase.from('crews').select('full_name').order('full_name')
      if (data) setCrewList(data)
    }
    if (isRegister) getCrews()
  }, [isRegister])

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isRegister) {
      // ค้นหาพนักงานด้วย ชื่อ และ เลข 4 ตัวท้าย
      const { data: crew, error: fetchError } = await supabase
        .from('crews')
        .select('*')
        .eq('full_name', formData.fullName)
        .eq('last_four', formData.lastFour) // เช็ค 4 ตัวท้าย
        .single()

      if (fetchError || !crew) {
        setError('ข้อมูลไม่ถูกต้อง หรือคุณไม่มีชื่อในระบบ (ติดต่อ SO)')
        setLoading(false)
        return
      }

      // อัปเดต Email และ PIN
      const { error: updateError } = await supabase
        .from('crews')
        .update({ email: formData.email, pin: formData.pin })
        .eq('id', crew.id)

      if (updateError) setError('อีเมลนี้ถูกใช้ไปแล้ว')
      else {
        alert('ลงทะเบียนสำเร็จ! กรุณาลงชื่อเข้าใช้')
        setIsRegister(false)
      }
    } else {
      // LOGIN ด้วย Email + PIN
      const { data, error: loginError } = await supabase
        .from('crews')
        .select('*')
        .eq('email', formData.email)
        .eq('pin', formData.pin)
        .single()

      if (loginError || !data) {
        setError('อีเมล หรือ PIN ไม่ถูกต้อง')
      } else {
        localStorage.setItem('kmt_user', JSON.stringify(data))
        router.push('/ppe')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-md bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-3xl shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter italic text-blue-500">KMT PORTAL</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            {isRegister ? 'First Time Registration' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {isRegister ? (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-2 mb-1 block">Your Full Name</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-slate-300"
                  required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})}
                >
                  <option value="" className="bg-slate-900">-- Select Your Name --</option>
                  {crewList.map(c => <option key={c.full_name} value={c.full_name} className="bg-slate-900">{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-2 mb-1 block">ID Card / Passport (Last 4 Digits)</label>
                <input 
                  type="text" placeholder="Ex. 5501" maxLength="4" required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.lastFour} onChange={e => setFormData({...formData, lastFour: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-2 mb-1 block">Assign Email</label>
                <input 
                  type="email" placeholder="name@email.com" required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-2 mb-1 block">Email</label>
              <input 
                type="email" placeholder="Enter your email" required
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-2 mb-1 block">{isRegister ? 'Set 6-Digit PIN' : 'PIN'}</label>
            <input 
              type="password" maxLength="6" placeholder="••••••" required
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-2xl tracking-[0.5em] font-bold outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})}
            />
          </div>

          {error && <p className="text-red-400 text-xs text-center font-bold py-2">{error}</p>}

          <button 
            type="submit" disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black shadow-lg shadow-blue-900/40 transition-all active:scale-95"
          >
            {loading ? 'WAIT...' : isRegister ? 'REGISTER' : 'LOG IN'}
          </button>
        </form>

        <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-slate-500 text-xs font-bold hover:text-white transition-colors uppercase tracking-widest">
          {isRegister ? 'Already registered? Login' : 'First time? Register here'}
        </button>
      </div>
    </div>
  )
}
