import type { ShipCertificate } from '@/lib/shipCertificates'

const formSheets = ['Class', 'GMDSS', 'FFE', 'LSA'] as const

const classSheetCategories = new Set(['Flag', 'Class', 'Insurance', 'Permit'])

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
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  for (const sheetName of formSheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(buildSheetRows(sheetName, rows), { cellDates: true })
    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 32 },
      { wch: 8 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
    ]
    worksheet['!merges'] = [
      { s: { r: 1, c: 2 }, e: { r: 1, c: 2 } },
      { s: { r: 4, c: 2 }, e: { r: 4, c: 4 } },
    ]
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `KMT-Ship-Certificate-Checklist-11.62-${stamp}.xlsx`)
}
