type CrewMatrixCrew = {
  id: string
  full_name?: string | null
  position?: string | null
  is_active?: boolean | null
  resigned_at?: string | null
}

type CrewMatrixCertificate = {
  crew_id: string
  cert_name: string
  expiry_date?: string | null
}

type CrewMatrixMaster = {
  cert_name: string
  cv_order?: number | null
}

export type CrewCertificateMatrixInput = {
  crews: CrewMatrixCrew[]
  crewCerts: CrewMatrixCertificate[]
  certMaster: CrewMatrixMaster[]
  today?: Date
}

type MatrixCellTone = 'identity' | 'blank' | 'expired' | 'warning' | 'valid' | 'no-expiry'
const NO_EXPIRY_DATE = '2099-12-31'

const STYLE_INDEX: Record<'header' | MatrixCellTone, number> = {
  header: 1,
  identity: 2,
  blank: 3,
  expired: 4,
  warning: 5,
  valid: 6,
  'no-expiry': 7,
}

const MATRIX_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="dd mmm yyyy"/></numFmts>
  <fonts count="2">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFC65900"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/>
</styleSheet>`

function normalizeDateOnly(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}

function parseDatabaseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

function getExpiryTone(expiryDate: Date, today: Date): MatrixCellTone {
  const daysLeft = Math.floor((expiryDate.getTime() - today.getTime()) / 86400000)
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 90) return 'warning'
  return 'valid'
}

function replaceCellStyle(cellTag: string, styleIndex: number) {
  if (/\ss="\d+"/.test(cellTag)) return cellTag.replace(/\ss="\d+"/, ` s="${styleIndex}"`)
  return cellTag.replace(/>$/, ` s="${styleIndex}">`)
}

function addFreezePane(sheetXml: string) {
  const frozenView = '<sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="topRight" activeCell="C1" sqref="C1"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/><selection pane="bottomRight" activeCell="C2" sqref="C2"/></sheetView></sheetViews>'
  return sheetXml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, frozenView)
}

export async function createCrewCertificateMatrixWorkbook({
  crews,
  crewCerts,
  certMaster,
  today = new Date(),
}: CrewCertificateMatrixInput) {
  const XLSX = await import('xlsx')
  const JSZip = (await import('jszip')).default
  const activeCrews = crews
    .filter((crew) => crew.is_active !== false && !crew.resigned_at)
    .sort((left, right) => String(left.full_name || '').localeCompare(String(right.full_name || ''), 'en', { sensitivity: 'base' }))
  const masterRows = certMaster
    .filter((row) => Boolean(row.cert_name))
    .sort((left, right) => {
      const orderDifference = Number(left.cv_order ?? Number.MAX_SAFE_INTEGER) - Number(right.cv_order ?? Number.MAX_SAFE_INTEGER)
      return orderDifference || left.cert_name.localeCompare(right.cert_name, 'en', { sensitivity: 'base' })
    })
  const certByCrewAndName = new Map(crewCerts.map((cert) => [`${cert.crew_id}\u0000${cert.cert_name}`, cert]))
  const normalizedToday = normalizeDateOnly(today)
  const styleByCell = new Map<string, number>()
  const rows: Array<Array<string | Date>> = [['CREW NAME', 'POSITION', ...masterRows.map((row) => row.cert_name)]]

  rows[0].forEach((_, columnIndex) => styleByCell.set(XLSX.utils.encode_cell({ r: 0, c: columnIndex }), STYLE_INDEX.header))

  activeCrews.forEach((crew, crewIndex) => {
    const rowIndex = crewIndex + 1
    const row: Array<string | Date> = [String(crew.full_name || ''), String(crew.position || '')]
    styleByCell.set(XLSX.utils.encode_cell({ r: rowIndex, c: 0 }), STYLE_INDEX.identity)
    styleByCell.set(XLSX.utils.encode_cell({ r: rowIndex, c: 1 }), STYLE_INDEX.identity)

    masterRows.forEach((master, masterIndex) => {
      const columnIndex = masterIndex + 2
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
      const uploaded = certByCrewAndName.get(`${crew.id}\u0000${master.cert_name}`)
      if (!uploaded) {
        row.push('')
        styleByCell.set(cellRef, STYLE_INDEX.blank)
        return
      }
      if (String(uploaded.expiry_date || '') === NO_EXPIRY_DATE) {
        row.push('NO EXPIRY')
        styleByCell.set(cellRef, STYLE_INDEX['no-expiry'])
        return
      }
      const expiryDate = uploaded.expiry_date ? parseDatabaseDate(uploaded.expiry_date) : null
      if (!expiryDate) {
        row.push('')
        styleByCell.set(cellRef, STYLE_INDEX.blank)
        return
      }
      row.push(expiryDate)
      styleByCell.set(cellRef, STYLE_INDEX[getExpiryTone(expiryDate, normalizedToday)])
    })
    rows.push(row)
  })

  const worksheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: false, dateNF: 'dd mmm yyyy' })
  const lastCell = XLSX.utils.encode_cell({ r: Math.max(rows.length - 1, 0), c: Math.max(rows[0].length - 1, 0) })
  worksheet['!autofilter'] = { ref: `A1:${lastCell}` }
  worksheet['!cols'] = [
    { wch: 30 },
    { wch: 22 },
    ...masterRows.map(() => ({ wch: 20 })),
  ]
  worksheet['!rows'] = [{ hpt: 56 }, ...activeCrews.map(() => ({ hpt: 22 }))]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Crew Cert Matrix')
  const xlsxBytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer
  const archive = await JSZip.loadAsync(xlsxBytes)
  const sheetFile = archive.file('xl/worksheets/sheet1.xml')
  if (!sheetFile) throw new Error('Unable to format Crew Certificate Matrix worksheet')

  let sheetXml = addFreezePane(await sheetFile.async('string'))
  sheetXml = sheetXml.replace(/<c r="([A-Z]+\d+)"[^>]*>/g, (cellTag, cellRef: string) => {
    const styleIndex = styleByCell.get(cellRef)
    return styleIndex === undefined ? cellTag : replaceCellStyle(cellTag, styleIndex)
  })
  archive.file('xl/worksheets/sheet1.xml', sheetXml)
  archive.file('xl/styles.xml', MATRIX_STYLES_XML)

  return archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

export async function exportCrewCertificateMatrix(input: CrewCertificateMatrixInput) {
  const workbookBytes = await createCrewCertificateMatrixWorkbook(input)
  const stamp = new Date().toISOString().slice(0, 10)
  const fileName = `crew-certificate-matrix-${stamp}.xlsx`
  const blobBytes = new Uint8Array(workbookBytes).buffer
  const url = URL.createObjectURL(new Blob([blobBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 3000)
  return fileName
}
