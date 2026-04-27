'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdminRole } from '@/lib/roles'
import { toast } from 'sonner'
import { ChevronDown, Loader2, Lock, Search, ShieldCheck, User, UserPlus } from 'lucide-react'

const isCrewActive = (crew: any) => crew?.is_active !== false && !crew?.resigned_at

export default function LoginPage() {
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [crews, setCrews] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedCrew, setSelectedCrew] = useState<any>(null)
  const [pin, setPin] = useState('')

  useEffect(() => {
    setMounted(true)

    const fetchRegisteredCrews = async () => {
      const { data } = await supabase.from('crews').select('*').not('pin', 'is', null).order('full_name')
      if (data) setCrews(data.filter(isCrewActive))
    }

    fetchRegisteredCrews()

    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCrews = crews.filter((crew) =>
    String(crew.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!selectedCrew || pin.length !== 6) {
      toast.error('Please select your name and enter a 6-digit PIN')
      return
    }

    setLoading(true)

    try {
      const { data: crew, error } = await supabase
        .from('crews')
        .select('*')
        .eq('id', selectedCrew.id)
        .eq('pin', pin)
        .single()

      if (error || !crew) {
        toast.error('Incorrect PIN')
        return
      }

      if (!isCrewActive(crew)) {
        toast.error('This crew account is marked as resigned')
        return
      }

      const resolvedCrew = {
        ...selectedCrew,
        ...crew,
        position: crew.position || selectedCrew.position || '',
      }

      localStorage.setItem('kmt_user', JSON.stringify(resolvedCrew))
      toast.success(`Welcome ${resolvedCrew.full_name}`)
      router.push(isAdminRole(resolvedCrew.position) ? '/admin/dashboard' : '/dashboard')
    } catch {
      toast.error('Unable to sign in right now')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-5 bg-orange-600/10 rounded-[32px] border border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.15)]">
              <ShieldCheck size={56} className="text-orange-500" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">KMT Portal</h1>
            <p className="text-orange-500/60 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Operations Login</p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div className="relative" ref={dropdownRef}>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Personnel Name</label>
            <div
              className={`w-full bg-zinc-900 border ${isDropdownOpen ? 'border-orange-500' : 'border-white/5'} p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all`}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <User className="text-zinc-600 shrink-0" size={18} />
                <span className={`font-bold truncate ${selectedCrew ? 'text-white' : 'text-zinc-600'}`}>
                  {selectedCrew ? selectedCrew.full_name : 'Select your name...'}
                </span>
              </div>
              <ChevronDown className={`text-zinc-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} size={18} />
            </div>

            {isDropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b border-white/5 bg-black/20">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search name..."
                      className="w-full bg-zinc-800 border-none p-2 pl-9 rounded-xl text-xs text-white outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredCrews.length > 0 ? (
                    filteredCrews.map((crew) => (
                      <button
                        key={crew.id}
                        type="button"
                        className="w-full p-4 hover:bg-orange-600 text-white cursor-pointer transition-colors border-b border-white/5 last:border-0 text-left"
                        onClick={() => {
                          setSelectedCrew(crew)
                          setIsDropdownOpen(false)
                          setSearchTerm('')
                        }}
                      >
                        <p className="text-sm font-bold leading-none">{crew.full_name}</p>
                        <p className="text-[10px] opacity-60 uppercase mt-1">{crew.position}</p>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center text-zinc-600 text-[10px] uppercase font-bold">No registered crew found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 block">Security PIN</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-500 transition-colors" size={18} />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="******"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-zinc-900 border border-white/5 p-4 pl-12 rounded-2xl text-white outline-none focus:border-orange-500 text-center tracking-[0.8em] text-2xl font-black transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !selectedCrew}
            className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-orange-600/20 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>

        <div className="pt-6 border-t border-white/5 text-center space-y-4">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">New to the portal?</p>
          <button
            onClick={() => router.push('/register')}
            className="inline-flex items-center gap-2 text-xs font-black text-orange-500 hover:text-orange-400 transition-colors uppercase tracking-widest"
          >
            <UserPlus size={16} />
            Create Crew Account
          </button>
        </div>

        <div className="text-center">
          <p className="text-[9px] text-zinc-800 font-bold uppercase">Kamala Thanee Crew Operations</p>
        </div>
      </div>
    </div>
  )
}
