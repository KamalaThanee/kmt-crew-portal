'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import { supabase } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/currentUser'

export type CrewActionItem = {
  id: string
  status: string
  title: string
  description: string
  href?: string
}

export type AdminActionItem = {
  id: string
  href: string
  title: string
  description: string
  meta: string
  countLabel?: string
  tone: 'amber' | 'red' | 'violet'
  icon: typeof Clock
}

type NavbarNotificationData = {
  pending: number
  lowStock: number
  expiredCerts: number
  pendingActions?: AdminActionItem[]
  adminActions: AdminActionItem[]
  personalUpdates: CrewActionItem[]
  personalCertActions: CrewActionItem[]
  updates: CrewActionItem[]
  approvedCount: number
  personalApprovedCount: number
  personalCertAlertCount: number
}

type SeenCrewRequestStatuses = Record<string, string>
type SeenCertTriggers = Record<string, boolean>

const CERT_TRIGGER_DAYS = [7, 30, 60, 90, 180]
type CertTrigger = (typeof CERT_TRIGGER_DAYS)[number] | 'expired'

const emptyNotifications: NavbarNotificationData = {
  pending: 0,
  lowStock: 0,
  expiredCerts: 0,
  adminActions: [],
  personalUpdates: [],
  personalCertActions: [],
  updates: [],
  approvedCount: 0,
  personalApprovedCount: 0,
  personalCertAlertCount: 0,
}

function getCrewNotificationStorageKey(user: CurrentUser | null) {
  const identity = user?.id || user?.full_name || 'anonymous'
  return `kmt_crew_request_statuses_${identity}`
}

function getCertTriggerStorageKey(user: CurrentUser | null) {
  const identity = user?.id || user?.full_name || 'anonymous'
  return `kmt_cert_triggers_seen_${identity}`
}

function getCertTrigger(daysLeft: number): CertTrigger | null {
  if (daysLeft < 0) return 'expired'
  return CERT_TRIGGER_DAYS.find((day) => daysLeft <= day) || null
}

function getCertTriggerText(certName: string, trigger: CertTrigger, daysLeft: number) {
  if (trigger === 'expired') {
    return `${certName} is expired.`
  }
  return `${certName} expires in ${Math.max(0, daysLeft)} day${daysLeft === 1 ? '' : 's'}.`
}

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    const audioContext = new AudioContextClass()
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

function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  new Notification(title, {
    body,
    silent: false,
  })
}

