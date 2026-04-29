import { supabase } from '@/lib/supabase'
import type { CrewMember } from '@/lib/crewTypes'

export type PpeQuotaCounts = {
  boot: number
  suit: number
}

export const normalizeCartText = (str: unknown) =>
  String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()

export const isCrewActive = (crew: CrewMember | null | undefined) => crew?.is_active !== false && !crew?.resigned_at

export async function ensureDirectIssueTimeline(requestId: unknown, approverName: string, approvedAt: string) {
  if (!requestId || !approverName) return

  const { error } = await supabase
    .from('ppe_requests')
    .update({
      approved_by_name: approverName,
      approved_at: approvedAt,
      received_at: approvedAt,
    })
    .eq('id', requestId)

  if (error) {
    console.warn('Unable to persist direct issue timeline metadata:', error.message)
  }
}

export function getPersonalQuotaViolation({
  cartItems,
  onBehalf,
  personalQuotas,
  user,
}: {
  cartItems: any[]
  onBehalf: boolean
  personalQuotas: PpeQuotaCounts
  user: any
}) {
  if (onBehalf) return null

  let violation = ''
  let suitInCart = 0
  let bootInCart = 0

  for (const item of cartItems) {
    const name = item.item_name.toLowerCase()
    if (name.includes('suit')) {
      suitInCart++
      if (item.size !== user?.suit_size || item.color !== user?.suit_color) {
        violation = 'Personal size/color mismatch'
      }
    }
    if (name.includes('safety boot') && !name.includes('rubber')) {
      bootInCart++
      if (item.size !== user?.boot_size) {
        violation = 'Personal boot size mismatch'
      }
    }
  }

  if (personalQuotas.suit + suitInCart > 2) {
    violation = 'Annual Boiler Suit quota exceeded'
  }
  if (personalQuotas.boot + bootInCart > 1) {
    violation = 'Annual Safety Boots quota exceeded'
  }

  return violation
}

export function getTargetItemStats(targetHistory: any[], itemName: string) {
  let count = 0
  let lastDate = 'Never'

  targetHistory.forEach((req) => {
    const found = req.items?.find((item: any) => normalizeCartText(item.item_name) === normalizeCartText(itemName))
    if (found) {
      count++
      if (lastDate === 'Never') lastDate = new Date(req.created_at).toLocaleDateString('en-GB')
    }
  })

  return { count, lastDate }
}
