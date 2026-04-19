'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { BellRing, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

export function RealtimeListener() {
  useEffect(() => {
    const userStr = localStorage.getItem('kmt_user')
    if (!userStr) return;
    const user = JSON.parse(userStr)
    const isAdmin = ["safety officer", "chief officer", "barge master"].includes((user.position || "").toLowerCase());

    const requestChannel = supabase.channel('ppe-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ppe_requests' }, (payload) => {
          if (isAdmin) {
            toast('New Request Arrived!', { icon: <BellRing className="text-amber-500" />, description: 'Check Pending Approvals', duration: 8000 })
            window.dispatchEvent(new Event('new-notification'))
          }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ppe_requests', filter: `crew_id=eq.${user.id}` }, (payload) => {
          const newStatus = payload.new.status; const oldStatus = payload.old.status;
          if (newStatus === 'approved' && oldStatus !== 'approved') {
            toast.success('Request Approved!', { icon: <CheckCircle2 className="text-emerald-500"/>, description: 'Please confirm receiving in My Requests', duration: 10000 })
            window.dispatchEvent(new Event('new-notification'))
          } else if (newStatus === 'rejected' && oldStatus !== 'rejected') {
            toast.error('Request Rejected', { icon: <XCircle className="text-red-500"/>, description: 'Please contact admin' })
            window.dispatchEvent(new Event('new-notification'))
          }
      }).subscribe()

    // 🎯 เพิ่มระบบดักฟัง Inventory (เตือนตอนของใกล้หมด)
    const inventoryChannel = supabase.channel('ppe-inventory')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ppe_inventory' }, (payload) => {
          if (isAdmin) {
            const newQty = payload.new.quantity; const threshold = payload.new.threshold;
            const oldQty = payload.old.quantity;
            // ถ้าของเพิ่งลดลงจนถึงจุดวิกฤต (รอบก่อนยังไม่ถึง) ให้เด้งเตือน
            if (newQty <= threshold && oldQty > threshold) {
              toast.error('Low Stock Alert!', { 
                icon: <AlertTriangle className="text-red-500 animate-pulse"/>, 
                description: `${payload.new.item_name} has only ${newQty} left.`,
                duration: 10000 
              })
            }
          }
      }).subscribe()

    return () => { supabase.removeChannel(requestChannel); supabase.removeChannel(inventoryChannel); }
  }, [])
  return null
}
