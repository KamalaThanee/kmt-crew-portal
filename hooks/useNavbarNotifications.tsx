'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import { supabase } from '@/lib/supabase'
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
  tone: 'amber' | 'red' | 'violet'
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
      const fetchActivePpeSizeWindow = async () => {
        const { data, error } = await supabase
          .from('ppe_size_windows')
          .select('id, title, deadline_at')
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) return null
        return (data || null) as PpeSizeWindow | null
      }

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

        const [pendingRes, pendingRowsRes, personalCountRes, personalUpdatesRes, activePpeSizeWindow] = await Promise.all([
          supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase
            .from('ppe_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5),
          personalCountQuery,
          personalUpdatesQuery,
          fetchActivePpeSizeWindow(),
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

        const ppeSizeActions = buildPpeSizeActions(activePpeSizeWindow, user)
        const ppeSizeAlertCount = ppeSizeActions.length

        setNotifData({
          pending: pendingCount,
          lowStock: 0,
          expiredCerts: 0,
          ppeSizeActions,
          pendingActions,
          shipCertActions: [],
          adminActions: [],
          personalUpdates,
          personalCertActions: [],
          updates: [],
          approvedCount: 0,
          personalApprovedCount,
          personalCertAlertCount: 0,
          ppeSizeAlertCount,
          shipCertAlertCount: 0,
        })
        currentTotal = pendingCount + personalUpdateCount + ppeSizeAlertCount
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

        const [{ count }, { data: updates }, activePpeSizeWindow] = await Promise.all([
          countQuery,
          updatesQuery,
          fetchActivePpeSizeWindow(),
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
        const ppeSizeActions = buildPpeSizeActions(activePpeSizeWindow, user)
        const ppeSizeAlertCount = ppeSizeActions.length

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
        currentTotal = (count || 0) + ppeSizeAlertCount
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
        setUnreadCount(0)
      }

      return isOpening
    })
  }, [notifData, setShowNotif, setShowProfile, user])

  return { notifData, unreadCount, handleOpenNotif }
}
