'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, FileUp, ShipWheel, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { CurrentUser } from '@/lib/currentUser'
import {
  getCrewNotificationStorageKey,
  playNotificationSound,
  showBrowserNotification,
  type CrewActionItem,
} from '@/lib/navbarNotifications'

export type { CrewActionItem } from '@/lib/navbarNotifications'

export type AdminActionItem = {
  id: string
  href: string
  title: string
  description: string
  meta: string
  countLabel?: string
  tone: 'amber' | 'red' | 'violet' | 'sky'
  icon: typeof Clock
}

export type NavbarNotificationData = {
  pending: number
  lowStock: number
  expiredCerts: number
  ppeSizeActions: CrewActionItem[]
  pendingActions?: AdminActionItem[]
  shipCertActions: CrewActionItem[]
  adminActions: AdminActionItem[]
  personalUpdates: CrewActionItem[]
  personalCertActions: CrewActionItem[]
  updates: CrewActionItem[]
  approvedCount: number
  personalApprovedCount: number
  personalCertAlertCount: number
  ppeSizeAlertCount: number
  shipCertAlertCount: number
}

type SeenCrewRequestStatuses = Record<string, string>
type PpeSizeWindow = {
  id?: string
  title?: string | null
  deadline_at?: string | null
}

const emptyNotifications: NavbarNotificationData = {
  pending: 0,
  lowStock: 0,
  expiredCerts: 0,
  ppeSizeActions: [],
  shipCertActions: [],
  adminActions: [],
  personalUpdates: [],
  personalCertActions: [],
  updates: [],
  approvedCount: 0,
  personalApprovedCount: 0,
  personalCertAlertCount: 0,
  ppeSizeAlertCount: 0,
  shipCertAlertCount: 0,
}

