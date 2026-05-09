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
  update_round?: string | null
  update_date?: string | null
  created_at?: string | null
}

export type SmsUploadInputProps = {
  webkitdirectory?: string
  directory?: string
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
  const clean = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-:]\s*$/g, '')
    .trim()
  if (/^[0-9.\s]+$/.test(clean)) {
    return clean.replace(/\s+/g, '').replace(/\.+/g, '.')
  }
  return clean
}

function normalizeHeaderDocNo(value: string, category: SmsCategory) {
  const docNo = normalizeDocNo(value)
  if (!docNo) return ''
  if (category === 'Procedure' && /^\d+(?:\.\d+)*$/.test(docNo)) {
    return `Procedure ${docNo}`
  }
  return docNo
}

export function normalizeRevision(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const compact = raw.replace(/\s+/g, '')
  const direct = compact.match(/^(?:rev(?:ision)?\.?)?([0-9]{1,3}[a-z]?)$/i)
  if (direct) return `Rev.${direct[1].padStart(2, '0')}`
  const match = raw.match(/(?:rev(?:ision)?\.?\s*)?([0-9]{1,3}[a-z]?)/i)
  if (!match) return raw
  return `Rev.${match[1].padStart(2, '0')}`
}

export function parseSmsDate(value: string) {
  const raw = String(value || '')
    .replace(/,/g, ' ')
    .replace(/\b(\d)\s+(\d)\s+([A-Za-z]+)\s+(20\d)\s+(\d)\b/g, '$1$2 $3 $4$5')
    .replace(/\b([A-Za-z]+)\s+(20\d)\s+(\d)\b/g, '$1 $2$3')
    .replace(/\s+/g, ' ')
    .trim()
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
  const name = `${file.webkitRelativePath || ''}/${file.name}`.toLowerCase()
  return name.includes('change record') || name.includes('change_record') || name.includes('00_change')
}

export function getSmsCategoryFromPath(file: File): SmsCategory | null {
  const path = String(file.webkitRelativePath || file.name || '').toLowerCase()
  if (/(^|[/\\])(procedure|procedures)([/\\]|$)/i.test(path) || path.includes('procedure')) return 'Procedure'
  if (/(^|[/\\])(checklist|checklists|form|forms)([/\\]|$)/i.test(path) || path.includes('checklist')) return 'Checklist'
  return null
}

function cleanText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function stripAfterHeaderLabel(value: string) {
  return cleanText(String(value || '').split(/\b(?:title|revision\s*(?:number|no)?|effective\s*date|document\s*(?:number|no|#)?|reviewed\s*by|approved\s*by|page)\b/i)[0] || '')
}

function getHeaderField(text: string, labels: string[]) {
  const value = pickValueAfterLabel(text, labels)
  return stripAfterHeaderLabel(value)
}

async function readDocxXml(file: File) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  return zip.file('word/document.xml')?.async('text') || ''
}

async function readDocxHeaderXmls(file: File) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const xmls: string[] = []

  const headerFiles = Object.keys(zip.files)
    .filter((name) => /^word\/(?:header|footer)\d+\.xml$/i.test(name))
    .sort()

  for (const name of headerFiles) {
    const xml = await zip.file(name)?.async('text')
    if (xml) xmls.push(xml)
  }

  const bodyXml = await zip.file('word/document.xml')?.async('text')
  if (bodyXml) xmls.push(bodyXml)
  return xmls
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
  const parts = String(text || '')
    .split('|')
    .map((part) => cleanText(part))
    .filter(Boolean)
  const labelLike = /^(title|revision\s*(number|no)?|effective\s*date|document\s*(number|no|#)?|reviewed\s*by|approved\s*by|page|vessel|date\s*\/\s*place|position\s*\/\s*rank)\b/i

  for (const label of labels) {
    const labelPattern = new RegExp(`^${label}\\s*[:\\-]?\\s*(.*)$`, 'i')
    for (let index = 0; index < parts.length; index += 1) {
      const match = parts[index].match(labelPattern)
      if (!match) continue

      const inlineValue = cleanText(match[1] || '')
      if (inlineValue && !labelLike.test(inlineValue)) return inlineValue

      const values: string[] = []
      for (let next = index + 1; next < Math.min(parts.length, index + 9); next += 1) {
        const candidate = cleanText(parts[next])
        if (!candidate) continue
        if (labelLike.test(candidate)) break
        values.push(candidate)
      }
      if (values.length > 0) return values.join(' ')
    }

    const loosePattern = new RegExp(`${label}\\s*[:\\-]?\\s*([^|\\n]{1,120})`, 'i')
    const looseMatch = text.match(loosePattern)
    if (looseMatch?.[1]) return cleanText(looseMatch[1])
  }
  return ''
}

async function readPdfPagesText(file: File, pagesToRead: number[]) {
  let pdfjs: any
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  } catch {
    pdfjs = await import('pdfjs-dist')
  }
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = ''
  }
  const documentTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const pdf = await documentTask.promise
  const pageTexts: string[] = []

  for (const pageNo of pagesToRead) {
    if (pageNo < 1 || pageNo > pdf.numPages) continue
    const page = await pdf.getPage(pageNo)
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item: unknown) => {
        if (item && typeof item === 'object' && 'str' in item) {
          return String((item as { str?: unknown }).str || '')
        }
        return ''
      })
      .join(' | ')
    pageTexts.push(text)
  }

  return pageTexts.join(' | ')
}

