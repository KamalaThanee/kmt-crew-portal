'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [empId, setEmpId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: dbError } = await supabase
      .from('crews')
      .select('*')
      .eq('emp_id', empId)
      .single()

    if (dbError || !data) {
      setError('ไม่พบเลขประจำตัวพนักงานนี้ในระบบ')
      setLoading(false)
    } else {
      // เก็บข้อมูลผู้ใช้ลง LocalStorage ชั่วคราว (หรือจะใช้ Context/State ภายหลัง)
      localStorage.setItem('kmt_user', JSON.stringify(data))
      router.push('/ppe')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-sm space-y-8 bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tighter italic">KMT PORTAL</h1>
          <p className="text-slate-400 text-sm mt-2">Safety Management System</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Employee ID</label>
            <input 
              type="text" 
              required
              className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 text-center text-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Ex. 1001"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
            />
          </div>
          
          {error && <p className="text-red-400 text-xs text-center font-medium">{error}</p>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold shadow-xl shadow-blue-900/20 transition-all disabled:opacity-50"
          >
            {loading ? 'CHECKING...' : 'LOGIN TO SYSTEM'}
          </button>
        </form>
      </div>
    </div>
  )
}
