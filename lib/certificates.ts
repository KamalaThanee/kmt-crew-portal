export type CertPolicy = {
  refreshYears: number | null
  noExpiry: boolean
}

export const NO_EXPIRY_DATE = '2099-12-31'

export function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export function normalizePersonName(value: unknown) {
  return normalizeText(value).replace(/^(mr|mrs|ms|capt|captain|chief|officer)+/g, '')
}

export function parseBooleanLike(value: unknown) {
  if (typeof value === 'boolean') return value
  const normalized = String(value || '').toLowerCase().trim()
  return ['true', '1', 'yes', 'y'].includes(normalized)
}

export function extractCertPolicy(row: Record<string, any> | null | undefined): CertPolicy {
  if (!row) {
    return { refreshYears: null, noExpiry: false }
  }

  const refreshYearsRaw =
    row.refresh_years ??
    row.refreshYears ??
    row.valid_years ??
    row.validity_years ??
    row.renew_years

  const refreshYears = Number.isFinite(Number(refreshYearsRaw)) ? Number(refreshYearsRaw) : null

  const noExpiry =
    parseBooleanLike(row.no_expiry) ||
    parseBooleanLike(row.noExpiry) ||
    parseBooleanLike(row.no_refresh) ||
    parseBooleanLike(row.noRefresh) ||
    parseBooleanLike(row.indefinite) ||
    parseBooleanLike(row.is_indefinite)

  return {
    refreshYears,
    noExpiry,
  }
}

export function addYearsToDate(dateText: string, years: number) {
  if (!dateText || !Number.isFinite(years)) return ''

  const date = new Date(dateText)
  if (Number.isNaN(date.getTime())) return ''

  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

export function resolveExpiryDate(options: {
  issueDate?: string
  expiryDate?: string
  refreshYears?: number | null
  noExpiry?: boolean
}) {
  const expiryDate = String(options.expiryDate || '')
  const hasRefreshPolicy = !!options.issueDate && !!options.refreshYears && options.refreshYears > 0

  if (expiryDate && !(expiryDate === NO_EXPIRY_DATE && !options.noExpiry && hasRefreshPolicy)) return expiryDate
  if (options.noExpiry) return NO_EXPIRY_DATE
  if (options.issueDate && options.refreshYears && options.refreshYears > 0) {
    return addYearsToDate(options.issueDate, options.refreshYears)
  }
  return ''
}

export function isNoExpiryDate(value: unknown) {
  return String(value || '') === NO_EXPIRY_DATE
}

export function formatExpiryLabel(value: unknown) {
  return isNoExpiryDate(value) ? 'No Expiry' : String(value || '')
}
