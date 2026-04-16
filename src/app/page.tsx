'use client'
import Link from 'next/link'

export default function Home() {
  // ในอนาคตเราจะดึงข้อมูล User จาก Supabase เพื่อเช็คตำแหน่ง (Safety/Chief/Barge)
  // ตอนนี้ทำปุ่มทางลัดให้เข้าทดสอบระบบได้ก่อนครับ
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-black">
      <h1 className="text-3xl font-bold text-blue-900 mb-8 text-center">
        KMT Crew Portal <br/>
        <span className="text-lg font-normal text-gray-600">(Phase 2 - Admin & Traceability)</span>
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        
        {/* ส่วนของลูกเรือ */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold mb-4 text-blue-800">สำหรับลูกเรือ (Crew)</h2>
          <div className="space-y-3">
            <Link href="/selection" className="block w-full text-center bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
              📦 เบิก PPE ใหม่
            </Link>
            <Link href="/history" className="block w-full text-center bg-gray-100 text-blue-600 py-3 rounded-xl font-semibold hover:bg-gray-200 transition">
              🕒 ประวัติการเบิก / กดรับของ
            </Link>
          </div>
        </div>

        {/* ส่วนของแอดมิน */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold mb-4 text-orange-800">สำหรับแอดมิน (Admin)</h2>
          <div className="space-y-3">
            <Link href="/admin/dashboard" className="block w-full text-center bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition">
              📋 หน้าอนุมัติรายการ (Approve)
            </Link>
            <Link href="/admin/restock" className="block w-full text-center bg-gray-100 text-orange-600 py-3 rounded-xl font-semibold hover:bg-gray-200 transition">
              📥 เติมสต็อกสินค้า (Restock)
            </Link>
          </div>
        </div>

      </div>

      <footer className="mt-12 text-gray-400 text-sm">
        KMT Crew Portal v2.0 | สถานะ: กำลังทดสอบระบบ Workflow
      </footer>
    </div>
  )
}
