export type ShipCertificate = {
  id?: string
  vessel_name?: string | null
  category?: string | null
  code?: string | null
  cert_name?: string | null
  issue_by?: string | null
  issued_date?: string | null
  expiry_date?: string | null
  last_survey_date?: string | null
  next_survey_date?: string | null
  remark?: string | null
  file_url?: string | null
  has_expiry?: boolean | null
  has_survey?: boolean | null
  sort_order?: number | null
}

export type ShipCertificateStatus = 'expired' | 'due-30' | 'due-60' | 'due-90' | 'due-180' | 'valid' | 'no-expiry'
export type ShipSurveyStatus = 'survey-overdue' | 'survey-due-30' | 'survey-due-60' | 'survey-due-90' | 'survey-current' | 'no-survey'

const DAY_MS = 24 * 60 * 60 * 1000

export function daysUntil(dateValue?: string | null) {
  if (!dateValue) return null
  const target = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.ceil((target.getTime() - todayStart.getTime()) / DAY_MS)
}

export function getShipCertificateStatus(cert: ShipCertificate): ShipCertificateStatus {
  const days = daysUntil(cert.expiry_date)
  if (days === null) return 'no-expiry'
  if (days < 0) return 'expired'
  if (days <= 30) return 'due-30'
  if (days <= 60) return 'due-60'
  if (days <= 90) return 'due-90'
  if (days <= 180) return 'due-180'
  return 'valid'
}

export function getShipSurveyStatus(cert: ShipCertificate): ShipSurveyStatus {
  if (!cert.has_survey) return 'no-survey'
  const days = daysUntil(cert.next_survey_date)
  if (days === null) return 'no-survey'
  if (days < 0) return 'survey-overdue'
  if (days <= 30) return 'survey-due-30'
  if (days <= 60) return 'survey-due-60'
  if (days <= 90) return 'survey-due-90'
  return 'survey-current'
}

export function formatShipDate(value?: string | null) {
  if (!value) return 'No expiry'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const shipStatusStyles: Record<ShipCertificateStatus, string> = {
  expired: 'border-red-500/30 bg-red-500/10 text-red-300',
  'due-30': 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  'due-60': 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'due-90': 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
  'due-180': 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  valid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'no-expiry': 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
}

export const shipSurveyStyles: Record<ShipSurveyStatus, string> = {
  'survey-overdue': 'border-red-500/30 bg-red-500/10 text-red-300',
  'survey-due-30': 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  'survey-due-60': 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'survey-due-90': 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
  'survey-current': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  'no-survey': 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
}

export function getShipStatusLabel(status: ShipCertificateStatus) {
  return status.replace('due-', 'Due ').replace('-', ' ')
}

export function getSurveyStatusLabel(status: ShipSurveyStatus) {
  if (status === 'no-survey') return 'No survey tracking'
  return status.replace('survey-', 'Survey ').replace('-', ' ')
}
