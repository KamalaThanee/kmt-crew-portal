import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, FileBadge, FileText, FileUser, History, Package, PlusCircle } from 'lucide-react'
import { canManageMonthlyReports } from '@/lib/roles'

export type NavbarMenuItem = {
  name: string
  href: string
  icon: LucideIcon
}

export const getNavbarMenuItems = (isAdmin: boolean, position?: unknown): NavbarMenuItem[] => {
  const canOpenMonthlyReports = canManageMonthlyReports(position)
  if (isAdmin) {
    const adminItems = [
      { name: 'INVENTORY', href: '/admin/inventory', icon: Package },
      { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
      { name: 'CV', href: '/cv', icon: FileUser },
      { name: 'SMS', href: '/sms-library', icon: FileText },
      { name: 'ISSUE PPE', href: '/ppe', icon: PlusCircle },
    ]

    if (canOpenMonthlyReports) {
      adminItems.splice(adminItems.length - 1, 0, { name: 'MONTHLY REPORTS', href: '/monthly-reports', icon: CalendarCheck })
    }

    return adminItems
  }

  const crewItems = [
    { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
    { name: 'CV', href: '/cv', icon: FileUser },
    { name: 'SMS', href: '/sms-library', icon: FileText },
    { name: 'MY HISTORY', href: '/my-requests', icon: History },
  ]

  if (canOpenMonthlyReports) {
    crewItems.splice(3, 0, { name: 'MONTHLY REPORTS', href: '/monthly-reports', icon: CalendarCheck })
  }

  return crewItems
}

export const getMobileNavLabel = (label: string) =>
  label
    .replace('ISSUE PPE', 'ISSUE')
    .replace('CERTIFICATE', 'CERT')
    .replace('MONTHLY REPORTS', 'REPORTS')
