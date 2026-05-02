const ADMIN_ROLES = ['safety officer', 'chief officer', 'barge master']
const SHIP_CERTIFICATE_VIEWER_ROLES = [...ADMIN_ROLES, 'radio operator', 'chief engineer']

export function normalizeRole(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function isAdminRole(value: unknown) {
  return ADMIN_ROLES.includes(normalizeRole(value))
}

export function canViewShipCertificates(value: unknown) {
  return SHIP_CERTIFICATE_VIEWER_ROLES.includes(normalizeRole(value))
}

export { ADMIN_ROLES, SHIP_CERTIFICATE_VIEWER_ROLES }
