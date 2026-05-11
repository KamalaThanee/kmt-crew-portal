import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, ClipboardCheck, FileBadge, FileText, History, Package, PlusCircle } from 'lucide-react'

export type NavbarMenuItem = {
  name: string
  href: string
  icon: LucideIcon
}

export const getNavbarMenuItems = (isAdmin: boolean): NavbarMenuItem[] => {
  if (isAdmin) {
    return [
      { name: 'APPROVALS', href: '/admin/approvals', icon: ClipboardCheck },
      { name: 'INVENTORY', href: '/admin/inventory', icon: Package },
      { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
      { name: 'SMS', href: '/sms-library', icon: FileText },
      { name: 'MONTHLY REPORTS', href: '/monthly-reports', icon: CalendarCheck },
      { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
    ]
  }

  return [
    { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
    { name: 'SMS', href: '/sms-library', icon: FileText },
    { name: 'MONTHLY REPORTS', href: '/monthly-reports', icon: CalendarCheck },
    { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
    { name: 'MY HISTORY', href: '/my-requests', icon: History },
  ]
}

export const getMobileNavLabel = (label: string) =>
  label
    .replace('REQUEST PPE', 'REQUEST')
    .replace('CERTIFICATE', 'CERT')
    .replace('MONTHLY REPORTS', 'REPORTS')
    .replace('APPROVALS', 'APPROVE')
