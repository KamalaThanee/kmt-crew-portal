export type SmsCategory = 'Procedure' | 'Checklist'

export type SmsDocument = {
  id?: string
  doc_no: string
  title: string
  category: SmsCategory
  current_revision?: string | null
  effective_date?: string | null
  active_version_id?: string | null
  status?: string | null
}

export type SmsDocumentVersion = {
  id?: string
  document_id?: string | null
  doc_no: string
  title: string
  category: SmsCategory
  revision?: string | null
  effective_date?: string | null
  status?: string | null
  file_name?: string | null
  file_path?: string | null
  file_url?: string | null
  file_size?: number | null
  mime_type?: string | null
  change_summary?: string | null
  header_source?: string | null
  uploaded_by_name?: string | null
  created_at?: string | null
}

export type SmsRevisionLog = {
  id?: string
  action: string
  doc_no?: string | null
  title?: string | null
  category?: SmsCategory | null
  old_revision?: string | null
  new_revision?: string | null
  file_name?: string | null
  actor_name?: string | null
  details?: Record<string, unknown> | null
  created_at?: string | null
}

export type SmsChangeRecordItem = {
  docNo: string
  title: string
  category: SmsCategory
  revision: string
  changeSummary: string
}

export type SmsFileDraft = {
  id: string
  file: File
  fileName: string
  docNo: string
  title: string
  category: SmsCategory
  revision: string
  effectiveDate: string
  changeSummary: string
  source: string
  matchStatus: 'matched' | 'new' | 'need-review' | 'extra'
  matchedDocumentId?: string
  oldRevision?: string | null
}

const MONTHS: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
}

export function normalizeDocNo(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-:]\s*$/g, '')
    .trim()
}

export function normalizeRevision(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const match = raw.match(/(?:rev(?:ision)?\.?\s*)?([0-9]{1,3}[a-z]?)/i)
  if (!match) return raw
  return `Rev.${match[1].padStart(2, '0')}`
}

export function parseSmsDate(value: string) {
  const raw = String(value || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
  if (!raw) return ''

  const iso = raw.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const dmy = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2}|\d{2})\b/)
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }

  const named = raw.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\b/)
  if (named) {
    const month = MONTHS[named[2].toLowerCase()]
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`
  }

  return ''
}

export function parseSmsFilename(fileName: string) {
  const base = fileName
    .replace(/\.[^.]+$/g, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const revision = normalizeRevision(base.match(/\b(?:rev|rv|revision)\.?\s*([0-9]{1,3}[a-z]?)\b/i)?.[0] || '')
  const withoutRevision = base.replace(/\b(?:rev|rv|revision)\.?\s*[0-9]{1,3}[a-z]?\b/ig, '').trim()

  const procedureMatch = withoutRevision.match(/\bProcedure\s+([0-9]+(?:\.[0-9]+)*)\s*[-:]?\s*(.*)$/i)
  if (procedureMatch) {
    return {
      docNo: normalizeDocNo(`Procedure ${procedureMatch[1]}`),
      title: (procedureMatch[2] || '').trim() || withoutRevision,
      category: 'Procedure' as SmsCategory,
      revision,
    }
  }

  const checklistMatch = withoutRevision.match(/\b(?:Form\s+)?([0-9]{1,2}\.[0-9A-Za-z]+)\s*[-:]?\s*(.*)$/i)
  if (checklistMatch) {
    return {
      docNo: normalizeDocNo(checklistMatch[1]),
      title: (checklistMatch[2] || '').trim() || withoutRevision,
      category: 'Checklist' as SmsCategory,
      revision,
    }
  }

  return {
    docNo: '',
    title: withoutRevision,
    category: 'Checklist' as SmsCategory,
    revision,
  }
}

export function isChangeRecordFile(file: File) {
  const name = file.name.toLowerCase()
  return name.includes('change record') || name.includes('change_record') || name.includes('00_change')
}

function cleanText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

async function readDocxXml(file: File) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  return zip.file('word/document.xml')?.async('text') || ''
}

function parseDocxRows(xml: string) {
  if (!xml) return [] as string[][]
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const rows = Array.from(doc.getElementsByTagName('w:tr'))

  return rows.map((row) => {
    const cells = Array.from(row.getElementsByTagName('w:tc'))
    return cells.map((cell) => cleanText(Array.from(cell.getElementsByTagName('w:t')).map((node) => node.textContent || '').join(' ')))
  }).filter((cells) => cells.some(Boolean))
}

function parseChangeRecordRow(cells: string[]): SmsChangeRecordItem | null {
  if (cells.length < 3) return null
  if (!/^\d+$/i.test(cells[0] || '')) return null

  const rawDoc = cells[1] || ''
  const parsed = parseSmsFilename(rawDoc)
  const revision = normalizeRevision(cells[2] || '')
  if (!parsed.docNo || !revision) return null

  return {
    docNo: parsed.docNo,
    title: parsed.title || rawDoc,
    category: parsed.category,
    revision,
    changeSummary: cells[3] || '',
  }
}

export async function parseChangeRecord(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'docx') return [] as SmsChangeRecordItem[]

  const xml = await readDocxXml(file)
  const rows = parseDocxRows(xml)
  const seen = new Set<string>()
  const items: SmsChangeRecordItem[] = []

  rows.forEach((cells) => {
    const item = parseChangeRecordRow(cells)
    if (!item) return
    const key = `${item.docNo}|${item.revision}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  })

  return items
}

function pickValueAfterLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:\\-]?\\s*([^|\\n]{1,120})`, 'i')
    const match = text.match(pattern)
    if (match?.[1]) return cleanText(match[1])
  }
  return ''
}

export async function readSmsDocumentHeader(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const filename = parseSmsFilename(file.name)

  try {
    if (ext === 'docx') {
      const xml = await readDocxXml(file)
      const rows = parseDocxRows(xml)
      const headerText = rows.slice(0, 8).flat().join(' | ')
      return {
        docNo: normalizeDocNo(pickValueAfterLabel(headerText, ['Document Number', 'Document No', 'Doc No'])) || filename.docNo,
        title: pickValueAfterLabel(headerText, ['Title']) || filename.title,
        revision: normalizeRevision(pickValueAfterLabel(headerText, ['Revision Number', 'Revision No', 'Revision'])) || filename.revision,
        effectiveDate: parseSmsDate(pickValueAfterLabel(headerText, ['Effective Date'])) || '',
        source: 'DOCX header',
      }
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }).slice(0, 12) as unknown[][]
      const headerText = rows.flat().map((value) => cleanText(String(value || ''))).filter(Boolean).join(' | ')
      return {
        docNo: normalizeDocNo(pickValueAfterLabel(headerText, ['Document Number', 'Document No', 'Doc No'])) || filename.docNo,
        title: pickValueAfterLabel(headerText, ['Title']) || filename.title,
        revision: normalizeRevision(pickValueAfterLabel(headerText, ['Revision Number', 'Revision No', 'Revision'])) || filename.revision,
        effectiveDate: parseSmsDate(pickValueAfterLabel(headerText, ['Effective Date'])) || '',
        source: 'Excel header',
      }
    }
  } catch (error) {
    console.warn(`Unable to read SMS header from ${file.name}`, error)
  }

  return {
    docNo: filename.docNo,
    title: filename.title,
    revision: filename.revision,
    effectiveDate: '',
    source: 'Filename',
  }
}

export function buildSmsFilePath(file: File, draft: Pick<SmsFileDraft, 'category' | 'docNo' | 'title' | 'revision'>) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safe = (value: string, fallback: string) =>
    String(value || fallback)
      .normalize('NFKD')
      .replace(/[^\w\s.-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 90) || fallback
  return `${draft.category}/${safe(draft.docNo, 'NO_DOC')}/${safe(draft.docNo, 'NO_DOC')}_${safe(draft.title, 'SMS_Document')}_${safe(draft.revision || 'NO_REV', 'NO_REV')}_${Date.now()}.${ext}`
}
