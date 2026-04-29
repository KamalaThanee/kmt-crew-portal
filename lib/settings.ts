export type CrewStatusFilter = 'active' | 'resigned' | 'all'

const SIZE_ORDER = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

export const normalizeSettingsText = (str: unknown) =>
  String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()

export const isCrewActive = (crew: any) => crew?.is_active !== false && !crew?.resigned_at

export function smartSort(values: any[]) {
  return [...values].sort((a, b) => {
    const getNum = (value: string) => {
      const match = String(value).match(/\d+/)
      return match ? parseInt(match[0]) : null
    }
    const numA = getNum(a)
    const numB = getNum(b)
    if (numA !== null && numB !== null) return numA - numB

    const idxA = SIZE_ORDER.indexOf(String(a).toUpperCase())
    const idxB = SIZE_ORDER.indexOf(String(b).toUpperCase())
    if (idxA !== -1 && idxB !== -1) return idxA - idxB

    return String(a).localeCompare(String(b))
  })
}
