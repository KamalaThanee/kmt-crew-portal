'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function RegisterPage() {
  const [formData, setFormData] = useState({ full_name: '', position: '', pin_code: '', suit_size: '', suit_color: '', boot_size: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('crews').insert([formData])
    if (!error) {
      alert('ลงทะเบียนสำเร็จ!')
      router.push('/login')
    } else {
      alert('Error: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col justify-center">
      <div className="max-w-md mx-auto w-full space-y-8">
        <button onClick={() => router.push('/login')} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase"><ArrowLeft size={16}/> Back</button>
        <h1 className="text-3xl font-black italic uppercase text-blue-500 text-center">Registration</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          <input required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl" placeholder="Full Name" onChange={(e) => setFormData({...formData, full_name: e.target.value})}/>
          <input required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl" placeholder="Position" onChange={(e) => setFormData({...formData, position: e.target.value})}/>
          <input required maxLength={6} className="w-full bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl text-center font-black tracking-[1em]" placeholder="6-PIN" onChange={(e) => setFormData({...formData, pin_code: e.target.value})}/>
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-white/5 border border-white/10 p-4 rounded-xl" placeholder="Suit Size" onChange={(e) => setFormData({...formData, suit_size: e.target.value})}/>
            <input className="bg-white/5 border border-white/10 p-4 rounded-xl" placeholder="Suit Color" onChange={(e) => setFormData({...formData, suit_color: e.target.value})}/>
          </div>
          <input className="w-full bg-white/5 border border-white/10 p-4 rounded-xl" placeholder="Boot Size" onChange={(e) => setFormData({...formData, boot_size: e.target.value})}/>
          <button disabled={loading} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase">
            {loading ? <Loader2 className="animate-spin mx-auto"/> : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  )
}