export function useNavbarNotifications({
  user,
  isAdmin,
  pathname,
  setShowNotif,
  setShowProfile,
}: {
  user: CurrentUser | null
  isAdmin: boolean
  pathname: string
  setShowNotif: (value: boolean | ((previous: boolean) => boolean)) => void
  setShowProfile: (value: boolean) => void
}) {
  const router = useRouter()
  const [notifData, setNotifData] = useState<NavbarNotificationData>(emptyNotifications)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user?.id) return

    const fetchNotifications = async () => {
      let currentTotal = 0

      if (isAdmin) {
        const personalCountQuery = await applyPpeRequestUserFilter(
          supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).in('status', ['approved', 'rejected']),
          user,
        )

        const personalUpdatesQuery = await applyPpeRequestUserFilter(
          supabase
            .from('ppe_requests')
            .select('id, created_at, status, admin_remark, rejection_reason, reason, items')
            .in('status', ['approved', 'rejected'])
            .order('created_at', { ascending: false })
            .limit(6),
          user,
        )

        const [pendingRes, pendingRowsRes, certsRes, personalCountRes, personalUpdatesRes] = await Promise.all([
          supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase
            .from('ppe_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('crew_certs').select('id, crew_id, cert_name, expiry_date'),
          personalCountQuery,
          personalUpdatesQuery,
        ])

        const pendingCount = pendingRes.count || 0
        const pendingRows = pendingRowsRes.data || []
        const personalRows = personalUpdatesRes.data || []

        const pendingActions: AdminActionItem[] = pendingRows.map((req: any) => {
          const crewName = req.crew_name || req.requester_name || req.full_name || 'Unknown crew'
          const firstItem = req.items?.[0]?.item_name || 'PPE request'
          const itemCount = req.items?.length || 0
          const moreLabel = itemCount > 1 ? ` +${itemCount - 1} more` : ''
          return {
            id: `pending-${req.id}`,
            href: `/admin/approvals?request=${req.id}`,
            title: `${crewName} sent a PPE request`,
            description: `${firstItem}${moreLabel}`,
            meta: new Date(req.created_at).toLocaleString('en-GB'),
            countLabel: 'NEW',
            tone: 'amber',
            icon: Clock,
          }
        })

        const personalUpdates: CrewActionItem[] = personalRows.map((req: any) => {
          const itemName = req.items?.[0]?.item_name || 'PPE request'
          const approved = req.status === 'approved'
          return {
            id: req.id,
            status: req.status,
            title: approved ? 'Approved and ready to receive' : 'Request rejected',
            description: approved
              ? `${itemName} is waiting for your confirmation`
              : req.admin_remark || req.rejection_reason || `${itemName} needs your attention`,
          }
        })
        const personalApprovedCount = personalRows.filter((req: any) => req.status === 'approved').length
        const personalUpdateCount = personalCountRes.count || 0

        const myUploadedCerts = (certsRes.data || []).filter((cert: any) => String(cert.crew_id || '') === String(user.id || ''))
        const now = new Date()
        const seenCertTriggers = JSON.parse(
          localStorage.getItem(getCertTriggerStorageKey(user)) || '{}',
        ) as SeenCertTriggers
        const personalCertActions: CrewActionItem[] = myUploadedCerts
          .map((cert: any) => {
            const expiry = cert.expiry_date ? new Date(cert.expiry_date) : null
            if (!expiry || cert.expiry_date === '2099-12-31') return null
            const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / 86400000)
            const trigger = getCertTrigger(daysLeft)
            if (!trigger) return null
            const triggerKey = `${cert.id}:${trigger}`
            if (seenCertTriggers[triggerKey]) return null
            const certName = cert.cert_name || 'Certificate'
            return {
              id: triggerKey,
              status: trigger === 'expired' ? 'expired-cert' : 'warning-cert',
              title: trigger === 'expired' ? 'My certificate expired' : `My certificate ${trigger}-day alert`,
              description: getCertTriggerText(certName, trigger, daysLeft),
              href: `/certificates?tab=personal&personal=${trigger === 'expired' ? 'expired' : 'warning'}`,
            }
          })
          .filter(Boolean)
          .slice(0, 4) as CrewActionItem[]
        const personalCertAlertCount = personalCertActions.length

        setNotifData({
          pending: pendingCount,
          lowStock: 0,
          expiredCerts: 0,
          pendingActions,
          adminActions: [],
          personalUpdates,
          personalCertActions,
          updates: [],
          approvedCount: 0,
          personalApprovedCount,
          personalCertAlertCount,
        })
        currentTotal = pendingCount + personalUpdateCount + personalCertAlertCount
      } else {
        const countQuery = await applyPpeRequestUserFilter(
          supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).in('status', ['approved', 'rejected']),
          user,
        )

        const updatesQuery = await applyPpeRequestUserFilter(
          supabase
            .from('ppe_requests')
            .select('id, created_at, status, admin_remark, rejection_reason, reason, items')
            .in('status', ['approved', 'rejected'])
            .order('created_at', { ascending: false })
            .limit(6),
          user,
        )

        const [myCertsRes, { count }, { data: updates }] = await Promise.all([
          supabase.from('crew_certs').select('id, cert_name, expiry_date').eq('crew_id', user.id),
          countQuery,
          updatesQuery,
        ])
        const rows = updates || []
        const statusStorageKey = getCrewNotificationStorageKey(user)
        const previousStatuses = JSON.parse(
          localStorage.getItem(statusStorageKey) || '{}',
        ) as SeenCrewRequestStatuses
        const nextStatuses: SeenCrewRequestStatuses = {}
        let hasNewCrewAction = false
        const actionItems: CrewActionItem[] = rows.map((req: any) => {
          const itemName = req.items?.[0]?.item_name || 'PPE request'
          const approved = req.status === 'approved'
          nextStatuses[String(req.id)] = String(req.status || '')
          return {
            id: req.id,
            status: req.status,
            title: approved ? 'Approved and ready to receive' : 'Request rejected',
            description: approved
              ? `${itemName} is waiting for your confirmation`
              : req.admin_remark || req.rejection_reason || `${itemName} needs your attention`,
          }
        })

        const approvedCount = rows.filter((req: any) => req.status === 'approved').length
        const now = new Date()
        const seenCertTriggers = JSON.parse(
          localStorage.getItem(getCertTriggerStorageKey(user)) || '{}',
        ) as SeenCertTriggers
        const personalCertActions: CrewActionItem[] = (myCertsRes.data || [])
          .map((cert: any) => {
            const expiry = cert.expiry_date ? new Date(cert.expiry_date) : null
            if (!expiry || cert.expiry_date === '2099-12-31') return null
            const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / 86400000)
            const trigger = getCertTrigger(daysLeft)
            if (!trigger) return null
            const triggerKey = `${cert.id}:${trigger}`
            if (seenCertTriggers[triggerKey]) return null
            const certName = cert.cert_name || 'Certificate'
            return {
              id: triggerKey,
              status: trigger === 'expired' ? 'expired-cert' : 'warning-cert',
              title: trigger === 'expired' ? 'My certificate expired' : `My certificate ${trigger}-day alert`,
              description: getCertTriggerText(certName, trigger, daysLeft),
              href: `/certificates?tab=personal&personal=${trigger === 'expired' ? 'expired' : 'warning'}`,
            }
          })
          .filter(Boolean)
          .slice(0, 4) as CrewActionItem[]
        const personalCertAlertCount = personalCertActions.length

        if (Object.keys(previousStatuses).length > 0) {
          const newlyApproved = rows.filter(
            (req: any) => req.status === 'approved' && previousStatuses[String(req.id)] !== 'approved',
          )
          const newlyRejected = rows.filter(
            (req: any) => req.status === 'rejected' && previousStatuses[String(req.id)] !== 'rejected',
          )

          if (newlyApproved.length > 0) {
            hasNewCrewAction = true
            const firstItem = newlyApproved[0]?.items?.[0]?.item_name || 'PPE request'
            const moreLabel = newlyApproved.length > 1 ? ` and ${newlyApproved.length - 1} more` : ''
            toast.success('Request Approved!', {
              icon: <CheckCircle2 className="text-emerald-500" />,
              description: `${firstItem}${moreLabel} is ready for you to receive in My Requests.`,
              duration: 10000,
              action: {
                label: 'Open',
                onClick: () => router.push('/my-requests'),
              },
            })
            playNotificationSound()
            showBrowserNotification(
              'Request Approved',
              `${firstItem}${moreLabel} is ready for you to confirm receipt in My Requests.`,
            )
          }

          if (newlyRejected.length > 0) {
            hasNewCrewAction = true
            const firstItem = newlyRejected[0]?.items?.[0]?.item_name || 'PPE request'
            toast.error('Request Rejected', {
              icon: <XCircle className="text-red-500" />,
              description: `${firstItem} needs your attention. Check My Requests for details.`,
              duration: 10000,
              action: {
                label: 'Open',
                onClick: () => router.push('/my-requests'),
              },
            })
            playNotificationSound()
            showBrowserNotification('Request Rejected', `${firstItem} needs your attention in My Requests.`)
          }
        }

        localStorage.setItem(statusStorageKey, JSON.stringify(nextStatuses))
        if (hasNewCrewAction) {
          window.dispatchEvent(new Event('new-notification'))
        }

        setNotifData({
          pending: count || 0,
          lowStock: 0,
          expiredCerts: 0,
          personalCertActions,
          updates: actionItems,
          approvedCount,
          personalCertAlertCount,
          adminActions: [],
          personalUpdates: [],
          personalApprovedCount: 0,
        })
        currentTotal = (count || 0) + personalCertAlertCount
      }

      const lastSeenTotal = parseInt(localStorage.getItem('kmt_notif_seen') || '0')
      const unread = currentTotal > lastSeenTotal ? currentTotal - lastSeenTotal : 0
      setUnreadCount(unread)
    }

    fetchNotifications()
    const handleNewNotif = () => fetchNotifications()
    const handleFocus = () => fetchNotifications()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
      }
    }
    const interval = window.setInterval(fetchNotifications, 15000)
    window.addEventListener('new-notification', handleNewNotif)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('new-notification', handleNewNotif)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user, isAdmin, pathname, router])

  const handleOpenNotif = useCallback(() => {
    setShowProfile(false)
    setShowNotif((previous) => {
      const isOpening = !previous

      if (isOpening) {
        const total =
          notifData.pending + notifData.lowStock + notifData.expiredCerts + (notifData.personalCertAlertCount || 0)
        localStorage.setItem('kmt_notif_seen', total.toString())
        if ((notifData.personalCertActions || []).length > 0) {
          const storageKey = getCertTriggerStorageKey(user)
          const seen = JSON.parse(localStorage.getItem(storageKey) || '{}') as SeenCertTriggers
          for (const item of notifData.personalCertActions) {
            seen[item.id] = true
          }
          localStorage.setItem(storageKey, JSON.stringify(seen))
        }
        setUnreadCount(0)
      }

      return isOpening
    })
  }, [notifData, setShowNotif, setShowProfile, user])

  return { notifData, unreadCount, handleOpenNotif }
}
