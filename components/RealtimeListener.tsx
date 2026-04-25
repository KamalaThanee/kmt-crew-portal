'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { matchesPpeRequestUser } from '@/lib/ppeRequests'
import { toast } from 'sonner'
import { BellRing, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

export function RealtimeListener() {
  useEffect(() => {
    const originalTitle = document.title

    const bumpTitleBadge = () => {
      const currentMatch = document.title.match(/^\((\d+)\)\s+/)
      const currentCount = currentMatch ? Number(currentMatch[1]) : 0
      const nextCount = currentCount + 1
      document.title = `(${nextCount}) ${originalTitle.replace(/^\(\d+\)\s+/, '')}`
    }

    const playNotificationSound = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
        gainNode.gain.setValueAtTime(0.001, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02)
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3)

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.3)
      } catch {
        // Ignore browsers that block autoplay audio.
      }
    }

    const showBrowserNotification = (title: string, body: string) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return
      if (Notification.permission !== 'granted') return

      new Notification(title, {
        body,
        silent: false,
      })
    }

    const userStr = localStorage.getItem('kmt_user')
    if (!userStr) return;
    const user = JSON.parse(userStr)
    const isAdmin = ["safety officer", "chief officer", "barge master"].includes((user.position || "").toLowerCase());

    const requestChannel = supabase.channel('ppe-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ppe_requests' }, (payload) => {
          if (isAdmin) {
            toast('New Request Arrived!', { icon: <BellRing className="text-amber-500" />, description: 'Check Pending Approvals', duration: 8000 })
            playNotificationSound()
            bumpTitleBadge()
            showBrowserNotification('New PPE Request', 'A new request is waiting for approval.')
            window.dispatchEvent(new Event('new-notification'))
          }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ppe_requests' }, async (payload) => {
          const isOwner = await matchesPpeRequestUser(payload.new, user)
          if (!isOwner) return

          const newStatus = payload.new.status; const oldStatus = payload.old.status;
          if (newStatus === 'approved' && oldStatus !== 'approved') {
            toast.success('Request Approved!', { icon: <CheckCircle2 className="text-emerald-500"/>, description: 'Please confirm receiving in My Requests', duration: 10000 })
            playNotificationSound()
            bumpTitleBadge()
            showBrowserNotification('Request Approved', 'Please confirm receiving in My Requests.')
            window.dispatchEvent(new Event('new-notification'))
          } else if (newStatus === 'rejected' && oldStatus !== 'rejected') {
            toast.error('Request Rejected', { icon: <XCircle className="text-red-500"/>, description: 'Please contact admin' })
            playNotificationSound()
            bumpTitleBadge()
            showBrowserNotification('Request Rejected', 'Please contact admin for details.')
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
              playNotificationSound()
              bumpTitleBadge()
              showBrowserNotification('Low Stock Alert', `${payload.new.item_name} has only ${newQty} left.`)
            }
          }
      }).subscribe()

    return () => {
      document.title = originalTitle
      supabase.removeChannel(requestChannel)
      supabase.removeChannel(inventoryChannel)
    }
  }, [])
  return null
}
