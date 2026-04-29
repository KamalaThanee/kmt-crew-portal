export async function exportJsonRowsToExcel({
  fileName,
  rows,
  sheetName,
}: {
  fileName: string
  rows: Record<string, unknown>[]
  sheetName: string
}) {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, fileName)
}
