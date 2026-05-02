import type { ShipCertificate } from '@/lib/shipCertificates'

const formSheets = ['Class', 'GMDSS', 'FFE', 'LSA'] as const
const templatePath = '/templates/ship-certificate-checklist-11.62.xlsx'
const classSheetCategories = new Set(['Flag', 'Class', 'Insurance', 'Permit'])
const spreadsheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

function nilIfEmpty(value?: string | null) {
  return value && String(value).trim() ? String(value).trim() : 'Nil'
}

function sortByCodeAndOrder(a: ShipCertificate, b: ShipCertificate) {
  const orderDiff = (a.sort_order || 0) - (b.sort_order || 0)
  if (orderDiff !== 0) return orderDiff
  return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' })
}

function getRowsForSheet(rows: ShipCertificate[], sheetName: (typeof formSheets)[number]) {
  if (sheetName === 'Class') {
    return rows.filter((row) => classSheetCategories.has(String(row.category || ''))).sort(sortByCodeAndOrder)
  }
  return rows.filter((row) => row.category === sheetName).sort(sortByCodeAndOrder)
}

function toExcelDateSerial(value?: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return Math.round(date.getTime() / 86400000 + 25569)
}

function dateOrNil(value?: string | null) {
  return toExcelDateSerial(value) ?? 'Nil'
}

function encodeCol(index: number) {
  let col = ''
  let current = index + 1
  while (current > 0) {
    const mod = (current - 1) % 26
    col = String.fromCharCode(65 + mod) + col
    current = Math.floor((current - mod) / 26)
  }
  return col
}

function decodeCol(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0] || ''
  return letters.split('').reduce((sum, char) => sum * 26 + char.toUpperCase().charCodeAt(0) - 64, 0) - 1
}

function sanitizeXmlText(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
}

function getRow(doc: Document, rowNumber: number) {
  const rows = Array.from(doc.getElementsByTagNameNS(spreadsheetNs, 'row'))
  return rows.find((row) => row.getAttribute('r') === String(rowNumber)) || null
}

function getCell(doc: Document, row: Element, colIndex: number, rowNumber: number) {
  const ref = `${encodeCol(colIndex)}${rowNumber}`
  const cells = Array.from(row.getElementsByTagNameNS(spreadsheetNs, 'c'))
  let cell = cells.find((item) => item.getAttribute('r') === ref)
  if (cell) return cell

  cell = doc.createElementNS(spreadsheetNs, 'c')
  cell.setAttribute('r', ref)
  const nextCell = cells.find((item) => decodeCol(item.getAttribute('r') || '') > colIndex)
  if (nextCell) row.insertBefore(cell, nextCell)
  else row.appendChild(cell)
  return cell
}

function clearCell(cell: Element) {
  cell.removeAttribute('t')
  Array.from(cell.childNodes).forEach((node) => cell.removeChild(node))
}

function setCellValue(doc: Document, cell: Element, value: string | number | null) {
  clearCell(cell)
  if (value === null || value === '') return

  if (typeof value === 'number') {
    const v = doc.createElementNS(spreadsheetNs, 'v')
    v.textContent = String(value)
    cell.appendChild(v)
    return
  }

  cell.setAttribute('t', 'str')
  const v = doc.createElementNS(spreadsheetNs, 'v')
  v.textContent = sanitizeXmlText(value)
  cell.appendChild(v)
}

function clearTemplateDataRows(doc: Document, sheetName: (typeof formSheets)[number], startRow: number, endRow: number) {
  const cols = sheetName === 'Class' ? [0, 1, 3, 4, 5, 6, 7, 8] : [0, 1, 5, 6, 7, 8]
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = getRow(doc, rowNumber)
    if (!row) continue
    for (const col of cols) {
      setCellValue(doc, getCell(doc, row, col, rowNumber), null)
    }
  }
}

function fillSheet(doc: Document, sheetName: (typeof formSheets)[number], sourceRows: ShipCertificate[]) {
  const startRow = 8
  const templateEndRow = Number(doc.getElementsByTagNameNS(spreadsheetNs, 'dimension')[0]?.getAttribute('ref')?.match(/(\d+)$/)?.[1] || 80)
  const rows = getRowsForSheet(sourceRows, sheetName)

  setCellValue(doc, getCell(doc, getRow(doc, 5)!, 2, 5), 'Kamala Thanee')
  if (sheetName === 'Class') {
    setCellValue(doc, getCell(doc, getRow(doc, 5)!, 8, 5), toExcelDateSerial(new Date().toISOString().slice(0, 10)))
  }

  clearTemplateDataRows(doc, sheetName, startRow, Math.max(templateEndRow, startRow + rows.length + 5))

  rows.forEach((row, index) => {
    const rowNumber = startRow + index
    const rowEl = getRow(doc, rowNumber)
    if (!rowEl) return

    if (sheetName === 'Class') {
      const values = [
        [0, row.code || ''],
        [1, row.cert_name || ''],
        [3, nilIfEmpty(row.issue_by)],
        [4, dateOrNil(row.issued_date)],
        [5, row.has_expiry === false ? 'Nil' : dateOrNil(row.expiry_date)],
        [6, row.has_survey ? dateOrNil(row.last_survey_date) : 'Nil'],
        [7, row.has_survey ? dateOrNil(row.next_survey_date) : 'Nil'],
        [8, nilIfEmpty(row.remark)],
      ] as Array<[number, string | number | null]>
      values.forEach(([col, value]) => setCellValue(doc, getCell(doc, rowEl, col, rowNumber), value))
      return
    }

    const values = [
      [0, row.code || index + 1],
      [1, row.cert_name || ''],
      [5, nilIfEmpty(row.issue_by)],
      [6, dateOrNil(row.issued_date)],
      [7, row.has_expiry === false ? 'Nil' : dateOrNil(row.expiry_date)],
      [8, nilIfEmpty(row.remark)],
    ] as Array<[number, string | number | null]>
    values.forEach(([col, value]) => setCellValue(doc, getCell(doc, rowEl, col, rowNumber), value))
  })
}

export async function exportShipCertificatesTo1162(rows: ShipCertificate[]) {
  const [{ default: JSZip }] = await Promise.all([import('jszip')])
  const templateResponse = await fetch(templatePath)
  if (!templateResponse.ok) throw new Error('11.62 template file not found')

  const zip = await JSZip.loadAsync(await templateResponse.arrayBuffer())
  const parser = new DOMParser()
  const serializer = new XMLSerializer()

  formSheets.forEach((sheetName, index) => {
    const sheetPath = `xl/worksheets/sheet${index + 1}.xml`
    const sheetFile = zip.file(sheetPath)
    if (!sheetFile) throw new Error(`Template sheet missing: ${sheetName}`)
  })

  for (const [index, sheetName] of formSheets.entries()) {
    const sheetPath = `xl/worksheets/sheet${index + 1}.xml`
    const xml = await zip.file(sheetPath)!.async('string')
    const doc = parser.parseFromString(xml, 'application/xml')
    fillSheet(doc, sheetName, rows)
    zip.file(sheetPath, serializer.serializeToString(doc))
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const now = new Date()
  const stamp = [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `KMT-11.62-Ship-Certificate-Checklist-${stamp}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
