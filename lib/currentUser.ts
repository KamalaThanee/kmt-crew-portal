export type CurrentUser = {
  id?: string
  full_name?: string
  position?: string
  [key: string]: unknown
}

export const KMT_USER_STORAGE_KEY = 'kmt_user'
export const KMT_USER_CHANGED_EVENT = 'kmt-user-changed'

export function readCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null

  try {
    const storedUser = window.localStorage.getItem(KMT_USER_STORAGE_KEY)
    return storedUser ? (JSON.parse(storedUser) as CurrentUser) : null
  } catch {
    window.localStorage.removeItem(KMT_USER_STORAGE_KEY)
    return null
  }
}

export function clearCurrentUser() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(KMT_USER_STORAGE_KEY)
  window.dispatchEvent(new Event(KMT_USER_CHANGED_EVENT))
}
