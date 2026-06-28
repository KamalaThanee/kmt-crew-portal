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
