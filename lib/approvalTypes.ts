export type PpeRequestItem = {
  item_name?: string | null
  color?: string | null
  size?: string | null
  quantity?: number | string | null
  [key: string]: unknown
}

export type PpeRequestStatus = 'pending' | 'approved' | 'rejected' | 'received' | string

export type PpeRequest = {
  id: string
  status?: PpeRequestStatus | null
  created_at?: string | null
  crew_id?: string | null
  requester_id?: string | null
  user_id?: string | null
  crew_name?: string | null
  requester_name?: string | null
  full_name?: string | null
  reason?: string | null
  admin_remark?: string | null
  items?: PpeRequestItem[] | null
  [key: string]: unknown
}

export type PpeRequestUpdateResult = {
  data: Pick<PpeRequest, 'id' | 'status'> | null
  error: Error | { message?: string } | null
}
