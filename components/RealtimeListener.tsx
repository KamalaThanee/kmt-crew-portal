'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { BellRing, CheckCircle2, XCircle } from 'lucide-react'

export function RealtimeListener() {
  useEffect(() => {
    const userStr = localStorage.getItem('kmt_user')
    if (!userStr) return;
    const user = JSON.parse(userStr)

    const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(user.position);

    // เปิดช่องสัญญาณ Realtime ไปที่ Supabase
    const channel = supabase.channel('ppe-realtime-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ppe_requests' },
        (payload) => {
          // ถ้ามีข้อมูลใหม่ insert เข้ามา แอดมินจะเด้งเตือนทันที!
          if (isAdmin) {
            toast('มีคำขอเบิกอุปกรณ์ใหม่เข้า!', {
              icon: <BellRing className="text-amber-500" />,
              description: 'กรุณาตรวจสอบในหน้า Pending Approvals',
              duration: 8000
            })
            window.dispatchEvent(new Event('new-notification'))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ppe_requests', filter: `crew_id=eq.${user.id}` },
        (payload) => {
          // ถ้ามีการ Update ข้อมูลของตัวเอง (ลูกเรือคนนั้นๆ)
          const newStatus = payload.new.status;
          const oldStatus = payload.old.status;
          
          if (newStatus === 'approved' && oldStatus !== 'approved') {
            toast.success('คำขอเบิกอุปกรณ์ได้รับการอนุมัติแล้ว!', {
              icon: <CheckCircle2 className="text-emerald-500"/>,
              description: 'กรุณาไปรับของและกดยืนยันในหน้า My Requests',
              duration: 10000 
            })
            window.dispatchEvent(new Event('new-notification'))
          } else if (newStatus === 'rejected' && oldStatus !== 'rejected') {
            toast.error('คำขอเบิกอุปกรณ์ถูกปฏิเสธ', {
              icon: <XCircle className="text-red-500"/>,
              description: 'โปรดติดต่อผู้ดูแลระบบ'
            })
            window.dispatchEvent(new Event('new-notification'))
          }
        }
      )
      .subscribe()

    // คืนค่าเมื่อปิดหน้าเว็บ
    return () => { supabase.removeChannel(channel) }
  }, [])

  return null
}
