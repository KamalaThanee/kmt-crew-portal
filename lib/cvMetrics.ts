type SeaServiceMetricRow = {
  company?: string | null
  vessel_type?: string | null
  rank?: string | null
  joining_date?: string | null
  sign_off_date?: string | null
}

const clean = (value: unknown) => String(value || '').trim()

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
) {
  const totalDays = rows.reduce((sum, row) => sum + dayDiffInclusive(row.joining_date, row.sign_off_date), 0)
  const vesselCount = new Set(rows.map((row) => clean(row.vessel_type) || clean(row.company)).filter(Boolean)).size
  const latestRow = rows[0]
  const currentType = clean(preferredVesselType) || clean(latestRow?.vessel_type) || 'Offshore Support Vessel (AWB)'
  const normalizedRank = clean(currentRank)

  const companyDays = rows.reduce((sum, row) => {
    const company = clean(row.company).toLowerCase()
    return company.includes('truth maritime services') ? sum + dayDiffInclusive(row.joining_date, row.sign_off_date) : sum
  }, 0)

  const typeDays = rows.reduce((sum, row) => (
    clean(row.vessel_type).toLowerCase() === currentType.toLowerCase()
      ? sum + dayDiffInclusive(row.joining_date, row.sign_off_date)
      : sum
  ), 0)

  const rankDays = rows.reduce((sum, row) => (
    normalizedRank && clean(row.rank).toLowerCase() === normalizedRank.toLowerCase()
      ? sum + dayDiffInclusive(row.joining_date, row.sign_off_date)
      : sum
  ), 0)

  return {
    totalDays,
    totalText: formatServiceDuration(totalDays),
    vesselCount,
    currentType,
    companyDays,
    typeDays,
    rankDays,
    companyText: formatYearsOneDecimal(companyDays),
    typeText: formatYearsOneDecimal(typeDays),
    rankText: formatYearsOneDecimal(rankDays),
  }
}
