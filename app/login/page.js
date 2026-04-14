'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Search, Lock, User as UserIcon, ChevronDown, Loader2 } from 'lucide-react'

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

  const filteredCrews = crews.filter(c => 
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!selectedCrew || pin.length !== 6) return
    setLoading(true)
    setError('')

    // ตรวจสอบ PIN กับข้อมูลใน Database (คอลัมน์ pin_code)
    if (selectedCrew.pin_code === pin) {
      localStorage.setItem('kmt_user', JSON.stringify(selectedCrew))
      router.push('/ppe')
    } else {
      setError('Invalid PIN Code')
      setPin('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center p-6 font-sans">
      <div className="max-w-md mx-auto w-full space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-block p-4 bg-blue-600/10 rounded-[2rem] border border-blue-500/20 mb-2">
            <Lock className="text-blue-500" size={32} />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter italic uppercase">KMT PPE</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">Crew Access Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* ส่วนเลือกชื่อ */}
          <div className="relative">
            <label className="text-[10px] font-black text-blue-400 uppercase ml-4 mb-2 block tracking-widest">Select Your Name</label>
            <div 
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-3">
                <UserIcon size={20} className="text-slate-500" />
                <span className={selectedCrew ? "text-white font-bold" : "text-slate-500 font-medium"}>
                  {selectedCrew ? selectedCrew.full_name : "Search for your name..."}
                </span>
              </div>
              <ChevronDown size={20} className={`text-slate-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </div>

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl z-50 max-h-72 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/5 bg-white/5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      autoFocus
                      type="text"
                      className="w-full bg-slate-950 p-3 pl-10 rounded-xl text-sm outline-none border border-white/10 focus:border-blue-500 transition-all"
                      placeholder="Type to filter..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto">
                  {filteredCrews.length > 0 ? filteredCrews.map(crew => (
                    <div 
                      key={crew.id}
                      onClick={() => {
                        setSelectedCrew(crew);
                        setShowDropdown(false);
                        setSearchTerm('');
                      }}
                      className="p-5 hover:bg-blue-600 cursor-pointer text-sm font-bold border-b border-white/5 last:border-none flex justify-between items-center group"
                    >
                      <span>{crew.full_name}</span>
                      <span className="text-[9px] text-slate-500 group-hover:text-blue-200 uppercase">{crew.position}</span>
                    </div>
                  )) : (
                    <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase italic">No crew found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ส่วนใส่ PIN 6 หลัก */}
          <div className={!selectedCrew ? "opacity-20 pointer-events-none transition-opacity" : "transition-opacity"}>
            <label className="text-[10px] font-black text-blue-400 uppercase ml-4 mb-2 block tracking-widest">Enter 6-Digit PIN</label>
            <div className="relative">
              <input 
                type="password"
                maxLength={6}
                inputMode="numeric"
                placeholder="••••••"
                className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-blue-500 text-center tracking-[1.2em] font-black text-2xl placeholder:text-slate-800"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-[10px] font-black text-center uppercase tracking-widest animate-shake">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={!selectedCrew || pin.length !== 6 || loading}
            className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/40 active:scale-95 disabled:opacity-10 transition-all flex justify-center items-center"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Access Portal"}
          </button>
        </form>
      </div>
    </div>
  )
}
