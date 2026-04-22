'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ShieldCheck, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: crew, error } = await supabase.from('crews').select('*').eq('full_name', name).eq('pin', pin).single()
    if (crew) {
      localStorage.setItem('kmt_user', JSON.stringify(crew))
      toast.success('Login Successful')
      router.push(crew.position && ["safety officer", "chief officer", "barge master"].includes(crew.position.toLowerCase()) ? '/admin/dashboard' : '/dashboard')
    } else {
      toast.error('Invalid credentials')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <div className="flex justify-center"><ShieldCheck size={64} className="text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" /></div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">KMT Portal</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em]">Maritime Fleet Management</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-500 transition-colors" size={20} />
            <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-zinc-900 border border-orange-500/20 p-4 pl-12 rounded-2xl text-white outline-none focus:border-orange-500 transition-all font-bold" required />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-500 transition-colors" size={20} />
            <input type="password" placeholder="6-Digit PIN" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-zinc-900 border border-orange-500/20 p-4 pl-12 rounded-2xl text-white outline-none focus:border-orange-500 text-center tracking-[0.5em] text-xl font-black transition-all" required />
          </div>
          <button type="submit" disabled={loading} className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-orange-600/20 active:scale-95 transition-all">
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
        
        <p className="text-center text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Access Restricted to Authorized Personnel</p>
      </div>
    </div>
  )
}
