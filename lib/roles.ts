const ADMIN_ROLES = ['safety officer', 'chief officer', 'barge master']

export function normalizeRole(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function isAdminRole(value: unknown) {
  return ADMIN_ROLES.includes(normalizeRole(value))
}

export { ADMIN_ROLES }
