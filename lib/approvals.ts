import type { PpeRequest } from '@/lib/approvalTypes'

export const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))

export const getApprovalCrewName = (request: Partial<PpeRequest> | null | undefined) =>
  request?.crew_name || request?.requester_name || request?.full_name || 'Unknown Crew'

export const isMissingColumnError = (error: unknown, column: string) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return message.includes(column.toLowerCase()) && (message.includes('schema cache') || message.includes('column'))
}

export const isApprovedByForeignKeyError = (error: unknown) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return message.includes('approved_by_fkey') || (message.includes('approved_by') && message.includes('foreign key'))
}
