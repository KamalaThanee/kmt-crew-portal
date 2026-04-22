'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ShieldCheck, Lock, User, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    // ถ้าเคยล็อกอินค้างไว้แล้ว ให้เตะไปหน้า Dashboard เลย
    const user = localStorage.getItem('kmt_user')
    if (user) {
      const u = JSON.parse(user)
      const isAdmin = ["safety officer", "chief officer", "barge master"].includes((u.position || "").toLowerCase())
      router.push(isAdmin ? '/admin/dashboard' : '/dashboard')
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() === '' || pin.length < 6) {
      toast.error('กรุณากรอกชื่อและ PIN 6 หลักให้ครบถ้วน')
      return
    }

    setLoading(true)
    try {
      // 🎯 ตรวจสอบพนักงานจากชื่อและ PIN ในตาราง crews
      const { data: crew, error } = await supabase
        .from('crews')
        .select('*')
        .eq('full_name', name.trim())
        .eq('pin', pin)
        .single()

      if (error || !crew) {
        toast.error('ชื่อพนักงานหรือ PIN ไม่ถูกต้อง')
      } else {
        localStorage.setItem('kmt_user', JSON.stringify(crew))
        toast.success(`ยินดีต้อนรับคุณ ${crew.full_name}`)
        
        // เช็คตำแหน่งเพื่อส่งไปหน้าที่ถูกต้อง
        const isAdmin = ["safety officer", "chief officer", "barge master"].includes((crew.position || "").toLowerCase())
        router.push(isAdmin ? '/admin/dashboard' : '/dashboard')
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-10 animate-in fade-in zoom-in duration-700">
        
        {/* Logo Section */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-5 bg-orange-600/10 rounded-[32px] border border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
              <ShieldCheck size={56} className="text-orange-500" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">KMT Portal</h1>
            <p className="text-orange-500/60 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Vessel Management System</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Full Name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full bg-zinc-900/50 border border-white/5 p-4 pl-12 rounded-2xl text-white outline-none focus:border-orange-500/50 focus:bg-zinc-900 transition-all font-bold placeholder:text-zinc-700" 
              required 
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-500 transition-colors" size={18} />
            <input 
              type="password" 
              inputMode="numeric"
              maxLength={6}
              placeholder="6-Digit PIN" 
              value={pin} 
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
              className="w-full bg-zinc-900/50 border border-white/5 p-4 pl-12 rounded-2xl text-white outline-none focus:border-orange-500/50 focus:bg-zinc-900 text-center tracking-[0.8em] text-2xl font-black transition-all placeholder:text-zinc-700 placeholder:tracking-normal placeholder:text-sm" 
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-orange-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>
        
        {/* Footer info */}
        <div className="text-center space-y-4">
          <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">Authorized Access Only</p>
          <div className="h-[1px] w-12 bg-orange-500/20 mx-auto"></div>
          <p className="text-[9px] text-zinc-800 font-bold uppercase">Kamala Thanee Co., Ltd.</p>
        </div>
      </div>
    </div>
  )
}
