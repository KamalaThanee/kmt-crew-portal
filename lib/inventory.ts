export const DO_BUCKET = 'receipts'

const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

export function compareInventorySize(a: unknown, b: unknown) {
  const sa = String(a || '').trim().toUpperCase()
  const sb = String(b || '').trim().toUpperCase()

  const freeRank: Record<string, number> = { 'FREE SIZE': 9998, FREESIZE: 9998, FS: 9998 }
  if (freeRank[sa] !== undefined || freeRank[sb] !== undefined) {
    const ra = freeRank[sa] ?? 10000
    const rb = freeRank[sb] ?? 10000
    if (ra !== rb) return ra - rb
  }

  const idxA = sizeOrder.indexOf(sa)
  const idxB = sizeOrder.indexOf(sb)
  const hasA = idxA !== -1
  const hasB = idxB !== -1
  if (hasA && hasB) return idxA - idxB
  if (hasA) return -1
  if (hasB) return 1

  const numA = Number(sa)
  const numB = Number(sb)
  const isNumA = !Number.isNaN(numA)
  const isNumB = !Number.isNaN(numB)
  if (isNumA && isNumB) return numA - numB
  if (isNumA) return -1
  if (isNumB) return 1

  return sa.localeCompare(sb, undefined, { numeric: true })
}

export function generateInventoryCode(inventory: any[], catName: string) {
  const catItems = inventory.filter((item) => item.category === catName)
  const numbers = catItems.map((item) => {
    const match = String(item.item_id_code).match(/(\d+)\s*$/)
    return match ? parseInt(match[1], 10) : 0
  })
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  const padded = String(nextNumber).padStart(2, '0')

  const prefixMap: Record<string, string> = {
    'Head Protection': 'Head',
    'Ears Protection': 'Ear',
    'Eyes Protection': 'Eye',
    'Respiratory Protection': 'Resp',
    'Body Protection': 'Body',
    'Hands Protection': 'Hand',
    'Foots Protection': 'Foot',
    Other: 'Other',
  }

  const existingPrefix = catItems
    .map((item) => String(item.item_id_code || '').match(/^([A-Za-z]+)-\d+$/)?.[1])
    .find(Boolean)

  const prefix = existingPrefix || prefixMap[catName] || catName.replace(/\s+Protection$/i, '').replace(/\s+/g, '')
  return `${prefix}-${padded}`
}

export function groupInventoryByCategory({
  inventory,
  searchTerm,
  selectedCats,
  showLowStock,
}: {
  inventory: any[]
  searchTerm: string
  selectedCats: string[]
  showLowStock: boolean
}) {
  const groups: Record<string, any[]> = {}
  const lowerSearch = searchTerm.toLowerCase()
  const filtered = inventory.filter((item) => {
    const matchesSearch =
      item.item_name?.toLowerCase().includes(lowerSearch) ||
      (item.item_id_code || '').toLowerCase().includes(lowerSearch)
    const matchesCat = selectedCats.length === 0 || selectedCats.includes(item.category)
    const matchesStock = showLowStock ? item.quantity <= item.threshold : true
    return matchesSearch && matchesCat && matchesStock
  })

  filtered.forEach((item) => {
    const cat = item.category || 'Other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  })

  Object.keys(groups).forEach((cat) => {
    groups[cat] = groups[cat].sort((a, b) => {
      const nameCmp = String(a.item_name || '').localeCompare(String(b.item_name || ''), undefined, { numeric: true })
      if (nameCmp !== 0) return nameCmp
      const colorCmp = String(a.color || '').localeCompare(String(b.color || ''), undefined, { numeric: true })
      if (colorCmp !== 0) return colorCmp
      return compareInventorySize(a.size, b.size)
    })
  })

  return groups
}

export function getRestockMonthOptions(history: any[]) {
  const options = new Set<string>()
  history.forEach((item) => {
    if (!item.created_at) return
    options.add(new Date(item.created_at).toISOString().slice(0, 7))
  })
  return [...options].sort().reverse()
}

export function generateDoNumber() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  return `DO-${date}-${time}`
}

export function isMissingRestockColumn(error: unknown) {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return message.includes('schema cache') || message.includes('column')
}

export function getAtomicDeleteMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('delete_restock_history_lines') || normalized.includes('function') || normalized.includes('schema cache')) {
    return 'Run sql/restock_do_batches.sql in Supabase first, then try deleting again.'
  }
  return message || 'Unable to delete restock history'
}

export function getDoStorageFileRef(value: string) {
  const directPath = value.match(/^receipts\/(.+)$/)
  if (directPath) return { bucket: DO_BUCKET, path: directPath[1] }

  const legacyDoFilesPath = value.match(/^do-files\/(.+)$/)
  if (legacyDoFilesPath) return null

  try {
    const url = new URL(value)
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/receipts\/(.+)$/)
    return match?.[1] ? { bucket: DO_BUCKET, path: decodeURIComponent(match[1]) } : null
  } catch {
    return null
  }
}

export function getDoOpenErrorMessage(message: string) {
  const normalized = String(message || '').toLowerCase()
  if (normalized.includes('not found')) {
    return 'DO file was not found in storage. This older record may point to a file that was never uploaded.'
  }
  return message || 'Unable to open DO file'
}

export function groupRestockBatches(history: any[], restockMonthFilter: string) {
  const filtered = history.filter((item) => {
    if (restockMonthFilter === 'all') return true
    if (!item.created_at) return false
    return new Date(item.created_at).toISOString().slice(0, 7) === restockMonthFilter
  })

  const groups: Record<string, any> = {}
  filtered.forEach((item) => {
    const createdAt = item.created_at || new Date().toISOString()
    const key =
      item.batch_id ||
      item.do_number ||
      item.receipt_url ||
      `${new Date(createdAt).toISOString().slice(0, 10)}-${item.added_by || 'admin'}`
    if (!groups[key]) {
      groups[key] = {
        id: key,
        do_number: item.do_number || `DO-${new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '')}`,
        receipt_url: item.receipt_url,
        added_by: item.added_by,
        created_at: createdAt,
        lines: [],
        totalQty: 0,
      }
    }
    groups[key].lines.push(item)
    groups[key].totalQty += Number(item.quantity_added || 0)
    if (item.receipt_url && !groups[key].receipt_url) groups[key].receipt_url = item.receipt_url
  })

  return Object.values(groups).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function buildInventoryExportRows(groupedInventory: Record<string, any[]>) {
  return Object.entries(groupedInventory).flatMap(([category, items]) =>
    items.map((item) => ({
      Category: category,
      Code: item.item_id_code || '',
      'Item Name': item.item_name || '',
      Color: item.color || '',
      Size: item.size || '',
      Unit: item.unit || 'Piece',
      Quantity: Number(item.quantity || 0),
      Threshold: Number(item.threshold || 0),
      Status: Number(item.quantity || 0) <= Number(item.threshold || 0) ? 'Low Stock' : 'OK',
    })),
  )
}

export function buildRestockBatchExportRows(batch: any) {
  return (batch.lines || []).map((line: any, index: number) => ({
    No: index + 1,
    'DO Number': batch.do_number || '',
    'Received Date': batch.created_at ? new Date(batch.created_at).toLocaleString() : '',
    'Received By': batch.added_by || 'Admin',
    'Item Name': line.item_name || '',
    Color: line.color || '',
    Size: line.size || '',
    Quantity: Number(line.quantity_added || 0),
  }))
}
