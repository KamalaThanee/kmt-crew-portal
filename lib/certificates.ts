export type CertPolicy = {
  refreshYears: number | null
  noExpiry: boolean
}

export const NO_EXPIRY_DATE = '2099-12-31'

const BASIC_SAFETY_PARENT_ALIASES = [
  'Basic Safety Training ( 4 Basic )',
  'Basic Safety Training (4 Basic)',
  'Basic Safety Training',
]

const BASIC_SAFETY_REFRESHER_ALIASES = [
  'Basic Safety Training ( 4 Basic COP )',
  'Basic Safety Training (4 Basic COP)',
  'Basic Safety Training Refresher',
  'Basic Safety Refresher',
]

const BASIC_SAFETY_COMPONENT_DEFINITIONS = [
  {
    key: 'personal_survival_techniques',
    displayName: 'Personal Survival Techniques',
    aliases: ['Personal Survival Techniques', 'PST'],
  },
  {
    key: 'fire_prevention_and_fire_fighting',
    displayName: 'Fire Prevention and Fire Fighting',
    aliases: ['Fire Prevention and Fire Fighting', 'FPFF', 'Basic Fire Fighting'],
  },
  {
    key: 'elementary_first_aid',
    displayName: 'Elementary First Aid',
    aliases: ['Elementary First Aid', 'EFA'],
  },
  {
    key: 'personal_safety_and_social_responsibilities',
    displayName: 'Personal Safety and Social Responsibilities',
    aliases: ['Personal Safety and Social Responsibilities', 'PSSR'],
  },
] as const

const fallbackPolicies: Array<{ match: string; policy: CertPolicy }> = []

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

function matchesAlias(value: unknown, aliases: readonly string[]) {
  const normalized = normalizeText(value)
  return aliases.some((alias) => normalizeText(alias) === normalized)
}

export function isBasicSafetyParentName(value: unknown) {
  return matchesAlias(value, BASIC_SAFETY_PARENT_ALIASES)
}

export function isBasicSafetyRefresherName(value: unknown) {
  if (matchesAlias(value, BASIC_SAFETY_REFRESHER_ALIASES)) return true
  const normalized = normalizeText(value)
  return normalized.includes('basicsafetytraining') && normalized.includes('cop')
}

export function getBasicSafetyComponentDefinitions() {
  return BASIC_SAFETY_COMPONENT_DEFINITIONS.map((definition) => ({
    ...definition,
    aliases: [...definition.aliases],
  }))
}

