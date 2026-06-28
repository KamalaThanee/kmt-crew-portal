export type CertPolicy = {
  refreshYears: number | null
  noExpiry: boolean
}

export const NO_EXPIRY_DATE = '2099-12-31'

const fallbackPolicies: Array<{ match: string; policy: CertPolicy }> = [
  {
    match: 'safetyofficertraining',
    policy: { refreshYears: 3, noExpiry: false },
  },
]

export function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export function normalizeCertPolicyText(value: unknown) {
  const normalized = normalizeText(value)

  if (!normalized) return ''

  if (normalized.includes('safetyofficer')) {
    return 'safetyofficertraining'
  }

  if ((normalized.includes('advance') || normalized.includes('advanced')) && normalized.includes('fire')) {
    return normalized.includes('cop') ? 'advancedtraininginfirefightingcop' : 'advancedtraininginfirefighting'
  }

  if (normalized.includes('basicsafety') || normalized.includes('4basic')) {
    return normalized.includes('cop') ? 'basicsafetytrainingcop' : 'basicsafetytraining'
  }

  if (normalized.includes('medicalfirstaid')) {
    return normalized.includes('cop') ? 'medicalfirstaidcop' : 'medicalfirstaid'
  }

  if (normalized.includes('survivalcraft') || normalized.includes('rescueboats')) {
    return normalized.includes('cop')
      ? 'proficiencyinsurvivalcraftandrescueboatscop'
      : 'proficiencyinsurvivalcraftandrescueboats'
  }

  if (normalized.includes('gmdss') || normalized.includes('generaloperatorscertificate') || normalized.includes('goc')) {
    return normalized.includes('cop') ? 'gmdssradiooperatorcop' : 'gmdssradiooperator'
  }

  return normalized
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

  const noExpiryFlag =
    parseBooleanLike(row.no_expiry) ||
    parseBooleanLike(row.noExpiry) ||
    parseBooleanLike(row.no_refresh) ||
    parseBooleanLike(row.noRefresh) ||
    parseBooleanLike(row.indefinite) ||
    parseBooleanLike(row.is_indefinite)

  return {
    refreshYears,
    noExpiry: !!noExpiryFlag && !(refreshYears && refreshYears > 0),
  }
}

export function getFallbackCertPolicy(...candidates: Array<unknown>): CertPolicy | null {
  const normalizedCandidates = candidates.map((candidate) => normalizeCertPolicyText(candidate)).filter(Boolean)
  if (!normalizedCandidates.length) return null

  for (const candidate of normalizedCandidates) {
    const matched = fallbackPolicies.find((entry) => entry.match === candidate)
    if (matched) return matched.policy
  }

  return null
}

export function addYearsToDate(dateText: string, years: number) {
  if (!dateText || !Number.isFinite(years)) return ''

  const date = new Date(dateText)
  if (Number.isNaN(date.getTime())) return ''

  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

const THAI_DIGIT_MAP: Record<string, string> = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9',
}

const THAI_MONTH_MAP: Record<string, string> = {
  มกราคม: '01',
  กุมภาพันธ์: '02',
  มีนาคม: '03',
  เมษายน: '04',
  พฤษภาคม: '05',
  มิถุนายน: '06',
  กรกฎาคม: '07',
  สิงหาคม: '08',
  กันยายน: '09',
  ตุลาคม: '10',
  พฤศจิกายน: '11',
  ธันวาคม: '12',
  ม.ค.: '01',
  ก.พ.: '02',
  มี.ค.: '03',
  เม.ย.: '04',
  พ.ค.: '05',
  มิ.ย.: '06',
  ก.ค.: '07',
  ส.ค.: '08',
  ก.ย.: '09',
  ต.ค.: '10',
  พ.ย.: '11',
  ธ.ค.: '12',
}

export function normalizeThaiDigits(value: unknown) {
  return String(value || '').replace(/[๐-๙]/g, (digit) => THAI_DIGIT_MAP[digit] || digit)
}

