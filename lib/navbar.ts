import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, FileBadge, History, Package, PlusCircle } from 'lucide-react'

export type NavbarMenuItem = {
  name: string
  href: string
  icon: LucideIcon
}

export const getNavbarMenuItems = (isAdmin: boolean): NavbarMenuItem[] => {
  if (isAdmin) {
    return [
      { name: 'APPROVALS', href: '/admin/approvals', icon: ClipboardCheck },
      { name: 'HISTORY', href: '/admin/history', icon: History },
      { name: 'INVENTORY', href: '/admin/inventory', icon: Package },
      { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
      { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
    ]
  }

  return [
    { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
    { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
    { name: 'MY HISTORY', href: '/my-requests', icon: History },
  ]
}

export const getMobileNavLabel = (label: string) =>
  label
    .replace('REQUEST PPE', 'REQUEST')
    .replace('CERTIFICATE', 'CERT')
    .replace('APPROVALS', 'APPROVE')
