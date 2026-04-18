'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { BellRing, CheckCircle2 } from 'lucide-react'

export function RealtimeListener() {
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    if (!user?.id) return;

    const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(user.position);

    // สร้างช่องดักฟังการเปลี่ยนแปลงของตาราง ppe_requests
    const channel = supabase.channel('realtime_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ppe_requests' },
        (payload) => {
          // ถ้าเป็น Admin ให้แจ้งเตือนว่ามีคนเบิกของใหม่
          if (isAdmin) {
            toast('มีคำขอเบิกอุปกรณ์ใหม่เข้า!', {
              icon: <BellRing className="text-amber-500" />,
              description: 'กรุณาตรวจสอบในหน้า Approvals'
            })
            // ยิง Event ให้อัปเดตตัวเลขแจ้งเตือนที่ระฆัง
            window.dispatchEvent(new Event('new-notification'))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ppe_requests', filter: `crew_id=eq.${user.id}` },
        (payload) => {
          // ถ้าเป็นลูกเรือ และคำขอของตัวเองเปลี่ยนสถานะ
          const newStatus = payload.new.status;
          const oldStatus = payload.old.status;
          
          if (newStatus === 'approved' && oldStatus !== 'approved') {
            toast.success('คำขอเบิกอุปกรณ์ได้รับการอนุมัติแล้ว!', {
              icon: <CheckCircle2 className="text-emerald-500"/>,
              description: 'กรุณาไปรับของและกดยืนยันในหน้า My Requests',
              duration: 10000 // ค้างไว้นานหน่อย
            })
          } else if (newStatus === 'rejected' && oldStatus !== 'rejected') {
            toast.error('คำขอเบิกอุปกรณ์ถูกปฏิเสธ', {
              description: 'โปรดติดต่อผู้ดูแลระบบ'
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return null // Component นี้ไม่มี UI ทำหน้าที่ดักฟังอยู่หลังบ้าน
}