export function findBasicSafetyComponentDefinition(value: unknown) {
  const normalized = normalizeText(value)
  return BASIC_SAFETY_COMPONENT_DEFINITIONS.find((definition) =>
    definition.aliases.some((alias) => normalizeText(alias) === normalized),
  ) || null
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

  const parsedRefreshYears = Number.isFinite(Number(refreshYearsRaw)) ? Number(refreshYearsRaw) : null
  const refreshYears = parsedRefreshYears && parsedRefreshYears > 0 ? parsedRefreshYears : null

  const noExpiryFlag =
    parsedRefreshYears === 0 ||
    parseBooleanLike(row.no_expiry) ||
    parseBooleanLike(row.noExpiry) ||
    parseBooleanLike(row.no_refresh) ||
    parseBooleanLike(row.noRefresh) ||
    parseBooleanLike(row.indefinite) ||
    parseBooleanLike(row.is_indefinite)

  return {
    refreshYears,
    noExpiry: !!noExpiryFlag,
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
  '\u0e50': '0',
  '\u0e51': '1',
  '\u0e52': '2',
  '\u0e53': '3',
  '\u0e54': '4',
  '\u0e55': '5',
  '\u0e56': '6',
  '\u0e57': '7',
  '\u0e58': '8',
  '\u0e59': '9',
}

const THAI_MONTH_MAP: Record<string, string> = {
  '\u0e21\u0e01\u0e23\u0e32\u0e04\u0e21': '01',
  '\u0e01\u0e38\u0e21\u0e20\u0e32\u0e1e\u0e31\u0e19\u0e18\u0e4c': '02',
  '\u0e21\u0e35\u0e19\u0e32\u0e04\u0e21': '03',
  '\u0e40\u0e21\u0e29\u0e32\u0e22\u0e19': '04',
  '\u0e1e\u0e24\u0e29\u0e20\u0e32\u0e04\u0e21': '05',
  '\u0e21\u0e34\u0e16\u0e38\u0e19\u0e32\u0e22\u0e19': '06',
  '\u0e01\u0e23\u0e01\u0e0e\u0e32\u0e04\u0e21': '07',
  '\u0e2a\u0e34\u0e07\u0e2b\u0e32\u0e04\u0e21': '08',
  '\u0e01\u0e31\u0e19\u0e22\u0e32\u0e22\u0e19': '09',
  '\u0e15\u0e38\u0e25\u0e32\u0e04\u0e21': '10',
  '\u0e1e\u0e24\u0e28\u0e08\u0e34\u0e01\u0e32\u0e22\u0e19': '11',
  '\u0e18\u0e31\u0e19\u0e27\u0e32\u0e04\u0e21': '12',
  '\u0e21.\u0e04.': '01',
  '\u0e01.\u0e1e.': '02',
  '\u0e21\u0e35.\u0e04.': '03',
  '\u0e40\u0e21.\u0e22.': '04',
  '\u0e1e.\u0e04.': '05',
  '\u0e21\u0e34.\u0e22.': '06',
  '\u0e01.\u0e04.': '07',
  '\u0e2a.\u0e04.': '08',
  '\u0e01.\u0e22.': '09',
  '\u0e15.\u0e04.': '10',
  '\u0e1e.\u0e22.': '11',
  '\u0e18.\u0e04.': '12',
}

export function normalizeThaiDigits(value: unknown) {
  return String(value || '').replace(/[\u0e50-\u0e59]/g, (digit) => THAI_DIGIT_MAP[digit] || digit)
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

  const pattern = new RegExp(`(\\d{1,2})\\s*(?:-|\u0e16\u0e36\u0e07)?\\s*(\\d{1,2})?\\s*(${monthTokens})\\s*(\\d{4})`, 'g')
  const matches = Array.from(source.matchAll(pattern))
  if (!matches.length) return ''

  const preferredSlice =
    ['\u0e43\u0e2b\u0e49\u0e44\u0e27\u0e49 \u0e13 \u0e27\u0e31\u0e19\u0e17\u0e35\u0e48', '\u0e2d\u0e2d\u0e01\u0e43\u0e2b\u0e49\u0e44\u0e27\u0e49 \u0e13 \u0e27\u0e31\u0e19\u0e17\u0e35\u0e48', '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e2d\u0e2d\u0e01', '\u0e27\u0e31\u0e19\u0e2d\u0e2d\u0e01\u0e43\u0e1a', 'date of issue', 'issued on']
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

  const requestedBasicSafety = requested.includes('basicsafety') || requested.includes('4basic')
  const requestedBasicOffshore =
    requested.includes('basicoffshoresafety') ||
    requested.includes('furtheroffshoretraining') ||
    requested.includes('bosiet') ||
    requested.includes('foet')

  const evidenceBasicOffshore =
    evidence.includes('basicoffshoresafety') ||
    evidence.includes('furtheroffshoretraining') ||
    evidence.includes('bosiet') ||
    evidence.includes('foet')

  const evidenceBasicSafety =
    evidence.includes('basicsafetytraining') ||
    evidence.includes('4basic') ||
    evidence.includes('personalsurvivaltechniques') ||
    evidence.includes('firepreventionandfirefighting') ||
    evidence.includes('elementaryfirstaid') ||
    evidence.includes('personalsafetyandsocialresponsibilities')

  if (requestedBasicSafety && evidenceBasicOffshore && !evidenceBasicSafety) {
    return false
  }

  if (requestedBasicOffshore && evidenceBasicSafety && !evidenceBasicOffshore) {
    return false
  }

  return true
}
