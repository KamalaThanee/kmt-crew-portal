'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { BellRing, CheckCircle2 } from 'lucide-react'

export function NotificationListener() {
  const lastCheck = useRef(new Date().toISOString())

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    if (!user?.id) return;

    const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(user.position);

    const checkNotifications = async () => {
      try {
        if (isAdmin) {
          // แอดมิน: เช็คว่ามีคำขอใหม่ที่ถูกสร้างขึ้นหลังจากรอบที่แล้วหรือไม่
          const { count } = await supabase.from('ppe_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
            .gt('created_at', lastCheck.current)

          if (count && count > 0) {
            toast('มีคำขอเบิกอุปกรณ์ใหม่เข้า!', {
              icon: <BellRing className="text-amber-500" />,
              description: 'กรุณาตรวจสอบในหน้า Pending Approvals'
            })
            window.dispatchEvent(new Event('new-notification')) // สั่งให้กระดิ่งอัปเดตเลข
            lastCheck.current = new Date().toISOString()
          }
        } else {
          // ลูกเรือ: เช็คว่าคำขอของตัวเองถูกอัปเดตเป็น approved หลังจากรอบที่แล้วหรือไม่
          const { count } = await supabase.from('ppe_requests')
            .select('*', { count: 'exact', head: true })
            .eq('crew_id', user.id)
            .eq('status', 'approved')
            .gt('updated_at', lastCheck.current) // ต้องมั่นใจว่าใน DB ตารางนี้มีคอลัมน์ updated_at

          if (count && count > 0) {
            toast.success('คำขอเบิกอุปกรณ์ได้รับการอนุมัติแล้ว!', {
              icon: <CheckCircle2 className="text-emerald-500"/>,
              description: 'กรุณาไปรับของและกดยืนยันในหน้า My Requests',
              duration: 8000
            })
            window.dispatchEvent(new Event('new-notification'))
            lastCheck.current = new Date().toISOString()
          }
        }
      } catch (e) {
        console.error("Polling error", e)
      }
    }

    // แอบเช็คข้อมูลทุกๆ 15 วินาที
    const interval = setInterval(checkNotifications, 15000)
    
    return () => clearInterval(interval)
  }, [])

  return null
}
