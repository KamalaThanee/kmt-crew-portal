const HONORIFICS: Record<string, string> = {
  mr: 'Mr.',
  mrs: 'Mrs.',
  ms: 'Ms.',
}

export const CREW_POSITIONS = [
  'Assist Bosun',
  'Barge Master',
  'Bosun',
  'Chief Engineer',
  'Chief Officer',
  'Crane Operator',
  'Deck Helper',
  'Electrician',
  'Fitter',
  'Medic',
  'Oiler',
  'Radio Operator',
  'Safety Officer',
  'Second Engineer',
] as const

const normalizeWhitespace = (value: unknown) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()

const titleCaseName = (value: string) =>
  value
    .toLocaleLowerCase('en-US')
    .replace(/(^|[\s'-])(\p{L})/gu, (_, boundary: string, letter: string) => `${boundary}${letter.toLocaleUpperCase('en-US')}`)

export function formatCrewName(value: unknown) {
  const cleaned = normalizeWhitespace(value)
  if (!cleaned) return ''

  const honorificMatch = cleaned.match(/^(mr|mrs|ms)\.?\s+/i)
  if (!honorificMatch) return titleCaseName(cleaned)

  const honorific = HONORIFICS[honorificMatch[1].toLowerCase()]
  const name = titleCaseName(cleaned.slice(honorificMatch[0].length))
  return name ? `${honorific} ${name}` : honorific
}

export function crewNameSortKey(value: unknown) {
  return formatCrewName(value)
    .replace(/^(Mr|Mrs|Ms)\.\s+/i, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function compareCrewNames(left: unknown, right: unknown) {
  return crewNameSortKey(left).localeCompare(crewNameSortKey(right), 'en', {
    sensitivity: 'base',
    numeric: true,
  })
}