function parseSlashDate(source: string) {
  const match = source.match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{2,4})/)
  if (!match) return ''

  let year = Number(match[3])
  if (year < 100) year += 2000
  if (year > 2400) year -= 543
  if (!Number.isFinite(year) || year < 1900) return ''

  const month = match[2].padStart(2, '0')
  const day = match[1].padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseThaiNamedDate(source: string) {
  const monthTokens = Object.keys(THAI_MONTH_MAP)
    .sort((a, b) => b.length - a.length)
    .map((month) => month.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  const pattern = new RegExp(`(\\d{1,2})\\s*(?:-|ถึง)?\\s*(\\d{1,2})?\\s*(${monthTokens})\\s*(\\d{4})`, 'g')
  const matches = Array.from(source.matchAll(pattern))
  if (!matches.length) return ''

  const preferredSlice =
    ['ให้ไว้ ณ วันที่', 'ออกให้ไว้ ณ วันที่', 'วันที่ออก', 'วันออกใบ', 'date of issue', 'issued on']
      .map((phrase) => source.lastIndexOf(phrase))
      .find((index) => index !== undefined && index >= 0) ?? -1

  const selected = preferredSlice >= 0
    ? matches.find((match) => (match.index ?? -1) >= preferredSlice) || matches[matches.length - 1]
    : matches[matches.length - 1]

  const day = selected[1].padStart(2, '0')
  const month = THAI_MONTH_MAP[selected[3]]
  let year = Number(selected[4])

  if (year > 2400) year -= 543
  if (!Number.isFinite(year) || year < 1900 || !month) return ''

  return `${year}-${month}-${day}`
}

export function parseThaiDateEvidence(value: unknown) {
  const source = normalizeThaiDigits(value)
    .replace(/\s+/g, ' ')
    .replace(/,/g, ' ')
    .trim()

  if (!source) return ''

  return parseThaiNamedDate(source) || parseSlashDate(source)
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

export function matchCertMasterRow(
  rows: Array<Record<string, any>> | null | undefined,
  ...candidates: Array<unknown>
) {
  if (!rows?.length) return null

  const normalizedCandidates = candidates
    .map((candidate) => normalizeCertPolicyText(candidate))
    .filter(Boolean)

  if (!normalizedCandidates.length) return null

  for (const candidate of normalizedCandidates) {
    const exact = rows.find((row) => normalizeCertPolicyText(row.cert_name) === candidate)
    if (exact) return exact
  }

  for (const candidate of normalizedCandidates) {
    const partial = rows.find((row) => {
      const rowName = normalizeCertPolicyText(row.cert_name)
      return rowName.includes(candidate) || candidate.includes(rowName)
    })
    if (partial) return partial
  }

  return null
}

export function auditCertTypeMatch(requestedCertName: unknown, detectedCertName: unknown, note?: unknown) {
  const requested = normalizeText(requestedCertName)
  const detected = normalizeText(detectedCertName)
  const reasoning = normalizeText(note)
  const evidence = `${detected} ${reasoning}`

  const requestsAdvancedFire = requested.includes('advancefire') || requested.includes('advancedfire')
  const evidenceBasicFire = evidence.includes('basicfire') || evidence.includes('basicfirefighting')
  const evidenceAdvancedFire = evidence.includes('advancefire') || evidence.includes('advancedfire')

  if (requestsAdvancedFire && evidenceBasicFire && !evidenceAdvancedFire) {
    return false
  }

  const requestsSafetyOfficer = requested.includes('safetyofficer')
  const evidenceSafetyOfficer = evidence.includes('safetyofficer')
  const evidenceGenericSafety = evidence.includes('basicoffshoresafety') || evidence.includes('bosiet') || evidence.includes('foet')

  if (requestsSafetyOfficer && evidenceGenericSafety && !evidenceSafetyOfficer) {
    return false
  }

  return true
}
