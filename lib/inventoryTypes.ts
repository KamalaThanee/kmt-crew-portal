export type InventoryItem = {
  id?: string | number
  item_id_code?: string | null
  item_name?: string | null
  category?: string | null
  color?: string | null
  size?: string | null
  quantity?: number | string | null
  threshold?: number | string | null
  unit?: string | null
  [key: string]: unknown
}

export type RestockEntryRow = {
  id: number
  product_key: string
  color: string
  size: string
  inventory_id: string
  qty: string
}

export type RestockLine = {
  id?: string
  item_name?: string | null
  color?: string | null
  size?: string | null
  quantity_added?: number | string | null
  [key: string]: unknown
}

export type RestockBatch = {
  id: string
  do_number?: string | null
  created_at?: string | null
  added_by?: string | null
  receipt_url?: string | null
  totalQty?: number | string | null
  lines: RestockLine[]
}

export type StockTransaction = {
  id?: string
  movement_type?: string | null
  created_at?: string | null
  item_name?: string | null
  color?: string | null
  size?: string | null
  crew_name?: string | null
  actor_name?: string | null
  note?: string | null
  quantity_delta?: number | string | null
}
