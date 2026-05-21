type SeaServiceMetricRow = {
  company?: string | null
  vessel_type?: string | null
  rank?: string | null
  joining_date?: string | null
  sign_off_date?: string | null
}

const clean = (value: unknown) => String(value || '').trim()
const cleanLower = (value: unknown) => clean(value).toLowerCase()
function normalizeMetricLabel(value: unknown) {
  const text = cleanLower(value)
    .replace(/vessl/g, 'vessel')
    .replace(/accomodation/g, 'accommodation')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''
  if (text.includes('truth maritime services')) return 'truth maritime services'
  if (text.includes('offshore support vessel')) return 'offshore support vessel awb'
  if (text.includes('accommodation barge')) return 'accommodation barge'
  return text
}

const compareKey = (value: unknown) => normalizeMetricLabel(value).replace(/[^a-z0-9]+/g, '')

export function sameMetricLabel(left: unknown, right: unknown) {
  const a = compareKey(left)
  const b = compareKey(right)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

function addDaysToMap(map: Map<string, { label: string; days: number }>, label: string, days: number) {
  const cleaned = clean(label)
  const key = compareKey(cleaned)
  if (!cleaned || !key || !days) return
  const current = map.get(key)
  if (current) {
    current.days += days
    return
  }
  map.set(key, { label: cleaned, days })
}

function pickDominantLabel(map: Map<string, { label: string; days: number }>, fallback: string) {
  const values = Array.from(map.values())
  if (values.length === 0) return clean(fallback)
  values.sort((left, right) => {
    if (right.days !== left.days) return right.days - left.days
    return left.label.localeCompare(right.label)
  })
  return values[0]?.label || clean(fallback)
}

function uniqueOptions(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    const label = clean(value)
    const key = compareKey(label)
    if (!label || seen.has(key)) return
    seen.add(key)
    result.push(label)
  })
  return result
}

export function dayDiffInclusive(start?: string | null, end?: string | null) {
  if (!start || !end) return 0
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0
  const diff = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  return Math.max(diff, 0)
}

export function formatServiceDuration(days: number) {
  const months = Math.floor(days / 30)
  const remainder = days % 30
  if (!days) return '0 months 0 days'
  return `${months} months ${remainder} days`
}

export function formatYearsOneDecimal(days: number) {
  if (!days) return '0.0 years'
  return `${(days / 365).toFixed(1)} years`
}

export function getSeaServiceMetrics(
  rows: SeaServiceMetricRow[],
  currentRank?: string | null,
  preferredVesselType?: string | null,
  preferredCompany?: string | null,
  preferredRank?: string | null,
) {
  const totalDays = rows.reduce((sum, row) => sum + dayDiffInclusive(row.joining_date, row.sign_off_date), 0)
  const latestRow = rows[0]
  const companyTotals = new Map<string, { label: string; days: number }>()
  const typeTotals = new Map<string, { label: string; days: number }>()
  const rankTotals = new Map<string, { label: string; days: number }>()

  rows.forEach((row) => {
    const days = dayDiffInclusive(row.joining_date, row.sign_off_date)
    const companyLabel = clean(row.company)
    const typeLabel = clean(row.vessel_type)
    addDaysToMap(companyTotals, companyLabel, days)
    addDaysToMap(typeTotals, typeLabel, days)
    addDaysToMap(rankTotals, clean(row.rank), days)
  })

  const fallbackCompany =
    clean(preferredCompany)
    || pickDominantLabel(companyTotals, '')
    || clean(latestRow?.company)
    || 'Truth Maritime Services'
  const fallbackType =
    clean(preferredVesselType)
    || pickDominantLabel(typeTotals, '')
    || clean(latestRow?.vessel_type)
    || 'Offshore Support Vessel (AWB)'
  const normalizedRows = rows.map((row) => {
    const normalizedCompany = clean(row.company) || fallbackCompany
    const normalizedType = clean(row.vessel_type) || fallbackType
    const normalizedRank = clean(row.rank)

    return {
      ...row,
      company: normalizedCompany,
      vessel_type: normalizedType,
      rank: normalizedRank,
    }
  })
  const companyOptions = uniqueOptions(normalizedRows.map((row) => clean(row.company)).filter(Boolean))
  const typeOptions = uniqueOptions(normalizedRows.map((row) => clean(row.vessel_type)).filter(Boolean))
  const rankOptions = uniqueOptions(normalizedRows.map((row) => clean(row.rank)).filter(Boolean))

  const currentCompany =
    clean(preferredCompany)
    || (companyOptions.length === 1 ? companyOptions[0] : '')
    || pickDominantLabel(companyTotals, '')
    || fallbackCompany
  const currentType =
    clean(preferredVesselType)
    || (typeOptions.length === 1 ? typeOptions[0] : '')
    || pickDominantLabel(typeTotals, '')
    || fallbackType
  const normalizedRank =
    clean(preferredRank)
    || clean(currentRank)
    || (rankOptions.length === 1 ? rankOptions[0] : '')
    || pickDominantLabel(rankTotals, '')

  const companyScopedRows = normalizedRows.filter((row) => sameMetricLabel(row.company, currentCompany))
  const typeScopedRows = normalizedRows.filter((row) => sameMetricLabel(row.vessel_type, currentType))
  const rankScopedRows = normalizedRows.filter((row) => normalizedRank && sameMetricLabel(row.rank, normalizedRank))

  const vesselCount = new Set(normalizedRows.map((row) => clean(row.vessel_type) || clean(row.company)).filter(Boolean)).size
  const companyDays = companyScopedRows.reduce((sum, row) => sum + dayDiffInclusive(row.joining_date, row.sign_off_date), 0)
  const typeDays = typeScopedRows.reduce((sum, row) => sum + dayDiffInclusive(row.joining_date, row.sign_off_date), 0)
  const rankDays = rankScopedRows.reduce((sum, row) => sum + dayDiffInclusive(row.joining_date, row.sign_off_date), 0)

  return {
    totalDays,
    totalText: formatServiceDuration(totalDays),
    vesselCount,
    currentType,
    currentCompany,
    currentRank: normalizedRank,
    companyOptions: uniqueOptions([currentCompany, ...companyOptions]),
    typeOptions: uniqueOptions([currentType, ...typeOptions]),
    rankOptions: uniqueOptions([normalizedRank, ...rankOptions]),
    companyDays,
    typeDays,
    rankDays,
    companyText: formatYearsOneDecimal(companyDays),
    typeText: formatYearsOneDecimal(typeDays),
    rankText: formatYearsOneDecimal(rankDays),
  }
}
