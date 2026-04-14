'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('kmt_user')
      if (user) {
        router.push('/login') // หรือเปลี่ยนเป็น /ppe ถ้าต้องการให้ข้ามหน้า login
      } else {
        router.push('/login')
      }
    }
  }, [router])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">Initializing KMT Portal...</p>
      </div>
    </div>
  )
}
