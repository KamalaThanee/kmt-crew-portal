import type { CurrentUser } from '@/lib/currentUser'

export type CrewActionItem = {
  id: string
  status: string
  title: string
  description: string
  href?: string
}

type SeenCertTriggers = Record<string, boolean>

const CERT_TRIGGER_DAYS = [7, 30, 60, 90, 180] as const
type CertTrigger = (typeof CERT_TRIGGER_DAYS)[number] | 'expired'

export function getCrewNotificationStorageKey(user: CurrentUser | null) {
  const identity = user?.id || user?.full_name || 'anonymous'
  return `kmt_crew_request_statuses_${identity}`
}

export function getCertTriggerStorageKey(user: CurrentUser | null) {
  const identity = user?.id || user?.full_name || 'anonymous'
  return `kmt_cert_triggers_seen_${identity}`
}

export function buildPersonalCertActions(
  certs: any[],
  user: CurrentUser | null,
  options: { filterByCrewId?: boolean } = {},
) {
  const now = new Date()
  const seenCertTriggers = JSON.parse(localStorage.getItem(getCertTriggerStorageKey(user)) || '{}') as SeenCertTriggers
  const rows = options.filterByCrewId ? certs.filter((cert: any) => String(cert.crew_id || '') === String(user?.id || '')) : certs

  return rows
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
}

export function playNotificationSound() {
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

export function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  new Notification(title, {
    body,
    silent: false,
  })
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
