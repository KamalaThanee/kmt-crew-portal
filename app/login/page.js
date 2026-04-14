'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Search, Lock, User as UserIcon, ChevronDown, Loader2, UserPlus } from 'lucide-react'

export default function LoginPage() {
  const [crews, setCrews] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCrew, setSelectedCrew] = useState(null)
  const [pin, setPin] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchCrews() {
      const { data } = await supabase.from('crews').select('*').order('full_name')
      if (data) setCrews(data)
    }
    fetchCrews()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!selectedCrew || pin.length !== 6) return
    setLoading(true)
    setError('')

    // ตรวจสอบ PIN (แปลงเป็น String ทั้งคู่เพื่อกันพลาด)
    const dbPin = (selectedCrew.pin_code || selectedCrew.pin || "").toString()
    
    if (dbPin === pin.toString()) {
      localStorage.setItem('kmt_user', JSON.stringify(selectedCrew))
      router.push('/ppe')
    } else {
      setError('PIN Code ไม่ถูกต้อง')
      setPin('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center p-6">
      <div className="max-w-md mx-auto w-full space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-blue-500">KMT PPE</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">Crew Access Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-4 mb-2 block">Name</label>
            <div onClick={() => setShowDropdown(!showDropdown)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl flex justify-between items-center cursor-pointer">
              <div className="flex items-center gap-3">
                <UserIcon size={20} className="text-blue-500" />
                <span className={selectedCrew ? "text-white font-bold" : "text-slate-500"}>
                  {selectedCrew ? selectedCrew.full_name : "ค้นหาชื่อของคุณ..."}
                </span>
              </div>
              <ChevronDown size={20} className="text-slate-600" />
            </div>
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-slate-900 border-b border-white/5">
                  <input autoFocus className="w-full bg-black/40 p-3 rounded-xl text-sm outline-none border border-white/10" placeholder="พิมพ์ชื่อ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {crews.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(crew => (
                  <div key={crew.id} onClick={() => { setSelectedCrew(crew); setShowDropdown(false); }} className="p-4 hover:bg-blue-600 cursor-pointer text-sm font-bold border-b border-white/5">{crew.full_name}</div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase ml-4 mb-2 block">6-Digit PIN</label>
            <input type="password" maxLength={6} inputMode="numeric" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[1em] font-black text-2xl" placeholder="••••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </div>
          {error && <div className="text-red-500 text-[10px] font-black text-center uppercase p-3 bg-red-500/5 rounded-xl border border-red-500/20">{error}</div>}
          <button type="submit" disabled={!selectedCrew || pin.length !== 6 || loading} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest active:scale-95 disabled:opacity-20 transition-all flex justify-center">
            {loading ? <Loader2 className="animate-spin"/> : "Login"}
          </button>
        </form>
        <div className="pt-4 flex flex-col items-center gap-4">
          <div className="w-full h-[1px] bg-white/5"></div>
          <button onClick={() => router.push('/register')} className="flex items-center gap-2 text-blue-500 font-black text-sm uppercase tracking-wider hover:text-blue-400">
            <UserPlus size={18} /> Register New Crew
          </button>
        </div>
      </div>
    </div>
  )
}
