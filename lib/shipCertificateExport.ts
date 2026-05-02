import type { ShipCertificate } from '@/lib/shipCertificates'

const formSheets = ['Class', 'GMDSS', 'FFE', 'LSA'] as const

const classSheetCategories = new Set(['Flag', 'Class', 'Insurance', 'Permit'])
const tableHeaderRowIndex = 6

const thinBorder = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
}

function normalizeDateValue(value?: string | null) {
  if (!value) return 'Nil'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date
}

function nilIfEmpty(value?: string | null) {
  return value && String(value).trim() ? value : 'Nil'
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

function buildHeaderRows(sheetName: (typeof formSheets)[number]) {
  const month = new Date()
  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return [
    [],
    [null, null, 'Title:\nShip Certificate Checklist', 'Revision Number\n0', 'Effective Date\n17 May 2021', null, null, null, 'Document Number\n11.62'],
    [null, null, null, 'Reviewed By\nDPA', 'Approved By\nManaging Director', null, null, null, 'Page 1 of 1'],
    [],
    ['Vessel : ', null, 'Kamala Thanee', null, null, sheetName === 'Class' ? 'Month :' : null, null, sheetName === 'Class' ? null : 'Month :', monthLabel],
    [],
  ]
}

function applyCellStyle(worksheet: Record<string, any>, cellAddress: string, style: Record<string, any>) {
  if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' }
  worksheet[cellAddress].s = {
    ...(worksheet[cellAddress].s || {}),
    ...style,
  }
}

function applyRangeStyle(XLSX: any, worksheet: Record<string, any>, rangeAddress: string, style: Record<string, any>) {
  const range = XLSX.utils.decode_range(rangeAddress)
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      applyCellStyle(worksheet, XLSX.utils.encode_cell({ r: row, c: col }), style)
    }
  }
}

function applyFormLayout(XLSX: any, worksheet: Record<string, any>, sheetName: (typeof formSheets)[number], rowCount: number) {
  const tableEndRow = Math.max(tableHeaderRowIndex, rowCount - 1)
  const tableRange = XLSX.utils.encode_range({ s: { r: tableHeaderRowIndex, c: 0 }, e: { r: tableEndRow, c: 8 } })

  worksheet['!cols'] = [
    { wch: 10 },
    { wch: sheetName === 'Class' ? 38 : 44 },
    { wch: 5 },
    { wch: sheetName === 'Class' ? 24 : 5 },
    { wch: sheetName === 'Class' ? 14 : 5 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
  ]
  worksheet['!rows'] = Array.from({ length: rowCount }, (_, index) => ({
    hpt: index === 1 || index === 2 ? 34 : index === tableHeaderRowIndex ? 24 : index > tableHeaderRowIndex ? 30 : 18,
  }))
  worksheet['!merges'] = [
    { s: { r: 1, c: 2 }, e: { r: 1, c: 2 } },
    { s: { r: 4, c: 2 }, e: { r: 4, c: 4 } },
  ]
  worksheet['!autofilter'] = { ref: tableRange }
  worksheet['!margins'] = { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 }
  worksheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }

  applyRangeStyle(XLSX, worksheet, 'A2:I3', {
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    font: { bold: true, name: 'Arial', sz: 10 },
  })
  applyRangeStyle(XLSX, worksheet, 'A5:I5', {
    border: thinBorder,
    alignment: { vertical: 'center', wrapText: true },
    font: { bold: true, name: 'Arial', sz: 10 },
  })
  applyRangeStyle(XLSX, worksheet, `A${tableHeaderRowIndex + 1}:I${tableHeaderRowIndex + 1}`, {
    border: thinBorder,
    fill: { fgColor: { rgb: 'D9EAD3' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    font: { bold: true, name: 'Arial', sz: 10 },
  })
  applyRangeStyle(XLSX, worksheet, tableRange, {
    border: thinBorder,
    alignment: { vertical: 'center', wrapText: true },
    font: { name: 'Arial', sz: 10 },
  })

  for (let row = tableHeaderRowIndex + 1; row <= tableEndRow; row += 1) {
    for (const col of [4, 5, 6, 7]) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      if (worksheet[cellAddress]?.t === 'd') worksheet[cellAddress].z = 'dd mmm yyyy'
    }
  }
}

function buildSheetRows(sheetName: (typeof formSheets)[number], rows: ShipCertificate[]) {
  const sheetRows = getRowsForSheet(rows, sheetName)
  const headerRows = buildHeaderRows(sheetName)

  if (sheetName === 'Class') {
    return [
      ...headerRows,
      ['No', 'CERTIFICATE', null, 'ISSUE BY', 'ISSUED DATE', 'EXPIRE DATE', 'LAST SURVEY', 'NEXT SURVEY', 'Remark'],
      ...sheetRows.map((row) => [
        row.code || '',
        row.cert_name || '',
        null,
        nilIfEmpty(row.issue_by),
        normalizeDateValue(row.issued_date),
        row.has_expiry === false ? 'Nil' : normalizeDateValue(row.expiry_date),
        row.has_survey ? normalizeDateValue(row.last_survey_date) : 'Nil',
        row.has_survey ? normalizeDateValue(row.next_survey_date) : 'Nil',
        nilIfEmpty(row.remark),
      ]),
    ]
  }

  return [
    ...headerRows,
    ['No', 'CERTIFICATE', null, null, null, 'ISSUE BY', 'ISSUED DATE', 'EXPIRE DATE', 'Remark'],
    ...sheetRows.map((row, index) => [
      row.code || index + 1,
      row.cert_name || '',
      null,
      null,
      null,
      nilIfEmpty(row.issue_by),
      normalizeDateValue(row.issued_date),
      row.has_expiry === false ? 'Nil' : normalizeDateValue(row.expiry_date),
      nilIfEmpty(row.remark),
    ]),
  ]
}

export async function exportShipCertificatesTo1162(rows: ShipCertificate[]) {
  const XLSX = await import('xlsx-js-style')
  const workbook = XLSX.utils.book_new()

  for (const sheetName of formSheets) {
    const sheetRows = buildSheetRows(sheetName, rows)
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows, { cellDates: true })
    applyFormLayout(XLSX, worksheet, sheetName, sheetRows.length)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `KMT-Ship-Certificate-Checklist-11.62-${stamp}.xlsx`)
}