function buildPpeSizeActions(windowRow: PpeSizeWindow | null, user: CurrentUser | null): CrewActionItem[] {
  if (!windowRow?.id || !user?.id) return []
  if (String((user as any).ppe_size_confirmed_window_id || '') === String(windowRow.id)) return []

  const deadline = windowRow.deadline_at ? `Deadline ${new Date(windowRow.deadline_at).toLocaleString('en-GB')}` : 'Boiler suit and safety boots survey'
  return [{
    id: `ppe-size-${windowRow.id}`,
    status: 'ppe-size',
    title: windowRow.title || 'Confirm PPE sizes',
    description: deadline,
    href: '/dashboard?ppe=size#ppe-size-update',
  }]
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
      let adminUploadUnread = 0
      const params = new URLSearchParams({
        userId: String(user.id || ''),
        fullName: String(user.full_name || ''),
        isAdmin: isAdmin ? 'true' : 'false',
      })
      const response = await fetch(`/api/navbar-notifications?${params.toString()}`, {
        cache: 'no-store',
        headers: isAdmin
          ? {
              'x-kmt-user-id': String(user.id || ''),
              'x-kmt-pin': String(user.pin || ''),
            }
          : undefined,
      })
      const payload = await response.json()
      if (!response.ok) return

      if (isAdmin) {
        const pendingActions: AdminActionItem[] = (payload.pendingActions || []).map((item: any) => ({
          ...item,
          icon: Clock,
        }))
        const personalUpdates: CrewActionItem[] = payload.personalUpdates || []
        const personalApprovedCount = payload.personalApprovedCount || 0
        const ppeSizeActions: CrewActionItem[] = payload.ppeSizeActions || []
        const ppeSizeAlertCount = payload.ppeSizeAlertCount || 0
        const adminActions: AdminActionItem[] = (payload.adminActions || []).map((item: any) => ({
          ...item,
          icon: item.icon === 'ship' ? ShipWheel : FileUp,
        }))
        const seenUploadKey = `kmt_admin_upload_notif_seen_${user.id}`
        const storedSeenUploadIds = localStorage.getItem(seenUploadKey)
        if (storedSeenUploadIds === null) {
          localStorage.setItem(seenUploadKey, JSON.stringify(adminActions.map((item) => item.id)))
        } else {
          const seenUploadIds = new Set<string>(JSON.parse(storedSeenUploadIds || '[]'))
          adminUploadUnread = adminActions.filter((item) => !seenUploadIds.has(item.id)).length
        }

        setNotifData({
          pending: payload.pending || 0,
          lowStock: 0,
          expiredCerts: 0,
          ppeSizeActions,
          pendingActions,
          shipCertActions: [],
          adminActions,
          personalUpdates,
          personalCertActions: [],
          updates: [],
          approvedCount: 0,
          personalApprovedCount,
          personalCertAlertCount: 0,
          ppeSizeAlertCount,
          shipCertAlertCount: 0,
        })
        currentTotal = ppeSizeAlertCount
      } else {
        const rows = payload.updates || []
        const statusStorageKey = getCrewNotificationStorageKey(user)
        const previousStatuses = JSON.parse(
          localStorage.getItem(statusStorageKey) || '{}',
        ) as SeenCrewRequestStatuses
        const nextStatuses: SeenCrewRequestStatuses = {}
        let hasNewCrewAction = false
        const actionItems: CrewActionItem[] = rows.map((req: any) => {
          const approved = req.status === 'approved'
          nextStatuses[String(req.id)] = String(req.status || '')
          return req
        })

        const approvedCount = rows.filter((req: any) => req.status === 'approved').length
        const ppeSizeActions: CrewActionItem[] = payload.ppeSizeActions || []
        const ppeSizeAlertCount = payload.ppeSizeAlertCount || 0

        if (Object.keys(previousStatuses).length > 0) {
          const newlyApproved = rows.filter(
            (req: any) => req.status === 'approved' && previousStatuses[String(req.id)] !== 'approved',
          )
          const newlyRejected = rows.filter(
            (req: any) => req.status === 'rejected' && previousStatuses[String(req.id)] !== 'rejected',
          )

          if (newlyApproved.length > 0) {
            hasNewCrewAction = true
            const firstItem = newlyApproved[0]?.items?.[0]?.item_name || 'PPE item'
            const moreLabel = newlyApproved.length > 1 ? ` and ${newlyApproved.length - 1} more` : ''
            toast.success('PPE Ready to Receive', {
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
              'PPE Ready to Receive',
              `${firstItem}${moreLabel} is ready for you to confirm receipt in My Requests.`,
            )
          }

          if (newlyRejected.length > 0) {
            hasNewCrewAction = true
            const firstItem = newlyRejected[0]?.items?.[0]?.item_name || 'PPE item'
            toast.error('PPE Issue Rejected', {
              icon: <XCircle className="text-red-500" />,
              description: `${firstItem} needs your attention. Check My Requests for details.`,
              duration: 10000,
              action: {
                label: 'Open',
                onClick: () => router.push('/my-requests'),
              },
            })
            playNotificationSound()
            showBrowserNotification('PPE Issue Rejected', `${firstItem} needs your attention in My Requests.`)
          }
        }

        localStorage.setItem(statusStorageKey, JSON.stringify(nextStatuses))
        if (hasNewCrewAction) {
          window.dispatchEvent(new Event('new-notification'))
        }

        setNotifData({
          pending: payload.pending || 0,
          lowStock: 0,
          expiredCerts: 0,
          ppeSizeActions,
          personalCertActions: [],
          shipCertActions: [],
          updates: actionItems,
          approvedCount,
          personalCertAlertCount: 0,
          ppeSizeAlertCount,
          adminActions: [],
          personalUpdates: [],
          personalApprovedCount: 0,
          shipCertAlertCount: 0,
        })
        currentTotal = (payload.pending || 0) + ppeSizeAlertCount
      }

      const lastSeenTotal = parseInt(localStorage.getItem('kmt_notif_seen') || '0')
      const unread = currentTotal > lastSeenTotal ? currentTotal - lastSeenTotal : 0
      setUnreadCount(unread + adminUploadUnread)
    }

    fetchNotifications()
    const handleNewNotif = () => fetchNotifications()
    const handleFocus = () => fetchNotifications()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
      }
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications()
    }, 60000)
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
          notifData.pending +
          notifData.lowStock +
          notifData.expiredCerts +
          (notifData.personalUpdates || []).length +
          (notifData.ppeSizeAlertCount || 0)
        localStorage.setItem('kmt_notif_seen', total.toString())
        if (isAdmin && user?.id) {
          const uploadIds = (notifData.adminActions || []).map((item) => item.id)
          localStorage.setItem(`kmt_admin_upload_notif_seen_${user.id}`, JSON.stringify(uploadIds))
        }
        setUnreadCount(0)
      }

      return isOpening
    })
  }, [isAdmin, notifData, setShowNotif, setShowProfile, user])

  return { notifData, unreadCount, handleOpenNotif }
}
