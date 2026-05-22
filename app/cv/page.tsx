'use client'

import Link from 'next/link'
import { Suspense, type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BriefcaseBusiness, CalendarDays, Download, FileBadge, PencilLine, Plus, Ship, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { AI_MODELS, compressImage } from '@/lib/certificateUpload'
import { readCurrentUser, type CurrentUser } from '@/lib/currentUser'
import { dayDiffInclusive, formatServiceDuration, formatYearsOneDecimal, getSeaServiceMetrics, sameMetricLabel } from '@/lib/cvMetrics'
import { canManageCvDashboard, isAdminRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

type VesselMaster = {
  id: string
  vessel_name: string
  vessel_type: string | null
  flag: string | null
  imo_no: string | null
  grt: string | null
  dwt: string | null
  engine_type: string | null
  bhp: string | null
  company: string | null
  trading_area: string | null
}

type SeaServiceForm = Omit<VesselMaster, 'id'> & {
  crew_id: string
  vessel_master_id: string | null
  rank: string | null
  charterer: string | null
  joining_date: string | null
  sign_off_date: string | null
  remarks: string | null
}

type SeaServiceRow = SeaServiceForm & {
  id: string
}

type CvProfile = {
  national_id_no: string
  nationality: string
  date_of_birth: string
  place_of_birth: string
  cv_company: string
  toeic_score: string
  toeic_test_date: string
  picture_data_url: string
}

type PassportCvProfileData = {
  nationalIdNo?: string | null
  nationality?: string | null
  dateOfBirth?: string | null
  placeOfBirth?: string | null
}

type CrewCert = {
  id: string
  cert_name: string
  issue_date: string | null
  expiry_date: string | null
  file_url: string | null
  cert_number?: string | null
  place_of_issue?: string | null
  issue_authority?: string | null
  cv_section?: string | null
  cv_row_no?: number | null
  cv_competency_title?: string | null
  cv_capacity?: string | null
  master_cert_family?: string | null
  master_cv_section?: string | null
  master_stcw_group_key?: string | null
  master_requires_proficiency?: boolean | null
  master_required_proficiency_key?: string | null
  master_cv_order?: number | null
  linked_training_id?: string | null
}

type CvTrainingProficiencyPair = {
  training?: CrewCert
  proficiency?: CrewCert
  requiresProficiency?: boolean
}

type CertMasterCvRule = {
  cert_name: string
  cert_family?: string | null
  cv_section?: string | null
  stcw_group_key?: string | null
  requires_proficiency?: boolean | null
  required_proficiency_key?: string | null
  cv_order?: number | null
}

type VaccinationRow = {
  id: string
  crew_id: string
  vaccine_name: string
  dose_detail: string | null
  date_given: string | null
  expiry_date: string | null
  place_given: string | null
  remarks: string | null
}

type CvTab = 'personal' | 'certificates' | 'service' | 'review' | 'vessels'
type ActiveUser = CurrentUser & { id: string }
const defaultCvCompany = 'Truth Maritime Services'

const emptyProfile: CvProfile = {
  national_id_no: '',
  nationality: '',
  date_of_birth: '',
  place_of_birth: '',
  cv_company: defaultCvCompany,
  toeic_score: '',
  toeic_test_date: '',
  picture_data_url: '',
}

const emptySeaService: SeaServiceForm = {
  crew_id: '',
  vessel_master_id: null,
  vessel_name: '',
  vessel_type: '',
  flag: '',
  imo_no: '',
  grt: '',
  dwt: '',
  engine_type: '',
  bhp: '',
  company: defaultCvCompany,
  trading_area: '',
  rank: '',
  charterer: 'PTTEP',
  joining_date: '',
  sign_off_date: '',
  remarks: '',
}

const emptyVessel: Omit<VesselMaster, 'id'> = {
  vessel_name: '',
  vessel_type: '',
  flag: '',
  imo_no: '',
  grt: '',
  dwt: '',
  engine_type: '',
  bhp: '',
  company: '',
  trading_area: '',
}

const emptyVaccination: Omit<VaccinationRow, 'id'> = {
  crew_id: '',
  vaccine_name: '',
  dose_detail: '',
  date_given: '',
  expiry_date: '',
  place_given: '',
  remarks: '',
}

const clean = (value: unknown) => String(value || '').trim()
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')
const isManualCvCert = (cert?: CrewCert | null) => Boolean(cert?.id?.startsWith('manual-cv-'))
const isManualCvCertId = (certId?: string) => Boolean(certId?.startsWith('manual-cv-'))
const isRequiredProficiencyPlaceholder = (cert?: CrewCert | null) => Boolean(cert?.id?.startsWith('manual-cv-required-proficiency-'))

const rankGroups = [
  {
    label: 'Accommodation barge',
    options: ['Barge Master', 'Chief Officer', 'Safety Officer', 'Radio Operator', 'Crane Operator', 'Bosun', 'Assist Bosun', 'Deck helper', 'Chief Engineer', 'Second Engineer', 'Electrician', 'Tr.Electrician', 'Fitter', 'Oiler', 'Catering'],
  },
  {
    label: 'Merchant ship',
    options: ['Master', 'Chief Officer', 'Second Officer', 'Third Officer', 'Fourth Officer', 'Deck Cadet', 'Bosun', 'Able Seaman', 'Ordinary Seaman', 'Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer', 'Electrician', 'Engine Cadet', 'Fitter', 'Oiler', 'Wiper', 'Chief Cook', 'Mess Man'],
  },
]

const toDateValue = (value?: string | null) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatTemplateDate = (value?: string | null) => {
  const date = formatDate(value)
  return date === '-' ? '' : date
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Never updated'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read certificate file'))
    reader.readAsDataURL(blob)
  })

const splitCrewName = (value?: string | null) => {
  const stripped = clean(value).replace(/^(mr|mrs|ms|miss)\.?\s+/i, '')
  const parts = stripped.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { name: stripped, surname: '' }
  return { name: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] }
}

const manualCompetencyKey = (crewId: string) => `kmt_cv_manual_competency_${crewId}`
const cvPictureKey = (crewId: string) => `kmt_cv_picture_${crewId}`
const cvHiddenCertsKey = (crewId: string) => `kmt_cv_hidden_certs_${crewId}`
const cvManualCertsKey = (crewId: string) => `kmt_cv_manual_certs_${crewId}`
const cvPairOrderKey = (crewId: string) => `kmt_cv_pair_order_${crewId}`

function profileSnapshot(profile: CvProfile) {
  return JSON.stringify({
    national_id_no: clean(profile.national_id_no),
    nationality: clean(profile.nationality),
    date_of_birth: toDateValue(profile.date_of_birth),
    place_of_birth: clean(profile.place_of_birth),
    cv_company: clean(profile.cv_company),
    toeic_score: clean(profile.toeic_score),
    toeic_test_date: toDateValue(profile.toeic_test_date),
  })
}

function certSnapshot(cert: CrewCert) {
  return JSON.stringify({
    cert_name: clean(cert.cert_name),
    issue_date: toDateValue(cert.issue_date),
    expiry_date: toDateValue(cert.expiry_date),
    cert_number: clean(cert.cert_number),
    place_of_issue: clean(cert.place_of_issue),
    issue_authority: clean(cert.issue_authority),
    cv_section: clean(cert.cv_section),
    cv_row_no: cert.cv_row_no || null,
    cv_competency_title: clean(cert.cv_competency_title),
    cv_capacity: clean(cert.cv_capacity),
    linked_training_id: clean(cert.linked_training_id),
  })
}

function serviceFormSnapshot(form: SeaServiceForm) {
  return JSON.stringify({
    vessel_master_id: clean(form.vessel_master_id),
    vessel_name: clean(form.vessel_name),
    vessel_type: clean(form.vessel_type),
    flag: clean(form.flag),
    imo_no: clean(form.imo_no),
    grt: clean(form.grt),
    dwt: clean(form.dwt),
    engine_type: clean(form.engine_type),
    bhp: clean(form.bhp),
    company: clean(form.company),
    trading_area: clean(form.trading_area),
    rank: clean(form.rank),
    charterer: clean(form.charterer),
    joining_date: toDateValue(form.joining_date),
    sign_off_date: toDateValue(form.sign_off_date),
    remarks: clean(form.remarks),
  })
}

