'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { clearOneSignalUser } from '@/lib/onesignalClient'
import { canViewShipCertificates, isAdminRole } from '@/lib/roles'
import {
  clearCurrentUser,
  KMT_USER_CHANGED_EVENT,
  KMT_USER_STORAGE_KEY,
  readCurrentUser,
  type CurrentUser,
} from '@/lib/currentUser'

export function useCurrentUser() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)

  const refreshUser = useCallback(() => {
    setUser(readCurrentUser())
  }, [])

  useEffect(() => {
    setMounted(true)
    refreshUser()
  }, [pathname, refreshUser])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === KMT_USER_STORAGE_KEY) refreshUser()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(KMT_USER_CHANGED_EVENT, refreshUser)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(KMT_USER_CHANGED_EVENT, refreshUser)
    }
  }, [refreshUser])

  const logout = useCallback(() => {
    clearOneSignalUser()
    clearCurrentUser()
  }, [])

  const isAdmin = useMemo(() => isAdminRole(user?.position), [user?.position])
  const canViewShipCerts = useMemo(() => canViewShipCertificates(user?.position), [user?.position])

  return { user, mounted, isAdmin, canViewShipCerts, refreshUser, logout }
}
