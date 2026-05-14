const ADMIN_ROLES = ['safety officer', 'chief officer', 'barge master']
const SHIP_CERTIFICATE_VIEWER_ROLES = [...ADMIN_ROLES, 'radio operator', 'chief engineer']
const SMS_LIBRARY_MANAGER_ROLES = [...ADMIN_ROLES, 'radio operator', 'chief engineer']
const MONTHLY_REPORT_MANAGER_ROLES = [...ADMIN_ROLES, 'radio operator', 'chief engineer']

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

export function canManageSmsLibrary(value: unknown) {
  return SMS_LIBRARY_MANAGER_ROLES.includes(normalizeRole(value))
}

export function canManageMonthlyReports(value: unknown) {
  return MONTHLY_REPORT_MANAGER_ROLES.includes(normalizeRole(value))
}

export { ADMIN_ROLES, SHIP_CERTIFICATE_VIEWER_ROLES, SMS_LIBRARY_MANAGER_ROLES, MONTHLY_REPORT_MANAGER_ROLES }