function formatCvCertName(value?: string | null) {
  const raw = clean(value)
  if (!raw) return ''
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(')
    .trim()
}

function isGenericCompetencyName(value?: string | null) {
  const normalized = normalize(value)
  return normalized === 'certificateofcompetencycoc' || normalized === 'certificateofcompetency'
}

const buildManualCompetency = (crew?: CurrentUser | null): CrewCert => ({
  id: `manual-cv-competency-${crew?.id || 'current'}`,
  cert_name: '',
  issue_date: null,
  expiry_date: null,
  file_url: null,
  cert_number: '',
  place_of_issue: '',
  issue_authority: '',
  cv_section: 'Certificate of Competency',
  cv_competency_title: '',
  cv_capacity: '',
  master_cv_section: 'Certificate of Competency',
  master_cv_order: 10,
})

function getCompetencyDisplayTitle(cert?: CrewCert | null) {
  return clean(cert?.cv_competency_title) || clean(cert?.cert_name)
}

const buildManualCvCert = (section: string, linkedTraining?: CrewCert): CrewCert => ({
  id: `manual-cv-extra-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  cert_name: section === 'Certificate of Proficiency'
    ? `${formatCvCertName(linkedTraining?.cert_name) || 'Manual Certificate'} (COP)`
    : 'Manual Certificate of Training',
  issue_date: null,
  expiry_date: null,
  file_url: null,
  cert_number: '',
  place_of_issue: '',
  issue_authority: '',
  cv_section: section,
  master_cv_section: section,
  linked_training_id: linkedTraining?.id || null,
  master_cv_order: 999,
})

const buildRequiredProficiencyPlaceholder = (trainingCert: CrewCert): CrewCert => ({
  id: `manual-cv-required-proficiency-${trainingCert.id}`,
  cert_name: `${formatCvCertName(trainingCert.cert_name)} (COP)`,
  issue_date: null,
  expiry_date: null,
  file_url: null,
  cert_number: '',
  place_of_issue: '',
  issue_authority: '',
  cv_section: 'Certificate of Proficiency',
  master_cv_section: 'Certificate of Proficiency',
  master_stcw_group_key: trainingCert.master_required_proficiency_key || trainingCert.master_stcw_group_key || null,
  linked_training_id: trainingCert.id,
  master_cv_order: trainingCert.master_cv_order || 999,
})

const isManualCompetencyCert = (cert?: CrewCert | null) => Boolean(cert?.id?.startsWith('manual-cv-competency-'))

function readStoredArray<T>(key: string): T[] {
  try {
    const stored = localStorage.getItem(key)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const readManualCompetency = (crew: ActiveUser) => {
  const fallback = buildManualCompetency(crew)
  try {
    const saved = localStorage.getItem(manualCompetencyKey(crew.id))
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback
  } catch {
    return fallback
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function applyCvTemplateBorders(XLSX: typeof import('xlsx'), worksheet: any) {
  const ranges = ['A2:M10', 'A14:M17', 'A20:M38', 'A40:M43', 'A45:M48', 'A51:M70']
  const border = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }
  ranges.forEach((rangeAddress) => {
    const range = XLSX.utils.decode_range(rangeAddress)
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const address = XLSX.utils.encode_cell({ r: row, c: col })
        worksheet[address] = {
          ...(worksheet[address] || { t: 's', v: '' }),
          s: {
            ...(worksheet[address]?.s || {}),
            border: worksheet[address]?.s?.border || border,
            alignment: { ...(worksheet[address]?.s?.alignment || {}), vertical: 'center', wrapText: true },
          },
        }
      }
    }
  })
}

function downloadWorkbook(workbook: ArrayBuffer | Uint8Array, fileName: string) {
  const blobSource = workbook instanceof Uint8Array
    ? workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength) as ArrayBuffer
    : workbook
  const blob = new Blob([blobSource], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function parseDataUrl(dataUrl: string) {
  const [meta, payload] = dataUrl.split(',')
  const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/png'
  const extension = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png'
  const binary = atob(payload || '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return { bytes, extension, mime }
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function certNeedsCvRefresh(cert: CrewCert) {
  if (!cert.file_url || isManualCvCert(cert) || isRequiredProficiencyPlaceholder(cert)) return false
  const section = getCvCertSection(cert)
  if (section === 'Certificate of Competency') {
    const competencyTitle = getCompetencyDisplayTitle(cert)
    return !competencyTitle || isGenericCompetencyName(competencyTitle) || !cert.cv_capacity || !cert.issue_date || !cert.cert_number || !cert.issue_authority
  }
  if (section === 'Certificate of Proficiency') {
    return !cert.issue_date || !cert.expiry_date || !cert.cert_number || !cert.issue_authority
  }
  if (section === 'Certificate of Training' || section === 'Medical') {
    return !cert.issue_date || !cert.expiry_date || !cert.cert_number || !cert.place_of_issue
  }
  return !cert.issue_date || !cert.expiry_date
}

const transparentCvPicturePngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnH8x8AAAAASUVORK5CYII='

async function imageDataUrlToPngBytes(dataUrl?: string | null) {
  if (!dataUrl) return Uint8Array.from(atob(transparentCvPicturePngBase64), (char) => char.charCodeAt(0))
  if (dataUrl.startsWith('data:image/png')) return parseDataUrl(dataUrl).bytes

  return new Promise<Uint8Array>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || image.width || 1
      canvas.height = image.naturalHeight || image.height || 1
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Could not prepare CV picture for export'))
        return
      }
      context.drawImage(image, 0, 0)
      const pngDataUrl = canvas.toDataURL('image/png')
      resolve(parseDataUrl(pngDataUrl).bytes)
    }
    image.onerror = () => reject(new Error('Could not prepare CV picture for export'))
    image.src = dataUrl
  })
}

function normalizePassportCvProfileData(value: any): PassportCvProfileData {
  return {
    nationalIdNo: clean(value?.nationalIdNo || value?.national_id_no),
    nationality: clean(value?.nationality),
    dateOfBirth: toDateValue(value?.dateOfBirth || value?.date_of_birth),
    placeOfBirth: clean(value?.placeOfBirth || value?.place_of_birth),
  }
}

function hasPassportCvProfileData(value: PassportCvProfileData) {
  return Boolean(value.nationalIdNo || value.nationality || value.dateOfBirth || value.placeOfBirth)
}

function normalizeCompetencyAiTitle(value?: string | null) {
  const title = clean(value)
  if (!title) return ''
  const stripped = title
    .replace(/^certificate of competency\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const splitMatch = stripped.match(/^(.*?)(?:\s+on\s+ships?\s+of\s+.+|\s+near\s+coastal\s+voyage.*|\s+\d[\d,]*(?:\.\d+)?\s*(?:gross tonnage|gt|kw|kW|propulsion power).*)$/i)
  return clean(splitMatch?.[1] || stripped)
}

function normalizeCompetencyAiCapacity(value?: string | null, fallbackTitle?: string | null) {
  const capacity = clean(value)
  if (capacity) {
    return capacity
      .replace(/^on\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const title = clean(fallbackTitle)
  if (!title) return ''
  const splitMatch = title.match(/(?:on\s+ships?\s+of\s+.+|near\s+coastal\s+voyage.*|\d[\d,]*(?:\.\d+)?\s*(?:gross tonnage|gt|kw|kW|propulsion power).*)$/i)
  if (splitMatch?.[0]) return clean(splitMatch[0]).replace(/^on\s+/i, '').trim()
  const match = title.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(gross tonnage|gt|kw|kW|propulsion power)\b[\s\S]*/i)
  if (!match) return ''
  return clean(match[0]).replace(/^on\s+/i, '').trim()
}

const cvSpreadsheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

function encodeCvCol(index: number) {
  let col = ''
  let current = index + 1
  while (current > 0) {
    const mod = (current - 1) % 26
    col = String.fromCharCode(65 + mod) + col
    current = Math.floor((current - mod) / 26)
  }
  return col
}

function decodeCvCol(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0] || ''
  return letters.split('').reduce((sum, char) => sum * 26 + char.toUpperCase().charCodeAt(0) - 64, 0) - 1
}

function getCvRow(doc: Document, rowNumber: number) {
  const sheetData = doc.getElementsByTagNameNS(cvSpreadsheetNs, 'sheetData')[0]
  const rows = Array.from(doc.getElementsByTagNameNS(cvSpreadsheetNs, 'row'))
  let row = rows.find((item) => item.getAttribute('r') === String(rowNumber))
  if (row || !sheetData) return row || null

  row = doc.createElementNS(cvSpreadsheetNs, 'row')
  row.setAttribute('r', String(rowNumber))
  const nextRow = rows.find((item) => Number(item.getAttribute('r') || 0) > rowNumber)
  if (nextRow) sheetData.insertBefore(row, nextRow)
  else sheetData.appendChild(row)
  return row
}

function getCvCell(doc: Document, row: Element, colIndex: number, rowNumber: number) {
  const ref = `${encodeCvCol(colIndex)}${rowNumber}`
  const cells = Array.from(row.getElementsByTagNameNS(cvSpreadsheetNs, 'c'))
  let cell = cells.find((item) => item.getAttribute('r') === ref)
  if (cell) return cell

  cell = doc.createElementNS(cvSpreadsheetNs, 'c')
  cell.setAttribute('r', ref)
  const nextCell = cells.find((item) => decodeCvCol(item.getAttribute('r') || '') > colIndex)
  if (nextCell) row.insertBefore(cell, nextCell)
  else row.appendChild(cell)
  return cell
}

function setCvCellValue(doc: Document, address: string, value: unknown) {
  const match = address.match(/^([A-Z]+)(\d+)$/i)
  if (!match) return
  const rowNumber = Number(match[2])
  const row = getCvRow(doc, rowNumber)
  if (!row) return

  const cell = getCvCell(doc, row, decodeCvCol(address), rowNumber)
  const nextValue = value == null ? '' : String(value)
  cell.setAttribute('t', 'inlineStr')
  Array.from(cell.childNodes).forEach((node) => cell.removeChild(node))

  const is = doc.createElementNS(cvSpreadsheetNs, 'is')
  const t = doc.createElementNS(cvSpreadsheetNs, 't')
  t.textContent = nextValue
  t.setAttribute('xml:space', 'preserve')
  is.appendChild(t)
  cell.appendChild(is)
}

function setCvCellStyle(doc: Document, address: string, styleId: string) {
  const match = address.match(/^([A-Z]+)(\d+)$/i)
  if (!match) return
  const rowNumber = Number(match[2])
  const row = getCvRow(doc, rowNumber)
  if (!row) return
  const cell = getCvCell(doc, row, decodeCvCol(address), rowNumber)
  cell.setAttribute('s', styleId)
}

function ensureContentType(contentTypes: string, extension: string, mime: string, drawingPath: string) {
  let next = contentTypes
  if (!next.includes(`Extension="${extension}"`)) {
    next = next.replace('</Types>', `<Default Extension="${extension}" ContentType="${mime}"/></Types>`)
  }
  const drawingPart = `/${drawingPath}`
  if (!next.includes(`PartName="${drawingPart}"`)) {
    next = next.replace('</Types>', `<Override PartName="${drawingPart}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`)
  }
  return next
}

async function embedCvPictureInWorkbook(workbookArray: ArrayBuffer, pictureDataUrl?: string | null) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(workbookArray)
  const templatePicturePath = 'xl/media/image1.png'
  if (!zip.file(templatePicturePath)) return workbookArray
  const drawingPath = 'xl/drawings/drawing1.xml'
  const drawingXml = await zip.file(drawingPath)?.async('string')
  if (drawingXml) {
    const widthEmu = 1800000
    const heightEmu = 2340000
    const tunedDrawingXml = drawingXml
      .replace(/<a:ext cx="[^"]+" cy="[^"]+"\/>/, `<a:ext cx="${widthEmu}" cy="${heightEmu}"/>`)
      .replace(/<a:srcRect[^>]*\/>/, '')
      .replace(/<xdr:to><xdr:col>[^<]+<\/xdr:col><xdr:colOff>[^<]+<\/xdr:colOff><xdr:row>[^<]+<\/xdr:row><xdr:rowOff>[^<]+<\/xdr:rowOff><\/xdr:to>/, '<xdr:to><xdr:col>12</xdr:col><xdr:colOff>746694</xdr:colOff><xdr:row>8</xdr:row><xdr:rowOff>282857</xdr:rowOff></xdr:to>')
    zip.file(drawingPath, tunedDrawingXml)
  }
  zip.file(templatePicturePath, await imageDataUrlToPngBytes(pictureDataUrl))
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

function CvPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const crewIdParam = searchParams.get('crewId') || ''
  const stepParam = searchParams.get('step') || ''
  const [sessionUser, setSessionUser] = useState<ActiveUser | null>(null)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sqlMissing, setSqlMissing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState('')
  const [profile, setProfile] = useState<CvProfile>(emptyProfile)
  const [vessels, setVessels] = useState<VesselMaster[]>([])
  const [services, setServices] = useState<SeaServiceRow[]>([])
  const [certRows, setCertRows] = useState<CrewCert[]>([])
  const [vaccinations, setVaccinations] = useState<VaccinationRow[]>([])
  const [serviceForm, setServiceForm] = useState<SeaServiceForm>(emptySeaService)
  const [vesselForm, setVesselForm] = useState<Omit<VesselMaster, 'id'>>(emptyVessel)
  const [vaccinationForm, setVaccinationForm] = useState<Omit<VaccinationRow, 'id'>>(emptyVaccination)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [savingCertId, setSavingCertId] = useState('')
  const [fillingCertId, setFillingCertId] = useState('')
  const [checkedPassportHistory, setCheckedPassportHistory] = useState(false)
  const [savingVaccination, setSavingVaccination] = useState(false)
  const [refreshingCvData, setRefreshingCvData] = useState(false)
  const [selectedVesselId, setSelectedVesselId] = useState('')
  const [activeTab, setActiveTab] = useState<CvTab>('personal')
  const [editingServiceId, setEditingServiceId] = useState('')
  const [manualCompetency, setManualCompetency] = useState<CrewCert | null>(null)
  const [manualCvCerts, setManualCvCerts] = useState<CrewCert[]>([])
  const [hiddenCvCertIds, setHiddenCvCertIds] = useState<string[]>([])
  const [cvPairOrder, setCvPairOrder] = useState<string[]>([])
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState('')
  const [profileTouched, setProfileTouched] = useState(false)
  const [savedCertSnapshots, setSavedCertSnapshots] = useState<Record<string, string>>({})
  const [editingServiceSnapshot, setEditingServiceSnapshot] = useState('')
  const [selectedMetricCompany, setSelectedMetricCompany] = useState('')
  const [selectedMetricType, setSelectedMetricType] = useState('')
  const [selectedMetricRank, setSelectedMetricRank] = useState('')
  const serviceEntryRef = useRef<HTMLElement | null>(null)

  function hydrateLocalState(current: ActiveUser) {
    const currentId = current.id
    setUser(current)
    setLastUpdatedAt(clean((current as any).cv_last_updated_at))
    setProfile({
      national_id_no: clean((current as any).national_id_no),
      nationality: clean((current as any).nationality),
      date_of_birth: toDateValue((current as any).date_of_birth),
      place_of_birth: clean((current as any).place_of_birth),
      cv_company: clean((current as any).cv_company || defaultCvCompany),
      toeic_score: clean((current as any).toeic_score),
      toeic_test_date: toDateValue((current as any).toeic_test_date),
      picture_data_url: localStorage.getItem(cvPictureKey(currentId)) || '',
    })
    setSavedProfileSnapshot(profileSnapshot({
      national_id_no: clean((current as any).national_id_no),
      nationality: clean((current as any).nationality),
      date_of_birth: toDateValue((current as any).date_of_birth),
      place_of_birth: clean((current as any).place_of_birth),
      cv_company: clean((current as any).cv_company || defaultCvCompany),
      toeic_score: clean((current as any).toeic_score),
      toeic_test_date: toDateValue((current as any).toeic_test_date),
      picture_data_url: localStorage.getItem(cvPictureKey(currentId)) || '',
    }))
    setProfileTouched(false)
    const nextServiceForm = { ...emptySeaService, crew_id: currentId, rank: current.position || '', company: clean((current as any).cv_company || defaultCvCompany) }
    setServiceForm(nextServiceForm)
    setEditingServiceSnapshot(serviceFormSnapshot(nextServiceForm))
    setVaccinationForm((prev) => ({ ...prev, crew_id: currentId }))
    setManualCompetency(readManualCompetency(current))
    setManualCvCerts(readStoredArray<CrewCert>(cvManualCertsKey(currentId)))
    setHiddenCvCertIds(readStoredArray<string>(cvHiddenCertsKey(currentId)))
    setCvPairOrder(readStoredArray<string>(cvPairOrderKey(currentId)))
  }

  useEffect(() => {
    const current = readCurrentUser()
    if (!current?.id) {
      router.replace('/login')
      return
    }
    const activeUser = current as ActiveUser
    setSessionUser(activeUser)

    const bootstrap = async () => {
      let targetUser = activeUser
      if (crewIdParam && crewIdParam !== activeUser.id && canManageCvDashboard(activeUser.position)) {
        const { data, error } = await supabase
          .from('crews')
          .select('id, full_name, position, national_id_no, nationality, date_of_birth, place_of_birth, cv_company, toeic_score, toeic_test_date, suit_color, suit_size, boot_size, cv_last_updated_at')
          .eq('id', crewIdParam)
          .maybeSingle()

        if (error || !data?.id) {
          toast.error('Could not open selected crew CV')
          router.replace('/cv')
          return
        }
        targetUser = data as ActiveUser
      }

      hydrateLocalState(targetUser)
      await loadCv(targetUser, activeUser)
    }

    void bootstrap()
  }, [crewIdParam, router])

  useEffect(() => {
    if (stepParam === 'review') setActiveTab('review')
  }, [stepParam])

  const admin = isAdminRole(sessionUser?.position)
  const canOpenDashboard = canManageCvDashboard(sessionUser?.position)
  const viewingOwnCv = user?.id && sessionUser?.id ? user.id === sessionUser.id : true

  const serviceSummary = useMemo(() => {
    return getSeaServiceMetrics(
      services,
      user?.position as string | undefined,
      selectedMetricType || undefined,
      selectedMetricCompany || undefined,
      selectedMetricRank || undefined,
    )
  }, [selectedMetricCompany, selectedMetricRank, selectedMetricType, services, user?.position])

  const cvRefreshTargets = useMemo(
    () => certRows.filter((cert) => certNeedsCvRefresh(cert)),
    [certRows],
  )

  const cvSourceRows = useMemo(() => {
    const hasRealCompetency = certRows.some((cert) => getCvCertSection(cert) === 'Certificate of Competency')
    const baseRows = !hasRealCompetency && manualCompetency ? [...certRows, manualCompetency] : certRows
    return [...baseRows, ...manualCvCerts].filter((cert) => !hiddenCvCertIds.includes(cert.id))
  }, [certRows, hiddenCvCertIds, manualCompetency, manualCvCerts])

  const profileDirty = useMemo(() => profileSnapshot(profile) !== savedProfileSnapshot, [profile, savedProfileSnapshot])
  const showProfileSave = profileTouched && profileDirty
  const certDirtyMap = useMemo(() => {
    return Object.fromEntries(cvSourceRows.map((cert) => [cert.id, savedCertSnapshots[cert.id] !== certSnapshot(cert)]))
  }, [cvSourceRows, savedCertSnapshots])
  const dirtyCertCount = useMemo(() => Object.values(certDirtyMap).filter(Boolean).length, [certDirtyMap])
  const serviceDirty = useMemo(() => serviceFormSnapshot(serviceForm) !== editingServiceSnapshot, [editingServiceSnapshot, serviceForm])

  useEffect(() => {
    if (!profileDirty && profileTouched) {
      setProfileTouched(false)
    }
  }, [profileDirty, profileTouched])

  useEffect(() => {
    const hasCompany = selectedMetricCompany && serviceSummary.companyOptions.some((option) => sameMetricLabel(option, selectedMetricCompany))
    const hasType = selectedMetricType && serviceSummary.typeOptions.some((option) => sameMetricLabel(option, selectedMetricType))
    const hasRank = selectedMetricRank && serviceSummary.rankOptions.some((option) => sameMetricLabel(option, selectedMetricRank))
    if (!hasCompany && serviceSummary.currentCompany) setSelectedMetricCompany(serviceSummary.currentCompany)
    if (!hasType && serviceSummary.currentType) setSelectedMetricType(serviceSummary.currentType)
    if (!hasRank && serviceSummary.currentRank) setSelectedMetricRank(serviceSummary.currentRank)
  }, [
    selectedMetricCompany,
    selectedMetricRank,
    selectedMetricType,
    serviceSummary.companyOptions,
    serviceSummary.currentCompany,
    serviceSummary.currentRank,
    serviceSummary.currentType,
    serviceSummary.rankOptions,
    serviceSummary.typeOptions,
  ])

  const completionStatus = useMemo(() => {
    const personalMissing = [
      !profile.national_id_no ? 'National ID No.' : '',
      !profile.nationality ? 'Nationality' : '',
      !profile.date_of_birth ? 'Date of Birth' : '',
      !profile.place_of_birth ? 'Place of Birth' : '',
    ].filter(Boolean)
    const personalComplete = personalMissing.length === 0
    const certificatesComplete = cvRefreshTargets.length === 0
    const serviceComplete = services.length > 0
    const certificatesMissing = cvRefreshTargets.slice(0, 8).map((cert) => formatCvCertName(getCompetencyDisplayTitle(cert) || cert.cert_name))
    const serviceMissing = serviceComplete ? [] : ['Add at least one sailing voyage row']
    const personalWarnings = profileDirty ? ['Personal details edited but not saved yet'] : []
    const certificatesWarnings = dirtyCertCount > 0 ? [`${dirtyCertCount} certificate row(s) edited but not saved yet`] : []
    const serviceWarnings = editingServiceId && serviceDirty ? ['Sea service row edited but not saved yet'] : []
    return {
      personalComplete,
      personalMissing,
      certificatesComplete,
      certificatesMissing,
      serviceComplete,
      serviceMissing,
      reviewNotes: [...personalMissing, ...certificatesMissing, ...serviceMissing, ...personalWarnings, ...certificatesWarnings, ...serviceWarnings],
      allComplete: personalComplete && certificatesComplete && serviceComplete,
      personalDirty: profileDirty,
      certificatesDirty: dirtyCertCount,
      serviceDirty,
      personalWarnings,
      certificatesWarnings,
      serviceWarnings,
    }
  }, [cvRefreshTargets, dirtyCertCount, editingServiceId, profile.date_of_birth, profile.national_id_no, profile.nationality, profile.place_of_birth, profileDirty, serviceDirty, services.length])

  const personalDocs = useMemo(() => buildPersonalDocs(certRows), [certRows])
  const cvCertTables = useMemo(() => applyCvPairOrder(buildCvCertTables(cvSourceRows), cvPairOrder), [cvPairOrder, cvSourceRows])

  useEffect(() => {
    if (!user?.id || checkedPassportHistory) return
    const missingPassportFields = !profile.national_id_no || !profile.nationality || !profile.date_of_birth || !profile.place_of_birth
    if (!missingPassportFields) {
      setCheckedPassportHistory(true)
      return
    }
    setCheckedPassportHistory(true)
    fillPassportProfileFromHistory(false).catch(() => undefined)
  }, [checkedPassportHistory, profile.date_of_birth, profile.national_id_no, profile.nationality, profile.place_of_birth, user?.id])

  useEffect(() => {
    if (activeTab !== 'service' || !editingServiceId) return
    const timer = window.setTimeout(() => {
      const target = serviceEntryRef.current
      if (!target) return
      const top = target.getBoundingClientRect().top + window.scrollY - 112
      window.scrollTo({ top, behavior: 'smooth' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [activeTab, editingServiceId])

  async function loadCv(current: ActiveUser, session: ActiveUser | null = null) {
    setLoading(true)
    setSqlMissing(false)
    const [vesselRes, serviceRes, certRes, certMasterRes, vaccinationRes, crewProfileRes] = await Promise.all([
      supabase.from('cv_vessel_master').select('*').order('vessel_name', { ascending: true }),
      supabase
        .from('crew_cv_sea_services')
        .select('*')
        .eq('crew_id', current.id)
        .order('joining_date', { ascending: false, nullsFirst: false })
        .order('sign_off_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('crew_certs')
        .select('id, cert_name, issue_date, expiry_date, file_url, cert_number, place_of_issue, issue_authority, cv_section, cv_row_no, cv_competency_title, cv_capacity')
        .eq('crew_id', current.id),
      supabase
        .from('cert_master')
        .select('cert_name, cert_family, cv_section, stcw_group_key, requires_proficiency, required_proficiency_key, cv_order'),
      supabase
        .from('crew_cv_vaccinations')
        .select('*')
        .eq('crew_id', current.id)
        .order('date_given', { ascending: false, nullsFirst: false }),
      supabase
        .from('crews')
        .select('national_id_no, nationality, date_of_birth, place_of_birth, cv_company, toeic_score, toeic_test_date, suit_color, suit_size, boot_size, cv_last_updated_at')
        .eq('id', current.id)
        .maybeSingle(),
    ])

    if (vesselRes.error || serviceRes.error || vaccinationRes.error) {
      setSqlMissing(true)
      setLoading(false)
      return
    }

    const nextServices = (serviceRes.data || []) as SeaServiceRow[]
    setVessels((vesselRes.data || []) as VesselMaster[])
    setServices(nextServices)
    setEditingServiceId('')
    const resetServiceForm = {
      ...emptySeaService,
      crew_id: current.id,
      rank: current.position || '',
      company: clean((current as any).cv_company || defaultCvCompany),
    }
    setServiceForm(resetServiceForm)
    setEditingServiceSnapshot(serviceFormSnapshot(resetServiceForm))
    if (!crewProfileRes.error && crewProfileRes.data) {
      const dbProfile = crewProfileRes.data as any
      const mergedProfile = {
        national_id_no: clean(dbProfile.national_id_no) || clean((current as any).national_id_no),
        nationality: clean(dbProfile.nationality) || clean((current as any).nationality),
        date_of_birth: toDateValue(dbProfile.date_of_birth) || toDateValue((current as any).date_of_birth),
        place_of_birth: clean(dbProfile.place_of_birth) || clean((current as any).place_of_birth),
        cv_company: clean(dbProfile.cv_company || (current as any).cv_company || defaultCvCompany),
        toeic_score: clean(dbProfile.toeic_score || (current as any).toeic_score),
        toeic_test_date: toDateValue(dbProfile.toeic_test_date || (current as any).toeic_test_date),
        picture_data_url: localStorage.getItem(cvPictureKey(current.id)) || '',
      }
      setProfile(mergedProfile)
      setSavedProfileSnapshot(profileSnapshot(mergedProfile))
      setLastUpdatedAt(clean(dbProfile.cv_last_updated_at))
      const nextUser = { ...current, ...dbProfile }
      setUser(nextUser)
      if (session?.id === current.id) {
        setSessionUser(nextUser as ActiveUser)
        localStorage.setItem('kmt_user', JSON.stringify(nextUser))
        window.dispatchEvent(new Event('kmt-user-changed'))
      }
    }
    if (!certRes.error) {
      const nextCertRows = attachCertMasterRules((certRes.data || []) as CrewCert[], (certMasterRes.data || []) as CertMasterCvRule[])
      setCertRows(nextCertRows)
      setSavedCertSnapshots(Object.fromEntries(nextCertRows.map((cert) => [cert.id, certSnapshot(cert)])))
    }
    setVaccinations((vaccinationRes.data || []) as VaccinationRow[])
    setLoading(false)
  }

  function applyVesselShortcut(vesselId: string) {
    setSelectedVesselId(vesselId)
    const vessel = vessels.find((item) => item.id === vesselId)
    if (!vessel) return
    setServiceForm((prev) => ({
      ...prev,
      vessel_master_id: vessel.id,
      vessel_name: vessel.vessel_name || '',
      vessel_type: vessel.vessel_type || '',
      flag: vessel.flag || '',
      imo_no: vessel.imo_no || '',
      grt: vessel.grt || '',
      dwt: vessel.dwt || '',
      engine_type: vessel.engine_type || '',
      bhp: vessel.bhp || '',
      company: vessel.company || prev.company || profile.cv_company || defaultCvCompany,
      trading_area: vessel.trading_area || '',
    }))
  }

  function editVesselShortcut(vessel: VesselMaster) {
    setVesselForm(stripVesselId(vessel))
    setActiveTab('vessels')
  }

  async function saveProfile() {
    if (!user?.id) return
    const crewId = user.id
    setSavingProfile(true)
    const updatedAt = new Date().toISOString()
    const payload = {
      national_id_no: profile.national_id_no || null,
      nationality: profile.nationality || null,
      date_of_birth: profile.date_of_birth || null,
      place_of_birth: profile.place_of_birth || null,
      cv_company: profile.cv_company || null,
      toeic_score: profile.toeic_score || null,
      toeic_test_date: profile.toeic_test_date || null,
      cv_last_updated_at: updatedAt,
    }
    const { error } = await supabase.from('crews').update(payload).eq('id', crewId)
    setSavingProfile(false)
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    const nextUser = { ...user, ...payload }
    if (manualCompetency && user?.id) {
      localStorage.setItem(manualCompetencyKey(user.id), JSON.stringify(manualCompetency))
    }
    if (profile.picture_data_url && user?.id) {
      localStorage.setItem(cvPictureKey(user.id), profile.picture_data_url)
    }
    if (user?.id) {
      localStorage.setItem(cvManualCertsKey(user.id), JSON.stringify(manualCvCerts))
      localStorage.setItem(cvHiddenCertsKey(user.id), JSON.stringify(hiddenCvCertIds))
      localStorage.setItem(cvPairOrderKey(user.id), JSON.stringify(cvPairOrder))
    }
    if (viewingOwnCv) {
      localStorage.setItem('kmt_user', JSON.stringify(nextUser))
      window.dispatchEvent(new Event('kmt-user-changed'))
      setSessionUser(nextUser as ActiveUser)
    }
    setServiceForm((prev) => ({
      ...prev,
      company:
        !clean(prev.company) || clean(prev.company) === clean(defaultCvCompany) || clean(prev.company) === clean(profile.cv_company)
          ? clean(profile.cv_company) || defaultCvCompany
          : prev.company,
    }))
    setLastUpdatedAt(updatedAt)
    setUser(nextUser)
    setSavedProfileSnapshot(profileSnapshot(profile))
    setProfileTouched(false)
    toast.success('CV profile saved')
  }

  async function persistPassportProfileData(data: PassportCvProfileData, successMessage = 'Passport data added to CV profile', showToast = true) {
    if (!user?.id || !hasPassportCvProfileData(data)) return false

    const payload: Record<string, string> = {}
    if (data.nationalIdNo && !profile.national_id_no) payload.national_id_no = data.nationalIdNo
    if (data.nationality && !profile.nationality) payload.nationality = data.nationality
    if (data.dateOfBirth && !profile.date_of_birth) payload.date_of_birth = data.dateOfBirth
    if (data.placeOfBirth && !profile.place_of_birth) payload.place_of_birth = data.placeOfBirth
    if (Object.keys(payload).length === 0) return false

    payload.passport_cv_updated_at = new Date().toISOString()
    const { error } = await supabase.from('crews').update(payload).eq('id', user.id)
    if (error) throw error

    const nextProfile = {
      ...profile,
      national_id_no: payload.national_id_no || profile.national_id_no,
      nationality: payload.nationality || profile.nationality,
      date_of_birth: payload.date_of_birth || profile.date_of_birth,
      place_of_birth: payload.place_of_birth || profile.place_of_birth,
    }
    const nextUser = { ...user, ...payload }
    setProfile(nextProfile)
    setSavedProfileSnapshot(profileSnapshot(nextProfile))
    setProfileTouched(false)
    setUser(nextUser)
    if (viewingOwnCv) {
      localStorage.setItem('kmt_user', JSON.stringify(nextUser))
      window.dispatchEvent(new Event('kmt-user-changed'))
      setSessionUser(nextUser as ActiveUser)
    }
    if (showToast) toast.success(successMessage)
    return true
  }

  async function fillPassportProfileFromHistory(showToast = true) {
    if (!user?.id) return false
    const { data, error } = await supabase
      .from('crew_cert_history')
      .select('new_data')
      .eq('crew_id', user.id)
      .ilike('cert_name', '%passport%')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return false

    for (const row of (data || []) as Array<{ new_data?: any }>) {
      const passportData = normalizePassportCvProfileData(row.new_data?.passport_cv_data)
      if (!hasPassportCvProfileData(passportData)) continue
      const updated = await persistPassportProfileData(passportData, 'Passport data restored from upload history', showToast)
      if (updated) return true
    }
    return false
  }

  async function handleCvPictureUpload(file?: File | null) {
    if (!file || !user?.id) return
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Please upload JPG or PNG image')
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    setProfile((prev) => ({ ...prev, picture_data_url: dataUrl }))
    localStorage.setItem(cvPictureKey(user.id), dataUrl)
    toast.success('CV picture ready for export')
  }

  function updateProfileField<K extends keyof CvProfile>(field: K, value: CvProfile[K]) {
    setProfileTouched(true)
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  function scrollToSeaServiceEntry() {
    const target = serviceEntryRef.current
    if (!target) return
    const top = target.getBoundingClientRect().top + window.scrollY - 112
    window.requestAnimationFrame(() => {
      window.scrollTo({ top, behavior: 'smooth' })
    })
  }

  async function exportCvExcel() {
    if (!user) return
    const template = await fetch('/templates/cv-form-new-ver.xlsx')
    if (!template.ok) {
      toast.error('CV template file not found')
      return
    }
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await template.arrayBuffer())
    const sheetPath = 'xl/worksheets/sheet1.xml'
    const sheetXml = await zip.file(sheetPath)?.async('string')
    if (!sheetXml) {
      toast.error('CV template sheet not found')
      return
    }
    const parser = new DOMParser()
    const serializer = new XMLSerializer()
    const sheetDoc = parser.parseFromString(sheetXml, 'application/xml')
    const setCell = (address: string, value: unknown) => setCvCellValue(sheetDoc, address, value)

    const crewName = splitCrewName(user.full_name)
    setCell('C3', crewName.name)
    setCell('H3', crewName.surname)
    setCell('C4', user.position || '')
    setCell('H4', profile.cv_company || defaultCvCompany)
    setCell('C5', profile.national_id_no)
    setCell('H5', profile.nationality)
    setCell('C6', formatTemplateDate(profile.date_of_birth))
    setCell('H6', profile.place_of_birth)
    setCell('C7', clean((user as any)?.boot_size))
    setCell('H7', `${clean((user as any)?.suit_color)} ${clean((user as any)?.suit_size)}`.trim())
    setCell('C8', personalDocs.passport?.cert_number || '')
    setCell('G8', formatTemplateDate(personalDocs.passport?.issue_date))
    setCell('J8', formatTemplateDate(personalDocs.passport?.expiry_date))
    setCell('C9', personalDocs.seamanBook?.cert_number || '')
    setCell('G9', formatTemplateDate(personalDocs.seamanBook?.issue_date))
    setCell('J9', formatTemplateDate(personalDocs.seamanBook?.expiry_date))
    setCell('C10', profile.toeic_score)
    setCell('G10', formatTemplateDate(profile.toeic_test_date))

    cvCertTables.competency.slice(0, 2).forEach((cert, index) => {
      const row = 15 + index
      setCell(`A${row}`, getCompetencyDisplayTitle(cert))
      setCvCellStyle(sheetDoc, `A${row}`, '42')
      setCell(`E${row}`, cert.cv_capacity || user.position || '')
      setCell(`G${row}`, cert.cert_number || '')
      setCell(`I${row}`, formatTemplateDate(cert.issue_date))
      setCell(`K${row}`, formatTemplateDate(cert.expiry_date))
      setCell(`L${row}`, cert.issue_authority || '')
    })

    cvCertTables.paired.slice(0, 16).forEach((pair, index) => {
      const row = 22 + index
      setCell(`A${row}`, pair.training?.cert_name || pair.proficiency?.cert_name || '')
      setCvCellStyle(sheetDoc, `A${row}`, '42')
      setCell(`D${row}`, pair.training?.cert_number || '')
      setCell(`E${row}`, formatTemplateDate(pair.training?.issue_date))
      setCell(`F${row}`, formatTemplateDate(pair.training?.expiry_date))
      setCell(`H${row}`, pair.training?.place_of_issue || '')
      setCell(`I${row}`, pair.proficiency?.cert_number || '')
      setCell(`K${row}`, formatTemplateDate(pair.proficiency?.issue_date))
      setCell(`L${row}`, formatTemplateDate(pair.proficiency?.expiry_date))
      setCell(`M${row}`, pair.proficiency?.issue_authority || '')
    })

    cvCertTables.medical.slice(0, 2).forEach((cert, index) => {
      const row = 41 + index
      setCell(`E${row}`, cert.place_of_issue || '')
      setCell(`G${row}`, cert.cert_number || '')
      setCell(`J${row}`, formatTemplateDate(cert.issue_date))
      setCell(`L${row}`, formatTemplateDate(cert.expiry_date))
    })

    vaccinations.slice(0, 2).forEach((vaccine, index) => {
      const row = 46 + index
      setCell(`A${row}`, vaccine.vaccine_name)
      setCell(`E${row}`, formatTemplateDate(vaccine.date_given))
      setCell(`H${row}`, formatTemplateDate(vaccine.expiry_date))
      setCell(`K${row}`, vaccine.place_given || vaccine.remarks || '')
    })

    services.slice(0, 18).forEach((service, index) => {
      const row = 52 + index
      const monthsOnBoard = dayDiffInclusive(service.joining_date, service.sign_off_date) / 30
      setCell(`A${row}`, service.rank || '')
      setCell(`B${row}`, service.vessel_name || '')
      setCell(`D${row}`, service.vessel_type || '')
      setCell(`E${row}`, service.charterer || '')
      setCell(`F${row}`, service.grt || '')
      setCell(`G${row}`, service.bhp || '')
      setCell(`H${row}`, formatTemplateDate(service.joining_date))
      setCell(`J${row}`, formatTemplateDate(service.sign_off_date))
      setCell(`L${row}`, service.company || defaultCvCompany)
      setCell(`M${row}`, monthsOnBoard > 0 ? monthsOnBoard.toFixed(1) : '')
    })

    zip.file(sheetPath, serializer.serializeToString(sheetDoc))

    const stamp = new Date().toISOString().slice(0, 10)
    const fileName = `KMT-CV-${clean(user.full_name).replace(/[^a-z0-9]+/gi, '-') || 'Crew'}-${stamp}.xlsx`
    const xlsxArray = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const finalWorkbook = await embedCvPictureInWorkbook(xlsxArray, profile.picture_data_url || null)
    downloadWorkbook(finalWorkbook, fileName)
  }

  function updateCvCert(nextCert: CrewCert) {
    if (isManualCompetencyCert(nextCert)) {
      setManualCompetency(nextCert)
      if (user?.id) localStorage.setItem(manualCompetencyKey(user.id), JSON.stringify(nextCert))
      return
    }
    if (isManualCvCert(nextCert)) {
      const exists = manualCvCerts.some((item) => item.id === nextCert.id)
      const nextManualCerts = exists
        ? manualCvCerts.map((item) => item.id === nextCert.id ? nextCert : item)
        : [...manualCvCerts, nextCert]
      setManualCvCerts(nextManualCerts)
      if (user?.id) localStorage.setItem(cvManualCertsKey(user.id), JSON.stringify(nextManualCerts))
      return
    }
    setCertRows((prev) => prev.map((item) => item.id === nextCert.id ? nextCert : item))
  }

  function addManualCvCert(section: string) {
    if (!user?.id) return
    const newCert = buildManualCvCert(section)
    const nextManualCerts = [...manualCvCerts, newCert]
    setManualCvCerts(nextManualCerts)
    localStorage.setItem(cvManualCertsKey(user.id), JSON.stringify(nextManualCerts))
    const keys = cvCertTables.paired.map(getCvPairKey)
    const ordered = cvPairOrder.filter((key) => keys.includes(key))
    keys.forEach((key) => {
      if (!ordered.includes(key)) ordered.push(key)
    })
    if (section === 'Certificate of Training') {
      const newPairKey = `${newCert.id}:none`
      const nextOrder = [...ordered.filter((key) => key !== newPairKey), newPairKey]
      setCvPairOrder(nextOrder)
      localStorage.setItem(cvPairOrderKey(user.id), JSON.stringify(nextOrder))
    }
    toast.success('Manual CV certificate row added')
  }

  function addManualProficiencyForTraining(trainingCert: CrewCert) {
    if (!user?.id) return
    const nextManualCerts = [...manualCvCerts, buildManualCvCert('Certificate of Proficiency', trainingCert)]
    setManualCvCerts(nextManualCerts)
    localStorage.setItem(cvManualCertsKey(user.id), JSON.stringify(nextManualCerts))
    toast.success('Manual COP row added under this training')
  }

  function hideCvCert(certId?: string) {
    if (!certId || !user?.id) return
    if (isManualCvCertId(certId) && !certId.startsWith('manual-cv-competency-')) {
      const nextManualCerts = manualCvCerts.filter((item) => item.id !== certId)
      setManualCvCerts(nextManualCerts)
      localStorage.setItem(cvManualCertsKey(user.id), JSON.stringify(nextManualCerts))
      return
    }
    const nextHidden = Array.from(new Set([...hiddenCvCertIds, certId]))
    setHiddenCvCertIds(nextHidden)
    localStorage.setItem(cvHiddenCertsKey(user.id), JSON.stringify(nextHidden))
  }

  function resetHiddenCvCerts() {
    if (!user?.id) return
    setHiddenCvCertIds([])
    localStorage.removeItem(cvHiddenCertsKey(user.id))
    toast.success('Hidden CV certificates restored')
  }

  function moveCvPair(sourceKey: string, targetKey: string) {
    if (!user?.id || sourceKey === targetKey) return
    const keys = cvCertTables.paired.map(getCvPairKey)
    const ordered = cvPairOrder.filter((key) => keys.includes(key))
    keys.forEach((key) => {
      if (!ordered.includes(key)) ordered.push(key)
    })
    const sourceIndex = ordered.indexOf(sourceKey)
    const targetIndex = ordered.indexOf(targetKey)
    if (sourceIndex < 0 || targetIndex < 0) return
    const [moved] = ordered.splice(sourceIndex, 1)
    ordered.splice(targetIndex, 0, moved)
    setCvPairOrder(ordered)
    localStorage.setItem(cvPairOrderKey(user.id), JSON.stringify(ordered))
  }

  async function saveVesselShortcut(source: Omit<VesselMaster, 'id'> = vesselForm) {
    if (!admin || !source.vessel_name) return
    const payload = buildVesselPayload(source, user)
    const { data, error } = await supabase
      .from('cv_vessel_master')
      .upsert(payload, { onConflict: 'vessel_name' })
      .select('*')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }
    const nextVessels = [...vessels.filter((item) => item.id !== data.id && item.vessel_name !== data.vessel_name), data as VesselMaster]
      .sort((a, b) => a.vessel_name.localeCompare(b.vessel_name))
    setVessels(nextVessels)
    setVesselForm(stripVesselId(data as VesselMaster))
    toast.success('Vessel shortcut saved')
  }

  async function saveSeaService() {
    if (!user?.id) return
    const activeUser = user as ActiveUser
    if (!serviceForm.vessel_name || !serviceForm.rank || !serviceForm.joining_date || !serviceForm.sign_off_date) {
      toast.error('Please fill vessel, rank, joining date, and sign off date')
      return
    }
    setSavingService(true)
    const payload = {
      ...buildSeaServicePayload(serviceForm),
      crew_id: activeUser.id,
      updated_at: new Date().toISOString(),
    }
    const { error } = editingServiceId
      ? await supabase.from('crew_cv_sea_services').update(payload).eq('id', editingServiceId)
      : await supabase.from('crew_cv_sea_services').insert(payload)
    setSavingService(false)
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    toast.success(editingServiceId ? 'Sea service updated' : 'Sea service added')
    resetSeaServiceEditor(activeUser)
    await loadCv(activeUser, sessionUser)
  }

  function resetSeaServiceEditor(activeUserOverride?: ActiveUser | null) {
    const activeUser = activeUserOverride || (user as ActiveUser | null)
    const resetServiceForm = {
      ...emptySeaService,
      crew_id: activeUser?.id || user?.id || '',
      rank: activeUser?.position || user?.position || '',
      company: profile.cv_company || defaultCvCompany,
    }
    setServiceForm(resetServiceForm)
    setEditingServiceSnapshot(serviceFormSnapshot(resetServiceForm))
    setSelectedVesselId('')
    setEditingServiceId('')
  }

  function editSeaService(row: SeaServiceRow) {
    setEditingServiceId(row.id)
    setSelectedVesselId(row.vessel_master_id || '')
    setServiceForm({
      crew_id: user?.id || row.crew_id,
      vessel_master_id: row.vessel_master_id || '',
      vessel_name: row.vessel_name || '',
      vessel_type: row.vessel_type || '',
      flag: row.flag || '',
      imo_no: row.imo_no || '',
      grt: row.grt || '',
      dwt: row.dwt || '',
      engine_type: row.engine_type || '',
      bhp: row.bhp || '',
      company: row.company || profile.cv_company || defaultCvCompany,
      trading_area: row.trading_area || '',
      rank: row.rank || '',
      charterer: row.charterer || 'PTTEP',
      joining_date: toDateValue(row.joining_date),
      sign_off_date: toDateValue(row.sign_off_date),
      remarks: row.remarks || '',
    })
    setEditingServiceSnapshot(serviceFormSnapshot({
      crew_id: user?.id || row.crew_id,
      vessel_master_id: row.vessel_master_id || '',
      vessel_name: row.vessel_name || '',
      vessel_type: row.vessel_type || '',
      flag: row.flag || '',
      imo_no: row.imo_no || '',
      grt: row.grt || '',
      dwt: row.dwt || '',
      engine_type: row.engine_type || '',
      bhp: row.bhp || '',
      company: row.company || profile.cv_company || defaultCvCompany,
      trading_area: row.trading_area || '',
      rank: row.rank || '',
      charterer: row.charterer || 'PTTEP',
      joining_date: toDateValue(row.joining_date),
      sign_off_date: toDateValue(row.sign_off_date),
      remarks: row.remarks || '',
    }))
    setActiveTab('service')
    window.setTimeout(() => scrollToSeaServiceEntry(), 140)
  }

  function cancelSeaServiceEdit() {
    resetSeaServiceEditor()
    toast.success('Sea service edit cancelled')
  }

  async function deleteSeaService(id: string) {
    const { error } = await supabase.from('crew_cv_sea_services').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    setServices((prev) => prev.filter((item) => item.id !== id))
    toast.success('Sea service deleted')
  }

  async function deleteVesselShortcut(id: string) {
    if (!admin) return
    const { error } = await supabase.from('cv_vessel_master').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    setVessels((prev) => prev.filter((item) => item.id !== id))
    toast.success('Vessel shortcut deleted')
  }

  async function saveCertCvDetails(cert: CrewCert) {
    if (isManualCompetencyCert(cert)) {
      if (user?.id) localStorage.setItem(manualCompetencyKey(user.id), JSON.stringify(cert))
      toast.success('Manual COC detail saved')
      return
    }
    if (isManualCvCert(cert)) {
      if (user?.id) localStorage.setItem(cvManualCertsKey(user.id), JSON.stringify(manualCvCerts))
      toast.success('Manual CV certificate saved')
      return
    }
    setSavingCertId(cert.id)
    const section = getCvCertSection(cert)
    const payload: Record<string, any> = {
      cert_number: cert.cert_number || null,
      place_of_issue: cert.place_of_issue || null,
      issue_authority: cert.issue_authority || null,
      cv_section: section,
      cv_row_no: cert.cv_row_no || null,
      cv_competency_title: section === 'Certificate of Competency' ? getCompetencyDisplayTitle(cert) || null : null,
      cv_capacity: cert.cv_capacity || null,
      issue_date: cert.issue_date || null,
      expiry_date: cert.expiry_date || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crew_certs').update(payload).eq('id', cert.id)
    setSavingCertId('')
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    setSavedCertSnapshots((prev) => ({ ...prev, [cert.id]: certSnapshot(cert) }))
    toast.success('CV certificate detail saved')
  }

  async function fillMissingCertFromFile(cert: CrewCert) {
    if (!user?.id || !cert.file_url || isManualCvCert(cert)) return
    setFillingCertId(cert.id)
    try {
      const fileResponse = await fetch(cert.file_url)
      if (!fileResponse.ok) throw new Error('Could not open the stored certificate file')
      const blob = await fileResponse.blob()
      const mimeType = blob.type || (cert.file_url.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg')
      const fileName = cert.file_url.split('/').pop() || 'certificate'
      const file = new File([blob], fileName, { type: mimeType })
      const imageBase64 = mimeType === 'application/pdf' ? await blobToDataUrl(blob) : await compressImage(file)

      let latestError = 'AI models busy'
      const section = getCvCertSection(cert)
      const candidateModels = mimeType === 'application/pdf'
        ? AI_MODELS.filter((model) => model.provider === 'google')
        : AI_MODELS
      for (const model of candidateModels) {
        try {
          const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64,
              mimeType,
              certName: cert.cert_name,
              crewName: user.full_name,
              modelId: model.id,
              provider: model.provider,
            }),
          })
          const result = await response.json()
          if (!response.ok || result.error) {
            latestError = result.error || latestError
            throw new Error(latestError)
          }

          const detectedCertName = String(result.detectedCertName || '').trim()
          const aiCompetencyTitle = normalizeCompetencyAiTitle(result.competencyTitle || (section === 'Certificate of Competency' ? result.detectedCertName : ''))
          const aiCompetencyCapacity = normalizeCompetencyAiCapacity(result.competencyCapacity, result.detectedCertName)
          const currentCompetencyTitle = getCompetencyDisplayTitle(cert)
          const shouldReplaceCompetencyName =
            section === 'Certificate of Competency'
            && Boolean(aiCompetencyTitle)
            && (
              !currentCompetencyTitle
              || isGenericCompetencyName(currentCompetencyTitle)
              || normalize(currentCompetencyTitle) === normalize(detectedCertName)
            )

          const nextCert: CrewCert = {
            ...cert,
            cv_competency_title:
              section === 'Certificate of Competency'
                ? (shouldReplaceCompetencyName ? aiCompetencyTitle : (currentCompetencyTitle || aiCompetencyTitle || ''))
                : cert.cv_competency_title,
            issue_date: cert.issue_date || result.issueDate || null,
            expiry_date: cert.expiry_date || result.expiryDate || null,
            cert_number: cert.cert_number || String(result.certNumber || '').trim() || null,
            place_of_issue: cert.place_of_issue || String(result.placeOfIssue || '').trim() || null,
            issue_authority: cert.issue_authority || String(result.issueAuthority || '').trim() || null,
            cv_capacity:
              section === 'Certificate of Competency'
                ? (cert.cv_capacity || aiCompetencyCapacity || null)
                : cert.cv_capacity,
          }

          const payload = {
            issue_date: nextCert.issue_date,
            expiry_date: nextCert.expiry_date,
            cert_number: nextCert.cert_number || null,
            place_of_issue: nextCert.place_of_issue || null,
            issue_authority: nextCert.issue_authority || null,
            cv_competency_title: section === 'Certificate of Competency' ? nextCert.cv_competency_title || null : undefined,
            cv_capacity: section === 'Certificate of Competency' ? nextCert.cv_capacity || null : undefined,
            updated_at: new Date().toISOString(),
          }
          const { error } = await supabase.from('crew_certs').update(payload).eq('id', cert.id)
          if (error) throw error
          if (isPersonalDocument(cert) && cert.cert_name.toLowerCase().includes('passport')) {
            const passportData = normalizePassportCvProfileData(result.passportCvData)
            if (hasPassportCvProfileData(passportData)) {
              await persistPassportProfileData(passportData, 'Passport data added to CV profile')
            }
          }
          setCertRows((prev) => prev.map((item) => item.id === cert.id ? nextCert : item))
          toast.success(`Filled missing CV fields with ${model.label}`)
          return
        } catch (error: any) {
          latestError = error.message || latestError
        }
      }
      throw new Error(latestError)
    } catch (error: any) {
      toast.error(error.message || 'Could not fill from existing file')
    } finally {
      setFillingCertId('')
    }
  }

  async function refreshCvDataFromFiles() {
    if (cvRefreshTargets.length === 0) {
      toast.success('CV data is already up to date')
      return
    }
    setRefreshingCvData(true)
    try {
      for (const cert of cvRefreshTargets) {
        await fillMissingCertFromFile(cert)
      }
      toast.success('CV data refresh completed')
    } finally {
      setRefreshingCvData(false)
    }
  }

  async function saveVaccination() {
    if (!user?.id) return
    const activeUser = user as ActiveUser
    if (!vaccinationForm.vaccine_name) {
      toast.error('Please fill vaccination name')
      return
    }
    setSavingVaccination(true)
    const payload = {
      crew_id: activeUser.id,
      vaccine_name: clean(vaccinationForm.vaccine_name),
      dose_detail: clean(vaccinationForm.dose_detail) || null,
      date_given: vaccinationForm.date_given || null,
      expiry_date: vaccinationForm.expiry_date || null,
      place_given: clean(vaccinationForm.place_given) || null,
      remarks: clean(vaccinationForm.remarks) || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crew_cv_vaccinations').insert(payload)
    setSavingVaccination(false)
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    toast.success('Vaccination detail added')
    setVaccinationForm({ ...emptyVaccination, crew_id: activeUser.id })
    await loadCv(activeUser, sessionUser)
  }

  async function deleteVaccination(id: string) {
    const { error } = await supabase.from('crew_cv_vaccinations').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    setVaccinations((prev) => prev.filter((item) => item.id !== id))
    toast.success('Vaccination detail deleted')
  }

  if (loading) {
    return <PageShell><div className="animate-pulse text-[var(--accent-text)]">LOADING CV...</div></PageShell>
  }

  return (
    <PageShell>
      <PageHeader
        icon={<UserRound className="text-orange-500" size={38} />}
        title="Crew CV"
        subtitle="Personal record, certificates, and sea service profile"
      />

      {canOpenDashboard && (
        <div className="mb-6 flex flex-col gap-3 rounded-[32px] border border-blue-500/20 bg-[var(--surface)] p-5 shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500">Crew CV Dashboard</p>
            <p className="mt-1 text-sm font-black text-[var(--headline)]">Open all crew CV records, service years, and export review</p>
            <p className="mt-1 text-xs text-[var(--subtle)]">Admin and radio operator can review every crew profile from one dashboard.</p>
          </div>
          <Link href="/cv/dashboard" className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-blue-500">
            Open Dashboard
          </Link>
        </div>
      )}

      {!viewingOwnCv && user && (
        <div className="mb-6 flex flex-col gap-3 rounded-[32px] border border-emerald-500/20 bg-[var(--surface)] p-5 shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">Viewing Crew CV</p>
            <p className="mt-1 text-sm font-black text-[var(--headline)]">{user.full_name}</p>
            <p className="mt-1 text-xs text-[var(--subtle)]">{user.position || 'Crew'} | Last updated: {formatDateTime(lastUpdatedAt)}</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Link href="/cv/dashboard" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-500">
              Back to Dashboard
            </Link>
            {sessionUser?.id && (
              <Link href="/cv" className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">
                Open My CV
              </Link>
            )}
          </div>
        </div>
      )}

      {sqlMissing && (
        <div className="mb-6 rounded-[32px] border border-amber-500/30 bg-amber-500/10 p-6 text-[var(--headline)]">
          <p className="text-sm font-black uppercase text-[var(--warning-text)]">CV database is not ready</p>
          <p className="mt-2 text-xs normal-case text-[var(--subtle)]">
            Run `sql/crew_cv_foundation.sql` in Supabase SQL Editor, then refresh this page.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 rounded-[32px] border border-orange-500/20 bg-[var(--surface)] p-5 shadow-xl md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--accent-text)]">CV Data Status</p>
          <p className="mt-1 text-sm font-black text-[var(--headline)]">
            {cvRefreshTargets.length === 0 ? 'Data up to date' : `${cvRefreshTargets.length} certificate file(s) still need AI fill back`}
          </p>
          <p className="mt-1 text-xs text-[var(--subtle)]">Last updated: {formatDateTime(lastUpdatedAt)}</p>
        </div>
        <button
          type="button"
          onClick={refreshCvDataFromFiles}
          disabled={refreshingCvData || cvRefreshTargets.length === 0}
          className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-blue-500 disabled:opacity-50"
        >
          {cvRefreshTargets.length === 0 ? 'Data up to date' : refreshingCvData ? 'Filling back...' : 'Fill Back With AI'}
        </button>
      </div>

      <div className="mb-6 rounded-[32px] border border-orange-500/20 bg-[var(--surface)] p-2 shadow-xl">
        <div className={`grid gap-2 ${admin ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          <TabButton active={activeTab === 'personal'} label="Personal Details" status={completionStatus.personalComplete ? 'Complete' : 'Needs Update'} onClick={() => setActiveTab('personal')} />
          <TabButton active={activeTab === 'certificates'} label="Certificates" status={completionStatus.certificatesComplete ? 'Complete' : 'Needs Fill Back'} onClick={() => setActiveTab('certificates')} />
          <TabButton active={activeTab === 'service'} label="Sea Service" status={completionStatus.serviceComplete ? 'Complete' : 'Add Records'} onClick={() => setActiveTab('service')} />
          <TabButton active={activeTab === 'review'} label="Review & Export" status={completionStatus.allComplete ? 'Ready' : 'Check Before Export'} onClick={() => setActiveTab('review')} />
          {admin && <TabButton active={activeTab === 'vessels'} label="Vessel Data" onClick={() => setActiveTab('vessels')} />}
        </div>
      </div>

      {activeTab === 'personal' && (
        <>
          <section className="rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <BriefcaseBusiness className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Person&apos;s Details</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Passport upload can prefill these fields, but you can edit manually.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormLine label="Name" value={user?.full_name || '-'} />
              <FormLine label="Rank" value={user?.position || '-'} />
              <FormLine label="National ID No." editable={<TextField label="" value={profile.national_id_no} onChange={(value) => updateProfileField('national_id_no', value)} />} />
              <FormLine label="Nationality" editable={<TextField label="" value={profile.nationality} onChange={(value) => updateProfileField('nationality', value)} />} />
              <FormLine label="Date of Birth" editable={<DateField label="" value={profile.date_of_birth} onChange={(value) => updateProfileField('date_of_birth', value)} />} />
              <FormLine label="Place of Birth" editable={<TextField label="" value={profile.place_of_birth} onChange={(value) => updateProfileField('place_of_birth', value)} />} />
              <FormLine label="Passport" value={formatPersonalDoc(personalDocs.passport)} />
              <FormLine label="Seaman Book" value={formatPersonalDoc(personalDocs.seamanBook)} />
              <FormLine label="TOEIC Score" editable={<TextField label="" value={profile.toeic_score} onChange={(value) => updateProfileField('toeic_score', value)} />} />
              <FormLine label="TOEIC Test Date" editable={<DateField label="" value={profile.toeic_test_date} onChange={(value) => updateProfileField('toeic_test_date', value)} />} />
              <FormLine label="Safety Shoe" value={clean((user as any)?.boot_size) || '-'} />
              <FormLine label="Boiler Suit" value={`${clean((user as any)?.suit_color) || '-'} | ${clean((user as any)?.suit_size) || '-'}`} />
              <FormLine label="Company" editable={<TextField label="" value={profile.cv_company} onChange={(value) => updateProfileField('cv_company', value)} />} />
            </div>
            <div className="mt-5 rounded-[28px] border border-orange-500/20 bg-[var(--surface-strong)] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">CV Picture</p>
                  <p className="mt-1 text-xs text-[var(--subtle)]">This image will be placed into the Picture box when exporting the CV Excel form.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-orange-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20">
                  Upload Picture
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => handleCvPictureUpload(event.target.files?.[0])} />
                </label>
              </div>
              {profile.picture_data_url && (
                <div className="mt-4 flex items-center gap-4">
                  <img src={profile.picture_data_url} alt="CV preview" className="h-28 w-24 rounded-2xl border border-orange-500/20 object-cover" />
                  <button
                    onClick={() => {
                      setProfile((prev) => ({ ...prev, picture_data_url: '' }))
                      if (user?.id) localStorage.removeItem(cvPictureKey(user.id))
                    }}
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-500"
                  >
                    Remove Picture
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Step 1 of 4</p>
                <p className="text-sm font-black text-[var(--headline)]">
                  {showProfileSave ? 'Personal details changed. Save before moving on.' : 'Personal details are already saved. Continue to certificates when ready.'}
                </p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
                {showProfileSave && (
                  <button onClick={saveProfile} disabled={savingProfile || sqlMissing} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                    {savingProfile ? 'Saving...' : 'Save after edit'}
                  </button>
                )}
                <button onClick={() => setActiveTab('certificates')} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-[var(--accent-text)]">
                  Next: Certificates
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === 'certificates' && (
        <>
          <section className="rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <FileBadge className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Certificates and Training</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">CV form layout: competency, training/proficiency pairs, medical fitness, and vaccination details.</p>
              </div>
            </div>
            <CvCertificateTables
              fillingCertId={fillingCertId}
              isDirty={(cert) => Boolean(certDirtyMap[cert.id])}
              tables={cvCertTables}
              savingCertId={savingCertId}
              onChange={updateCvCert}
              onFillMissing={fillMissingCertFromFile}
              onAddManual={addManualCvCert}
              onAddProficiency={addManualProficiencyForTraining}
              onHide={hideCvCert}
              onMovePair={moveCvPair}
              onResetHidden={resetHiddenCvCerts}
              hiddenCount={hiddenCvCertIds.length}
              onSave={(certId) => {
                const currentCert = cvSourceRows.find((item) => item.id === certId)
                if (currentCert) saveCertCvDetails(currentCert)
              }}
            />
          </section>

          <section ref={serviceEntryRef} className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <FileBadge className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Vaccination Details</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Manual CV fields for vaccine, dose, date, place, and remarks.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              <TextField label="Vaccine" value={vaccinationForm.vaccine_name} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, vaccine_name: value }))} />
              <TextField label="Dose / Detail" value={vaccinationForm.dose_detail || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, dose_detail: value }))} />
              <DateField label="Date Given" value={vaccinationForm.date_given || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, date_given: value }))} />
              <DateField label="Expiry Date" value={vaccinationForm.expiry_date || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, expiry_date: value }))} />
              <TextField label="Place" value={vaccinationForm.place_given || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, place_given: value }))} />
              <TextField label="Remarks" value={vaccinationForm.remarks || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, remarks: value }))} />
            </div>
            <button onClick={saveVaccination} disabled={savingVaccination || sqlMissing} className="mt-5 rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
              <Plus size={15} className="mr-2 inline" /> {savingVaccination ? 'Saving...' : 'Add Vaccination'}
            </button>
            <VaccinationTable rows={vaccinations} onDelete={deleteVaccination} />
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Step 2 of 4</p>
                <p className="text-sm font-black text-[var(--headline)]">
                  {dirtyCertCount > 0 ? `${dirtyCertCount} certificate row(s) changed. Save only the rows you edited.` : 'Certificate data is saved. Continue when ready.'}
                </p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
                <button onClick={() => setActiveTab('personal')} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-[var(--accent-text)]">
                  Back: Personal
                </button>
                <button onClick={() => setActiveTab('service')} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20">
                  Next: Sea Service
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === 'service' && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Sea Service" value={serviceSummary.totalText} detail={`${serviceSummary.totalDays} total days`} />
            <MetricCard label="Vessels" value={String(serviceSummary.vesselCount)} detail="Unique vessel names" />
            <MetricCard label="Entries" value={String(services.length)} detail="Recorded service rows" />
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Ship className="text-orange-500" />
                <div>
                  <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Sailing Voyages Entry</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">CV-ready voyage data: select vessel, then fill company, rank, charter, and dates</p>
                </div>
              </div>
              <select value={selectedVesselId} onChange={(event) => applyVesselShortcut(event.target.value)} className="rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-xs font-black text-[var(--headline)]">
                <option value="">Select saved vessel shortcut...</option>
                {vessels.map((vessel) => (
                  <option key={vessel.id} value={vessel.id}>{vessel.vessel_name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <TextField label="Name of Vessel" value={serviceForm.vessel_name || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, vessel_name: value, vessel_master_id: null }))} />
              <TextField label="Vessel Type" value={serviceForm.vessel_type || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, vessel_type: value }))} />
              <TextField label="Flag" value={serviceForm.flag || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, flag: value }))} />
              <TextField label="IMO No." value={serviceForm.imo_no || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, imo_no: value }))} />
              <TextField label="GRT" value={serviceForm.grt || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, grt: value }))} />
              <TextField label="DWT" value={serviceForm.dwt || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, dwt: value }))} />
              <TextField label="Company" value={serviceForm.company || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, company: value }))} />
              <RankField label="Rank" value={serviceForm.rank || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, rank: value }))} />
              <SelectField label="Charter" value={serviceForm.charterer || 'PTTEP'} options={['PTTEP', 'Other']} onChange={(value) => setServiceForm((prev) => ({ ...prev, charterer: value }))} />
              <DateField label="Joining Date" value={serviceForm.joining_date || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, joining_date: value }))} />
              <DateField label="Sign Off Date" value={serviceForm.sign_off_date || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, sign_off_date: value }))} />
              <TextField label="Remarks" value={serviceForm.remarks || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, remarks: value }))} />
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
              {!editingServiceId && (
                <button onClick={saveSeaService} disabled={savingService || sqlMissing} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                  <Plus size={15} className="mr-2 inline" /> {savingService ? 'Saving...' : 'Add Sea Service'}
                </button>
              )}
              {editingServiceId && serviceDirty && (
                <button onClick={saveSeaService} disabled={savingService || sqlMissing} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                  {savingService ? 'Saving...' : 'Save after edit'}
                </button>
              )}
              {editingServiceId && (
                <button onClick={cancelSeaServiceEdit} disabled={savingService} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-[var(--accent-text)] disabled:opacity-50">
                  Cancel
                </button>
              )}
            </div>
          </section>

          <SeaServiceHistory services={services} onDelete={deleteSeaService} onEdit={editSeaService} />

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Step 3 of 4</p>
                <p className="text-sm font-black text-[var(--headline)]">Sea service stays editable all the time. Add or remove rows before final review.</p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
                <button onClick={() => setActiveTab('certificates')} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-[var(--accent-text)]">
                  Back: Certificates
                </button>
                <button onClick={() => setActiveTab('review')} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20">
                  Next: Review & Export
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === 'review' && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Last Updated" value={formatDateTime(lastUpdatedAt)} detail={viewingOwnCv ? 'Your current saved CV' : 'Selected crew CV record'} />
            <MetricCard
              label="Year This Company"
              value={serviceSummary.companyText}
              detail={serviceSummary.currentCompany || 'Current company'}
              options={serviceSummary.companyOptions}
              selected={selectedMetricCompany}
              onSelect={setSelectedMetricCompany}
            />
            <MetricCard
              label="Year This Type"
              value={serviceSummary.typeText}
              detail={serviceSummary.currentType || 'Current vessel type'}
              options={serviceSummary.typeOptions}
              selected={selectedMetricType}
              onSelect={setSelectedMetricType}
            />
            <MetricCard
              label="Year This Rank"
              value={serviceSummary.rankText}
              detail={serviceSummary.currentRank || user?.position || 'Current rank'}
              options={serviceSummary.rankOptions}
              selected={selectedMetricRank}
              onSelect={setSelectedMetricRank}
            />
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <CalendarDays className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Review & Export</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Final step before exporting the CV form. Review missing data, tenure totals, and unsaved edits before export.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ReviewStatusCard
                label="Personal Details"
                ok={completionStatus.personalComplete}
                detail={completionStatus.personalComplete ? 'Required profile fields look ready' : 'Please complete personal details first'}
                missing={[...completionStatus.personalMissing, ...completionStatus.personalWarnings]}
              />
              <ReviewStatusCard
                label="Certificates"
                ok={completionStatus.certificatesComplete}
                detail={completionStatus.certificatesComplete ? 'Certificate data is up to date' : `${cvRefreshTargets.length} file(s) still need AI fill back`}
                missing={[...completionStatus.certificatesMissing, ...completionStatus.certificatesWarnings]}
              />
              <ReviewStatusCard
                label="Sea Service"
                ok={completionStatus.serviceComplete}
                detail={completionStatus.serviceComplete ? `${services.length} voyage row(s) recorded` : 'Add at least one sea service row'}
                missing={[...completionStatus.serviceMissing, ...completionStatus.serviceWarnings]}
              />
            </div>
            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-[var(--subtle)]">
                {completionStatus.allComplete
                  ? 'CV is ready to export.'
                  : 'You can still export, but review the incomplete sections above first.'}
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
                <button onClick={() => setActiveTab('service')} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-[var(--accent-text)]">
                  Back: Sea Service
                </button>
                <button onClick={exportCvExcel} disabled={sqlMissing} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                  <Download size={15} className="mr-2 inline" /> Export CV Excel
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === 'vessels' && admin && (
        <>
          <section className="rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <Ship className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Vessel Data Master</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Admin shortcut database for sea service auto-fill</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <TextField label="Name of Vessel" value={vesselForm.vessel_name || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, vessel_name: value }))} />
              <TextField label="Vessel Type" value={vesselForm.vessel_type || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, vessel_type: value }))} />
              <TextField label="Flag" value={vesselForm.flag || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, flag: value }))} />
              <TextField label="IMO No." value={vesselForm.imo_no || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, imo_no: value }))} />
              <TextField label="GRT" value={vesselForm.grt || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, grt: value }))} />
              <TextField label="DWT" value={vesselForm.dwt || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, dwt: value }))} />
              <TextField label="Engine Type" value={vesselForm.engine_type || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, engine_type: value }))} />
              <TextField label="BHP" value={vesselForm.bhp || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, bhp: value }))} />
              <TextField label="Company" value={vesselForm.company || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, company: value }))} />
              <TextField label="Trading Area" value={vesselForm.trading_area || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, trading_area: value }))} />
            </div>
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <button onClick={() => saveVesselShortcut(vesselForm)} disabled={!vesselForm.vessel_name || sqlMissing} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                <Ship size={15} className="mr-2 inline" /> Save Vessel Data
              </button>
              <button onClick={() => setVesselForm(emptyVessel)} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-[var(--accent-text)]">
                Clear Form
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <h2 className="mb-5 text-xl font-black italic uppercase text-[var(--headline)]">Saved Vessel Data</h2>
            <div className="space-y-3">
              {vessels.length === 0 && <div className="rounded-3xl bg-[var(--surface-strong)] p-6 text-[var(--subtle)]">No vessel shortcuts yet.</div>}
              {vessels.map((vessel) => (
                <div key={vessel.id} className="grid gap-4 rounded-3xl border border-orange-500/15 bg-[var(--surface-strong)] p-5 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{vessel.vessel_type || 'Vessel'}</p>
                    <h3 className="mt-1 text-lg font-black italic uppercase text-[var(--headline)]">{vessel.vessel_name}</h3>
                    <p className="mt-1 text-xs normal-case text-[var(--subtle)]">{vessel.flag || '-'} | IMO {vessel.imo_no || '-'} | GRT {vessel.grt || '-'} | DWT {vessel.dwt || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Engine / Area</p>
                    <p className="text-sm font-black text-[var(--headline)]">{vessel.engine_type || '-'} | {vessel.trading_area || '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editVesselShortcut(vessel)} className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-xs font-black uppercase text-[var(--accent-text)]">Edit</button>
                    <button onClick={() => deleteVesselShortcut(vessel.id)} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-black uppercase text-[var(--danger-text)]">
                      <Trash2 size={14} className="mr-2 inline" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  )
}

function stripVesselId(vessel: VesselMaster): Omit<VesselMaster, 'id'> {
  return {
    vessel_name: vessel.vessel_name || '',
    vessel_type: vessel.vessel_type || '',
    flag: vessel.flag || '',
    imo_no: vessel.imo_no || '',
    grt: vessel.grt || '',
    dwt: vessel.dwt || '',
    engine_type: vessel.engine_type || '',
    bhp: vessel.bhp || '',
    company: vessel.company || '',
    trading_area: vessel.trading_area || '',
  }
}

function buildVesselPayload(form: Omit<VesselMaster, 'id'>, user: CurrentUser | null) {
  return {
    vessel_name: clean(form.vessel_name),
    vessel_type: clean(form.vessel_type) || null,
    flag: clean(form.flag) || null,
    imo_no: clean(form.imo_no) || null,
    grt: clean(form.grt) || null,
    dwt: clean(form.dwt) || null,
    engine_type: clean(form.engine_type) || null,
    bhp: clean(form.bhp) || null,
    company: clean(form.company) || null,
    trading_area: clean(form.trading_area) || null,
    created_by: user?.id || null,
    created_by_name: user?.full_name || null,
    updated_at: new Date().toISOString(),
  }
}

function TabButton({ active, label, onClick, status }: { active: boolean; label: string; onClick: () => void; status?: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[24px] px-5 py-4 text-left text-xs font-black uppercase tracking-widest transition-all ${
        active ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-[var(--subtle)] hover:bg-orange-500/10 hover:text-[var(--headline)]'
      }`}
    >
      <span className="block">{label}</span>
      {status && <span className={`mt-1 block text-[9px] tracking-[0.18em] ${active ? 'text-white/80' : 'text-[var(--subtle)]'}`}>{status}</span>}
    </button>
  )
}

export default function CvPage() {
  return (
    <Suspense fallback={<PageShell><div className="animate-pulse text-[var(--accent-text)]">LOADING CV...</div></PageShell>}>
      <CvPageContent />
    </Suspense>
  )
}

function ReviewStatusCard({ detail, label, missing = [], ok }: { detail: string; label: string; missing?: string[]; ok: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 ${ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest ${ok ? 'text-emerald-500' : 'text-amber-500'}`}>{label}</p>
      <p className="mt-2 text-sm font-black text-[var(--headline)]">{ok ? 'Complete' : 'Needs update'}</p>
      <p className="mt-1 text-xs text-[var(--subtle)]">{detail}</p>
      {!ok && missing.length > 0 && (
        <ul className="mt-3 space-y-1">
          {missing.map((item) => (
            <li key={item} className="text-[11px] font-black text-red-500">- {item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormLine({ editable, label, value }: { editable?: ReactNode; label: string; value?: string }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-orange-500/15 bg-[var(--surface-strong)] p-4 md:grid-cols-[180px_1fr] md:items-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{label}</p>
      {editable || <p className="text-sm font-black normal-case text-[var(--headline)]">{value || '-'}</p>}
    </div>
  )
}

function findCertByKeywords(rows: CrewCert[], keywords: string[]) {
  return rows.find((cert) => keywords.some((keyword) => normalize(cert.cert_name).includes(normalize(keyword))))
}

function attachCertMasterRules(rows: CrewCert[], masterRows: CertMasterCvRule[]) {
  const exact = new Map(masterRows.map((row) => [normalize(row.cert_name), row]))
  return rows.map((cert) => {
    const certKey = normalize(cert.cert_name)
    const master =
      exact.get(certKey) ||
      masterRows.find((row) => {
        const masterKey = normalize(row.cert_name)
        return masterKey && (masterKey.includes(certKey) || certKey.includes(masterKey))
      })

    if (!master) return cert
    return {
      ...cert,
      master_cert_family: master.cert_family || null,
      master_cv_section: master.cv_section || null,
      master_stcw_group_key: master.stcw_group_key || null,
      master_requires_proficiency: master.requires_proficiency ?? null,
      master_required_proficiency_key: master.required_proficiency_key || null,
      master_cv_order: master.cv_order ?? null,
    }
  })
}

function buildPersonalDocs(rows: CrewCert[]) {
  return {
    passport: findCertByKeywords(rows, ['passport']),
    seamanBook: findCertByKeywords(rows, ['seaman book', 'seamans book', 'seaman book', 'seaman']),
    toeic: findCertByKeywords(rows, ['toeic']),
  }
}

function formatPersonalDoc(cert?: CrewCert) {
  if (!cert) return '-'
  const number = clean(cert.cert_number) || clean(cert.cert_name)
  const issued = cert.issue_date ? `Issued ${formatDate(cert.issue_date)}` : 'Issued -'
  const expiry = cert.expiry_date ? `Exp ${formatDate(cert.expiry_date)}` : 'Exp -'
  return `${number} | ${issued} | ${expiry}`
}

function isPersonalDocument(cert: CrewCert) {
  if (normalizeCvSection(cert.master_cv_section) === 'Personal Document') return true
  if (normalize(cert.master_cert_family).includes('personaldocument')) return true
  const name = normalize(cert.cert_name)
  return name.includes('passport') || name.includes('seaman') || name.includes('toeic')
}

function normalizeCvSection(section?: string | null) {
  const value = normalize(section)
  if (!value) return ''
  if (value.includes('personaldocument')) return 'Personal Document'
  if (value.includes('competency') || value === 'coc' || value.includes('certificateofcompetency')) return 'Certificate of Competency'
  if (value.includes('proficiency') || value === 'cop' || value.includes('certificateofproficiency')) return 'Certificate of Proficiency'
  if (value.includes('medical')) return 'Medical'
  if (value.includes('training')) return 'Certificate of Training'
  return clean(section)
}

function getCvCertSection(cert: CrewCert) {
  const name = normalize(cert.cert_name)
  if (name.endsWith('cop') || name.includes('certificateofproficiency')) return 'Certificate of Proficiency'
  const masterSection = normalizeCvSection(cert.master_cv_section)
  if (masterSection) return masterSection
  const explicit = normalizeCvSection(cert.cv_section)
  if (explicit) return explicit
  if (name.includes('medical') || name.includes('fitness')) return 'Medical'
  if (name.includes('competency') || name.includes('coc') || name.includes('certificateofcompetency') || name.includes('license') || name.includes('licence')) return 'Certificate of Competency'
  if (name.includes('proficiency') || name.includes('endorsement')) return 'Certificate of Proficiency'
  return 'Certificate of Training'
}

function certRequiresProficiency(cert: CrewCert) {
  return Boolean(cert.master_requires_proficiency || clean(cert.master_required_proficiency_key))
}

function getStcwPriority(cert: CrewCert) {
  if (typeof cert.master_cv_order === 'number') return cert.master_cv_order
  const name = normalize(cert.cert_name)
  const stcwOrder = [
    ['personal survival techniques', 'personalsurvivaltechniques', 'pst'],
    ['fire prevention and fire fighting', 'firepreventionandfirefighting', 'fpff'],
    ['elementary first aid', 'elementaryfirstaid', 'efa'],
    ['personal safety and social responsibility', 'personalsafetyandsocialresponsibility', 'pssr'],
    ['basic safety training', 'basicsafetytraining', 'basictraining'],
    ['security awareness', 'securityawareness'],
    ['designated security duties', 'designatedsecurityduties', 'dsd'],
    ['proficiency in survival craft', 'survivalcraft', 'rescueboat', 'pscrb'],
    ['advanced fire fighting', 'advancefirefighting', 'advancedfirefighting', 'aff'],
    ['medical first aid', 'medicalfirstaid'],
    ['medical care', 'medicalcare'],
    ['gmdss', 'generaloperator', 'radiooperator'],
    ['dangerous goods', 'dangerousgoods', 'hazmat', 'chemical'],
    ['bosiet', 'foet', 'basicoffshoresafety'],
  ]
  const index = stcwOrder.findIndex((keywords) => keywords.some((keyword) => name.includes(normalize(keyword))))
  if (index >= 0) return index + 1
  if (name.includes('stcw')) return 50
  return 1000
}

function getStcwGroup(cert: CrewCert) {
  const masterGroup = clean(cert.master_stcw_group_key)
  if (masterGroup) return masterGroup
  const name = normalize(cert.cert_name)
  if (name.includes('basicsafety') || name.includes('basictraining') || name.includes('personalsurvival') || name.includes('fireprevention') || name.includes('elementaryfirstaid') || name.includes('personalsafety') || name.includes('pssr')) return 'basic_safety'
  if (name.includes('survivalcraft') || name.includes('rescueboat') || name.includes('pscrb')) return 'survival_craft'
  if (name.includes('advancefire') || name.includes('advancedfire')) return 'advanced_fire'
  if (name.includes('medicalfirstaid')) return 'medical_first_aid'
  if (name.includes('medicalcare')) return 'medical_care'
  if (name.includes('gmdss') || name.includes('radiooperator')) return 'gmdss'
  if (name.includes('securityawareness') || name.includes('designatedsecurity') || name.includes('shipsecurity')) return 'security'
  if (name.includes('dangerousgoods') || name.includes('hazmat') || name.includes('chemical')) return 'dangerous_goods'
  return 'other'
}

function sortCvCerts(rows: CrewCert[]) {
  return [...rows].sort((a, b) => {
    const rowA = Number(a.cv_row_no || 9999)
    const rowB = Number(b.cv_row_no || 9999)
    if (rowA !== rowB) return rowA - rowB
    const stcwA = getStcwPriority(a)
    const stcwB = getStcwPriority(b)
    if (stcwA !== stcwB) return stcwA - stcwB
    return String(a.cert_name || '').localeCompare(String(b.cert_name || ''))
  })
}

function buildCvCertTables(rows: CrewCert[]) {
  const cvRows = rows.filter((cert) => !isPersonalDocument(cert))
  const competency = sortCvCerts(cvRows.filter((cert) => getCvCertSection(cert) === 'Certificate of Competency'))
  const training = sortCvCerts(cvRows.filter((cert) => getCvCertSection(cert) === 'Certificate of Training'))
  const proficiency = sortCvCerts(cvRows.filter((cert) => getCvCertSection(cert) === 'Certificate of Proficiency'))
  const medical = sortCvCerts(cvRows.filter((cert) => getCvCertSection(cert) === 'Medical'))
  const remainingProficiency = [...proficiency]
  const paired: CvTrainingProficiencyPair[] = training.map((trainingCert) => {
    const requiresProficiency = certRequiresProficiency(trainingCert)
    const explicitIndex = remainingProficiency.findIndex((cert) => (
      (cert.linked_training_id && cert.linked_training_id === trainingCert.id)
      || (cert.cv_row_no && cert.cv_row_no === trainingCert.cv_row_no)
    ))
    const requiredKey = clean(trainingCert.master_required_proficiency_key)
    const group = requiredKey || getStcwGroup(trainingCert)
    const groupIndex = requiresProficiency && group !== 'other' ? remainingProficiency.findIndex((cert) => getStcwGroup(cert) === group) : -1
    const index = explicitIndex >= 0 ? explicitIndex : groupIndex
    const matched = index >= 0 ? remainingProficiency.splice(index, 1)[0] : undefined
    return { training: trainingCert, proficiency: matched, requiresProficiency }
  })
  const normalizedPairs = paired.map((pair) => ({
    ...pair,
    proficiency: pair.proficiency || (pair.requiresProficiency && pair.training ? buildRequiredProficiencyPlaceholder(pair.training) : undefined),
  }))
  return { competency, training, proficiency, paired: normalizedPairs, medical }
}

function getCvPairKey(pair: CvTrainingProficiencyPair) {
  return `${pair.training?.id || 'none'}:${pair.proficiency?.id || 'none'}`
}

function applyCvPairOrder(tables: ReturnType<typeof buildCvCertTables>, order: string[]) {
  if (order.length === 0) return tables
  const priority = new Map(order.map((key, index) => [key, index]))
  return {
    ...tables,
    paired: [...tables.paired].sort((a, b) => {
      const orderA = priority.get(getCvPairKey(a)) ?? 9999
      const orderB = priority.get(getCvPairKey(b)) ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return 0
    }),
  }
}

function CvCertificateTables({
  fillingCertId,
  hiddenCount,
  isDirty,
  onAddManual,
  onAddProficiency,
  onChange,
  onFillMissing,
  onHide,
  onMovePair,
  onResetHidden,
  onSave,
  savingCertId,
  tables,
}: {
  fillingCertId: string
  hiddenCount: number
  isDirty: (cert: CrewCert) => boolean
  tables: ReturnType<typeof buildCvCertTables>
  savingCertId: string
  onAddManual: (section: string) => void
  onAddProficiency: (trainingCert: CrewCert) => void
  onChange: (cert: CrewCert) => void
  onFillMissing: (cert: CrewCert) => void
  onHide: (certId?: string) => void
  onMovePair: (sourceKey: string, targetKey: string) => void
  onResetHidden: () => void
  onSave: (certId: string) => void
}) {
  const [draggedPairKey, setDraggedPairKey] = useState('')
  return (
    <div className="space-y-6">
      <CvSimpleCertTable
        title="Certificate of Competency"
        rows={tables.competency}
        section="Certificate of Competency"
        savingCertId={savingCertId}
        isDirty={isDirty}
        onChange={onChange}
        onFillMissing={onFillMissing}
        onHide={onHide}
        onSave={onSave}
        fillingCertId={fillingCertId}
        competency
      />

      <div>
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <CvTableTitle title="Certificates of Training and Certificate of Proficiency" subtitle="Drag rows to arrange CV order. Required COP fields stay beside their training certificate." />
          <div className="flex flex-wrap gap-2">
            {hiddenCount > 0 && (
              <button type="button" onClick={onResetHidden} className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-500">
                Restore hidden ({hiddenCount})
              </button>
            )}
          </div>
        </div>
        {tables.paired.length === 0 ? (
          <div className="rounded-3xl border border-orange-500/20 bg-[var(--surface-strong)] p-5 text-xs font-black uppercase tracking-widest text-[var(--subtle)]">No training or proficiency records yet</div>
        ) : (
          <div className="space-y-4">
            {tables.paired.map((row, index) => (
              <CvTrainingPairForm
                key={`${row.training?.id || 'training'}-${row.proficiency?.id || 'proficiency'}-${index}`}
                row={row}
                rowNumber={index + 1}
                savingCertId={savingCertId}
                fillingCertId={fillingCertId}
                isDirty={isDirty}
                dragged={draggedPairKey === getCvPairKey(row)}
                onChange={onChange}
                onFillMissing={onFillMissing}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  setDraggedPairKey(getCvPairKey(row))
                }}
                onDragEnd={() => setDraggedPairKey('')}
                onDrop={() => {
                  onMovePair(draggedPairKey, getCvPairKey(row))
                  setDraggedPairKey('')
                }}
                onAddProficiency={onAddProficiency}
                onHide={onHide}
                onSave={onSave}
              />
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => onAddManual('Certificate of Training')} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">
            <Plus size={13} className="mr-1 inline" /> Add Manual Training Certificate
          </button>
        </div>
      </div>

      <CvSimpleCertTable
        title="Medical Fitness Certificates / Details"
        rows={tables.medical}
        section="Medical"
        savingCertId={savingCertId}
        isDirty={isDirty}
        onChange={onChange}
        onFillMissing={onFillMissing}
        onHide={onHide}
        onSave={onSave}
        fillingCertId={fillingCertId}
        medical
      />
    </div>
  )
}

function CvTableTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-black uppercase tracking-widest text-[var(--accent-text)]">{title}</h3>
      {subtitle && <p className="mt-1 text-xs normal-case text-[var(--subtle)]">{subtitle}</p>}
    </div>
  )
}

function CvSimpleCertTable({
  fillingCertId,
  isDirty,
  medical,
  competency,
  onChange,
  onFillMissing,
  onHide,
  onSave,
  rows,
  savingCertId,
  section,
  title,
}: {
  title: string
  section: string
  rows: CrewCert[]
  fillingCertId: string
  savingCertId: string
  isDirty: (cert: CrewCert) => boolean
  onChange: (cert: CrewCert) => void
  onFillMissing: (cert: CrewCert) => void
  onHide: (certId?: string) => void
  onSave: (certId: string) => void
  medical?: boolean
  competency?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div>
        <CvTableTitle title={title} />
        <div className="rounded-3xl border border-orange-500/20 bg-[var(--surface-strong)] p-5 text-xs font-black uppercase tracking-widest text-[var(--subtle)]">No records yet</div>
      </div>
    )
  }

  return (
    <div>
      <CvTableTitle title={title} />
      <div className="grid gap-4">
        {rows.map((cert) => (
          <CvCertFormCard
            key={cert.id}
            cert={cert}
            section={section}
            filling={fillingCertId === cert.id}
            saving={savingCertId === cert.id}
            onChange={onChange}
            onFillMissing={() => onFillMissing(cert)}
            onHide={() => onHide(cert.id)}
            onSave={() => onSave(cert.id)}
            showSave={isDirty(cert)}
            medical={medical}
            competency={competency}
          />
        ))}
      </div>
    </div>
  )
}

function CvTrainingPairForm({
  dragged,
  fillingCertId,
  isDirty,
  onAddProficiency,
  onChange,
  onDragEnd,
  onDragStart,
  onDrop,
  onFillMissing,
  onHide,
  onSave,
  row,
  rowNumber,
  savingCertId,
}: {
  dragged: boolean
  row: CvTrainingProficiencyPair
  rowNumber: number
  fillingCertId: string
  savingCertId: string
  isDirty: (cert: CrewCert) => boolean
  onAddProficiency: (trainingCert: CrewCert) => void
  onChange: (cert: CrewCert) => void
  onFillMissing: (cert: CrewCert) => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onDrop: () => void
  onHide: (certId?: string) => void
  onSave: (certId: string) => void
}) {
  const showProficiencySide = Boolean(row.proficiency || row.requiresProficiency)
  const canAddOptionalProficiency = Boolean(row.training && isManualCvCert(row.training) && !row.proficiency && !row.requiresProficiency)
  const [dragEnabled, setDragEnabled] = useState(false)
  return (
    <div
      draggable={dragEnabled}
      onDragStart={(event) => {
        if (!dragEnabled) {
          event.preventDefault()
          return
        }
        onDragStart(event)
      }}
      onDragEnd={() => {
        setDragEnabled(false)
        onDragEnd()
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => {
        setDragEnabled(false)
        onDrop()
      }}
      className={`rounded-[30px] border border-orange-500/20 bg-[var(--surface-strong)] p-4 shadow-sm transition-all ${dragged ? 'scale-[0.99] opacity-60' : ''}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onMouseDown={() => setDragEnabled(true)}
          onTouchStart={() => setDragEnabled(true)}
          className="cursor-grab rounded-2xl border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.28em] text-[var(--accent-text)] active:cursor-grabbing"
          title="Hold here and drag to reorder this CV row"
        >
          CV training row {rowNumber} - hold this handle to reorder
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {canAddOptionalProficiency && (
            <button
              type="button"
              onClick={() => row.training && onAddProficiency(row.training)}
              className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]"
            >
              <Plus size={13} className="mr-1 inline" /> Add COP
            </button>
          )}
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">
            {showProficiencySide ? 'Training certificate + related proficiency certificate' : 'Training certificate only'}
          </p>
        </div>
      </div>
      <div className="grid gap-4">
        {row.training ? (
          <CvCertFormCard
            cert={row.training}
            section="Certificate of Training"
            filling={fillingCertId === row.training.id}
            saving={savingCertId === row.training.id}
            onChange={onChange}
            onFillMissing={() => row.training && onFillMissing(row.training)}
            onHide={() => onHide(row.training?.id)}
            onSave={() => onSave(row.training!.id)}
            showSave={isDirty(row.training)}
            titleOverride="Certificate of Training"
            compact
          />
        ) : (
          <EmptyCvSide title="Certificate of Training" />
        )}
        {showProficiencySide && (
          row.proficiency ? (
            <CvCertFormCard
              cert={row.proficiency}
              section="Certificate of Proficiency"
              filling={fillingCertId === row.proficiency.id}
              saving={savingCertId === row.proficiency.id}
              onChange={onChange}
              onFillMissing={() => row.proficiency && onFillMissing(row.proficiency)}
              onHide={isRequiredProficiencyPlaceholder(row.proficiency) ? undefined : () => onHide(row.proficiency?.id)}
              onSave={() => onSave(row.proficiency!.id)}
              showSave={isDirty(row.proficiency)}
              titleOverride="Certificate of Proficiency"
              proficiency
              compact
            />
          ) : (
            <EmptyCvSide title="Certificate of Proficiency required" />
          )
        )}
      </div>
    </div>
  )
}

function EmptyCvSide({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-orange-500/25 bg-[var(--surface)] p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{title}</p>
      <p className="mt-3 text-sm font-black text-[var(--headline)]">No record in this side</p>
    </div>
  )
}

function CvCertFormCard({
  cert,
  compact,
  competency,
  filling,
  medical,
  onChange,
  onFillMissing,
  onHide,
  onSave,
  proficiency,
  saving,
  section,
  showSave,
  titleOverride,
}: {
  cert: CrewCert
  section: string
  saving: boolean
  filling?: boolean
  competency?: boolean
  medical?: boolean
  proficiency?: boolean
  compact?: boolean
  showSave?: boolean
  titleOverride?: string
  onChange: (cert: CrewCert) => void
  onFillMissing?: () => void
  onHide?: () => void
  onSave: () => void
}) {
  const nameLabel = medical ? 'Medical Check Up Program' : competency ? 'Certificate of Competency' : titleOverride || section
  const secondLabel = competency ? 'Capacity' : medical ? 'Name of Hospital' : 'Number'
  const secondValue = competency ? cert.cv_capacity || '' : medical ? cert.place_of_issue || '' : cert.cert_number || ''
  const authorityLabel = competency ? 'Issue Authority' : medical ? 'Certificate No.' : proficiency ? 'Issue Authority' : 'Place of Issue'
  const authorityValue = competency ? cert.issue_authority || '' : medical ? cert.cert_number || '' : proficiency ? cert.issue_authority || '' : cert.place_of_issue || ''

  return (
    <div className={`rounded-3xl border border-orange-500/20 bg-[var(--surface-strong)] ${compact ? 'p-4' : 'p-5'}`}>
      <div className="mb-4 flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{nameLabel}</p>
          <div className="mt-2">
          <EditableCertName cert={cert} section={section} onChange={onChange} />
          </div>
        </div>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="h-10 w-10 shrink-0 rounded-2xl border border-red-500/25 bg-red-500/10 text-sm font-black text-red-500 transition hover:bg-red-500 hover:text-white"
            title="Remove from CV layout"
          >
            X
          </button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextField
          label={secondLabel}
          value={secondValue}
          onChange={(value) => onChange(competency ? { ...cert, cv_capacity: value, cv_section: section } : medical ? { ...cert, place_of_issue: value, cv_section: section } : { ...cert, cert_number: value, cv_section: section })}
        />
        {competency && (
          <TextField label="Certificate No." value={cert.cert_number || ''} onChange={(value) => onChange({ ...cert, cert_number: value, cv_section: section })} />
        )}
        <DateField label="Issued Date" value={toDateValue(cert.issue_date)} onChange={(value) => onChange({ ...cert, issue_date: value, cv_section: section })} />
        <DateField label="Expiry Date" value={toDateValue(cert.expiry_date)} onChange={(value) => onChange({ ...cert, expiry_date: value, cv_section: section })} />
        <TextField
          label={authorityLabel}
          value={authorityValue}
          onChange={(value) => onChange(competency ? { ...cert, issue_authority: value, cv_section: section } : medical ? { ...cert, cert_number: value, cv_section: section } : proficiency ? { ...cert, issue_authority: value, cv_section: section } : { ...cert, place_of_issue: value, cv_section: section })}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <CertActions cert={cert} filling={filling} saving={saving} showSave={showSave} onFillMissing={onFillMissing} onSave={onSave} />
      </div>
    </div>
  )
}

function EditableCertName({ cert, onChange, section }: { cert: CrewCert; section: string; onChange: (cert: CrewCert) => void }) {
  const competency = section === 'Certificate of Competency'
  if (isManualCvCert(cert) || competency) {
    const competencyTitle = getCompetencyDisplayTitle(cert)
    return (
      <input
        value={competency && isGenericCompetencyName(competencyTitle) ? '' : competency ? competencyTitle : cert.cert_name}
        placeholder={competency ? 'Master' : 'Certificate name'}
        onChange={(event) => onChange(competency
          ? { ...cert, cv_competency_title: event.target.value, cv_section: section, master_cv_section: section }
          : { ...cert, cert_name: event.target.value, cv_section: section, master_cv_section: section })}
        className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-sm font-black italic uppercase text-[var(--headline)] outline-none transition-all focus:border-orange-500"
      />
    )
  }

  return (
    <div>
      <p className="mb-2 text-sm font-black italic uppercase text-[var(--headline)]">{formatCvCertName(cert.cert_name)}</p>
    </div>
  )
}

function hasMissingCvCertFields(cert: CrewCert) {
  const section = getCvCertSection(cert)
  if (section === 'Certificate of Competency') {
    const competencyTitle = getCompetencyDisplayTitle(cert)
    return !competencyTitle || isGenericCompetencyName(competencyTitle) || !cert.cv_capacity || !cert.cert_number || !cert.issue_authority || !cert.issue_date || !cert.expiry_date
  }
  if (section === 'Certificate of Proficiency') {
    return !cert.cert_number || !cert.issue_authority || !cert.issue_date || !cert.expiry_date
  }
  return !cert.cert_number || !cert.place_of_issue || !cert.issue_authority || !cert.issue_date || !cert.expiry_date
}

function CertActions({ cert, filling, onFillMissing, onSave, saving, showSave }: { cert: CrewCert; filling?: boolean; onFillMissing?: () => void; onSave: () => void; saving: boolean; showSave?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {cert.file_url && (
        <a href={cert.file_url} target="_blank" rel="noreferrer" className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">
          View Cert
        </a>
      )}
      {cert.file_url && onFillMissing && !isManualCvCert(cert) && hasMissingCvCertFields(cert) && (
        <button
          type="button"
          onClick={onFillMissing}
          disabled={filling}
          className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-500 disabled:opacity-50"
        >
          {filling ? 'Reading...' : 'Fill missing from file'}
        </button>
      )}
      {showSave && (
        <button onClick={onSave} disabled={saving} className="rounded-2xl bg-orange-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save after edit'}
        </button>
      )}
    </div>
  )
}

function VaccinationTable({ onDelete, rows }: { rows: VaccinationRow[]; onDelete: (id: string) => void }) {
  if (rows.length === 0) return <div className="mt-5 rounded-3xl bg-[var(--surface-strong)] p-5 text-xs font-black uppercase tracking-widest text-[var(--subtle)]">No vaccination records yet</div>
  return (
    <div className="mt-5 overflow-x-auto rounded-3xl border border-orange-500/20">
      <table className="min-w-[880px] w-full text-left text-xs">
        <thead className="bg-orange-500/10 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">
          <tr>
            <th className="px-4 py-3">Vaccine</th>
            <th className="px-4 py-3">Dose / Detail</th>
            <th className="px-4 py-3">Date Given</th>
            <th className="px-4 py-3">Expiry Date</th>
            <th className="px-4 py-3">Place</th>
            <th className="px-4 py-3">Remarks</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-orange-500/10">
              <td className="px-4 py-3 font-black text-[var(--headline)]">{row.vaccine_name}</td>
              <td className="px-4 py-3 text-[var(--headline)]">{row.dose_detail || '-'}</td>
              <td className="px-4 py-3 text-[var(--headline)]">{formatDate(row.date_given)}</td>
              <td className="px-4 py-3 text-[var(--headline)]">{formatDate(row.expiry_date)}</td>
              <td className="px-4 py-3 text-[var(--headline)]">{row.place_given || '-'}</td>
              <td className="px-4 py-3 text-[var(--subtle)]">{row.remarks || '-'}</td>
              <td className="px-4 py-3">
                <button onClick={() => onDelete(row.id)} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--danger-text)]">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SeaServiceHistory({ onDelete, onEdit, services }: { onDelete: (id: string) => void; onEdit: (row: SeaServiceRow) => void; services: SeaServiceRow[] }) {
  return (
    <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
      <h2 className="mb-5 text-xl font-black italic uppercase text-[var(--headline)]">Sailing Voyages History</h2>
      <div className="space-y-3">
        {services.length === 0 && <div className="rounded-3xl bg-[var(--surface-strong)] p-6 text-[var(--subtle)]">No sea service records yet.</div>}
        {services.map((row) => {
          const days = dayDiffInclusive(row.joining_date, row.sign_off_date)
          return (
            <div key={row.id} className="grid gap-4 rounded-3xl border border-orange-500/15 bg-[var(--surface-strong)] p-5 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto] md:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{row.vessel_type || 'Vessel'}</p>
                <h3 className="mt-1 text-lg font-black italic uppercase text-[var(--headline)]">{row.vessel_name}</h3>
                <p className="mt-1 text-xs normal-case text-[var(--subtle)]">{row.flag || '-'} | GRT {row.grt || '-'} | DWT {row.dwt || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Rank</p>
                <p className="text-sm font-black text-[var(--headline)]">{row.rank || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Company / Charter</p>
                <p className="text-sm font-black text-[var(--headline)]">{row.company || '-'}</p>
                <p className="mt-1 text-[10px] font-black uppercase text-[var(--accent-text)]">{row.charterer || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Period</p>
                <p className="text-sm font-black text-[var(--headline)]">{formatDate(row.joining_date)} - {formatDate(row.sign_off_date)}</p>
                <p className="mt-1 text-[10px] font-black uppercase text-[var(--accent-text)]">{formatServiceDuration(days)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => onEdit(row)} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs font-black uppercase text-blue-600">
                  <PencilLine size={14} className="mr-2 inline" /> Edit
                </button>
                <button onClick={() => onDelete(row.id)} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-black uppercase text-[var(--danger-text)]">
                  <Trash2 size={14} className="mr-2 inline" /> Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function buildSeaServicePayload(form: SeaServiceForm) {
  return {
    vessel_master_id: form.vessel_master_id || null,
    vessel_name: clean(form.vessel_name),
    vessel_type: clean(form.vessel_type) || null,
    flag: clean(form.flag) || null,
    imo_no: clean(form.imo_no) || null,
    grt: clean(form.grt) || null,
    dwt: clean(form.dwt) || null,
    engine_type: clean(form.engine_type) || null,
    bhp: clean(form.bhp) || null,
    company: clean(form.company) || null,
    trading_area: clean(form.trading_area) || null,
    rank: clean(form.rank) || null,
    charterer: clean(form.charterer) || null,
    joining_date: form.joining_date || null,
    sign_off_date: form.sign_off_date || null,
    remarks: clean(form.remarks) || null,
  }
}

function MetricCard({
  detail,
  label,
  onSelect,
  options,
  selected,
  value,
}: {
  detail: string
  label: string
  onSelect?: (value: string) => void
  options?: string[]
  selected?: string
  value: string
}) {
  const canSelect = Boolean(onSelect && options && options.length > 1)
  return (
    <div className="rounded-[32px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--accent-text)]">{label}</p>
      <p className="mt-4 text-3xl font-black text-[var(--headline)]">{value}</p>
      <p className="mt-1 text-xs normal-case text-[var(--subtle)]">{detail}</p>
      {canSelect && options && onSelect && (
        <select
          value={selected || options[0] || ''}
          onChange={(event) => onSelect(event.target.value)}
          className="mt-4 w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--headline)] outline-none transition-all focus:border-orange-500"
        >
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      )}
    </div>
  )
}

function TextField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-sm font-black text-[var(--headline)] outline-none transition-all focus:border-orange-500"
      />
    </label>
  )
}

function RankField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-sm font-black text-[var(--headline)] outline-none transition-all focus:border-orange-500"
      >
        <option value="">Select rank...</option>
        {value && !rankGroups.some((group) => group.options.includes(value)) && (
          <option value={value}>{value}</option>
        )}
        {rankGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((rank) => (
              <option key={`${group.label}-${rank}`} value={rank}>{rank}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-sm font-black text-[var(--headline)] outline-none transition-all focus:border-orange-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function DateField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" size={16} />
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] py-3 pl-11 pr-4 text-sm font-black text-[var(--headline)] outline-none transition-all focus:border-orange-500"
        />
      </div>
    </label>
  )
}
