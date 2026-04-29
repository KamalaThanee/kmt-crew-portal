import type { LucideIcon } from 'lucide-react'
import { Eye, Footprints, Hand, HardHat, Headphones, MoreHorizontal, Shirt, Wind } from 'lucide-react'

export type InventoryCategoryConfig = {
  name: string
  icon: LucideIcon
  label: string
}

export const inventoryCategoryConfig: InventoryCategoryConfig[] = [
  { name: 'Head Protection', icon: HardHat, label: 'Head' },
  { name: 'Ears Protection', icon: Headphones, label: 'Ears' },
  { name: 'Eyes Protection', icon: Eye, label: 'Eyes' },
  { name: 'Respiratory Protection', icon: Wind, label: 'Resp' },
  { name: 'Body Protection', icon: Shirt, label: 'Body' },
  { name: 'Hands Protection', icon: Hand, label: 'Hands' },
  { name: 'Foots Protection', icon: Footprints, label: 'Foots' },
  { name: 'Other', icon: MoreHorizontal, label: 'Other' },
]