export async function readSmsDocumentHeader(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const filename = parseSmsFilename(file.name)

  try {
    if (ext === 'docx') {
      const xmls = await readDocxHeaderXmls(file)
      const rows = xmls.flatMap((xml) => parseDocxRows(xml))
      const headerText = rows.slice(0, 24).flat().join(' | ')
      const docNo = getHeaderField(headerText, ['Document Number', 'Document No', 'Doc No'])
      const title = getHeaderField(headerText, ['Title'])
      const revision = getHeaderField(headerText, ['Revision Number', 'Revision No', 'Revision'])
      const effectiveDate = getHeaderField(headerText, ['Effective Date'])
      return {
        docNo: normalizeHeaderDocNo(docNo, filename.category) || filename.docNo,
        title: title || filename.title,
        revision: normalizeRevision(revision) || filename.revision,
        effectiveDate: parseSmsDate(effectiveDate) || '',
        source: 'DOCX header/footer',
      }
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }).slice(0, 12) as unknown[][]
      const headerText = rows.flat().map((value) => cleanText(String(value || ''))).filter(Boolean).join(' | ')
      const docNo = getHeaderField(headerText, ['Document Number', 'Document No', 'Doc No'])
      const title = getHeaderField(headerText, ['Title'])
      const revision = getHeaderField(headerText, ['Revision Number', 'Revision No', 'Revision'])
      const effectiveDate = getHeaderField(headerText, ['Effective Date'])
      return {
        docNo: normalizeHeaderDocNo(docNo, filename.category) || filename.docNo,
        title: title || filename.title,
        revision: normalizeRevision(revision) || filename.revision,
        effectiveDate: parseSmsDate(effectiveDate) || '',
        source: 'Excel header',
      }
    }

    if (ext === 'pdf') {
      const isProcedure = filename.category === 'Procedure'
      const headerText = cleanText(await readPdfPagesText(file, isProcedure ? [2, 3, 1] : [1, 2]))
      const docNo = getHeaderField(headerText, ['Document Number', 'Document No', 'Doc No'])
      const title = getHeaderField(headerText, ['Title'])
      const revision = getHeaderField(headerText, ['Revision Number', 'Revision No', 'Revision'])
      const effectiveDate = getHeaderField(headerText, ['Effective Date'])
      return {
        docNo: normalizeHeaderDocNo(docNo, filename.category) || filename.docNo,
        title: title || filename.title,
        revision: normalizeRevision(revision) || filename.revision,
        effectiveDate: parseSmsDate(effectiveDate) || '',
        source: headerText ? `PDF page ${isProcedure ? '2/3/1' : '1/2'}` : 'Filename',
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
