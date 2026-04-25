import { supabase } from '@/lib/supabase'

type PpeRequestColumns = {
  idColumn: string | null
  nameColumn: string | null
}

const ID_COLUMN_CANDIDATES = ['crew_id', 'requester_id', 'user_id']
const NAME_COLUMN_CANDIDATES = ['crew_name', 'requester_name', 'full_name']

let cachedColumns: Promise<PpeRequestColumns> | null = null

function isMissingColumnError(error: unknown, column: string) {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return message.includes(column.toLowerCase()) && message.includes('schema cache')
}

async function findFirstExistingColumn(candidates: string[]) {
  for (const column of candidates) {
    const { error } = await supabase.from('ppe_requests').select(`id, ${column}`).limit(1)
    if (!error) return column
    if (!isMissingColumnError(error, column)) {
      console.warn(`Unable to verify ppe_requests.${column}:`, error)
    }
  }
  return null
}

export async function getPpeRequestColumns() {
  if (!cachedColumns) {
    cachedColumns = (async () => {
      const [idColumn, nameColumn] = await Promise.all([
        findFirstExistingColumn(ID_COLUMN_CANDIDATES),
        findFirstExistingColumn(NAME_COLUMN_CANDIDATES),
      ])

      return { idColumn, nameColumn }
    })()
  }

  return cachedColumns
}

export async function applyPpeRequestUserFilter(query: any, user: { id?: string; full_name?: string }) {
  const columns = await getPpeRequestColumns()

  if (columns.idColumn && user?.id) {
    return query.eq(columns.idColumn, user.id)
  }

  if (columns.nameColumn && user?.full_name) {
    return query.eq(columns.nameColumn, user.full_name)
  }

  return query.eq('id', '__no_matching_identity__')
}

export async function buildPpeRequestInsert(payload: {
  crew: { id?: string; full_name?: string }
  extra?: Record<string, unknown>
}) {
  const columns = await getPpeRequestColumns()
  const row: Record<string, unknown> = { ...(payload.extra || {}) }

  if (columns.idColumn && payload.crew?.id) {
    row[columns.idColumn] = payload.crew.id
  }

  if (columns.nameColumn && payload.crew?.full_name) {
    row[columns.nameColumn] = payload.crew.full_name
  }

  return row
}

export async function matchesPpeRequestUser(row: Record<string, any>, user: { id?: string; full_name?: string }) {
  const columns = await getPpeRequestColumns()

  if (columns.idColumn && user?.id) {
    return String(row?.[columns.idColumn] || '') === String(user.id)
  }

  if (columns.nameColumn && user?.full_name) {
    return String(row?.[columns.nameColumn] || '') === String(user.full_name)
  }

  return false
}

export async function getPpeRequestIdentity(row: Record<string, any>) {
  const columns = await getPpeRequestColumns()

  if (columns.idColumn && row?.[columns.idColumn]) {
    return String(row[columns.idColumn])
  }

  if (columns.nameColumn && row?.[columns.nameColumn]) {
    return String(row[columns.nameColumn])
  }

  return ''
}
