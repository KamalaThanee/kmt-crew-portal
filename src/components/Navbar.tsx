'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  if (pathname === '/login' || pathname === '/') return null // ไม่แสดงในหน้า Login

  return (
    <nav className="bg-blue-900 text-white p-4 shadow-lg">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/" className="font-bold text-xl tracking-tight text-white hover:text-blue-200 transition">
          KMT Crew Portal
        </Link>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/selection" className="hover:text-blue-300">เบิก PPE</Link>
          <Link href="/history" className="hover:text-blue-300">ประวัติ/รับของ</Link>
          <Link href="/admin/dashboard" className="text-orange-400 hover:text-orange-300 font-bold border-l pl-4 border-blue-700">Admin</Link>
          <Link href="/admin/restock" className="text-orange-400 hover:text-orange-300 font-bold">Restock</Link>
        </div>
      </div>
    </nav>
  )
}
