'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-black">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-blue-900 mb-2">KMT Portal</h1>
        <p className="text-gray-500">เลือกเมนูที่ต้องการใช้งาน</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* User Section */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-blue-50 hover:scale-[1.02] transition-transform">
          <h2 className="text-2xl font-bold mb-6 text-blue-800 flex items-center gap-2">📦 สำหรับลูกเรือ</h2>
          <div className="space-y-4">
            <Link href="/selection" className="block w-full text-center bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700">เบิก PPE ใหม่</Link>
            <Link href="/history" className="block w-full text-center bg-gray-50 text-blue-700 py-4 rounded-2xl font-bold border border-blue-100 hover:bg-blue-100">ประวัติการเบิก / รับของ</Link>
          </div>
        </div>

        {/* Admin Section */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-orange-50 hover:scale-[1.02] transition-transform">
          <h2 className="text-2xl font-bold mb-6 text-orange-800 flex items-center gap-2">🛡️ สำหรับแอดมิน</h2>
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="block w-full text-center bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700">หน้าอนุมัติ (Approve)</Link>
            <Link href="/admin/restock" className="block w-full text-center bg-gray-50 text-orange-700 py-4 rounded-2xl font-bold border border-orange-100 hover:bg-orange-100">เติมของ (Restock)</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
