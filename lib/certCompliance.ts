import { isNoExpiryDate } from '@/lib/certificates'

const normalize = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()

export function calculateCrewCertificateCompliance({
  crew,
  crewCerts,
  matrix,
  rules,
}: {
  crew: any
  crewCerts: any[]
  matrix: any[]
  rules?: any[]
}) {
  if (!matrix.length) return { progress: 0, ok: 0, expired: 0, warning: 0, missing: 0, mandatoryTotal: 0, list: [] as any[] }

  const crewPosition = normalize(crew?.position)
  const required = matrix
    .filter((row) => normalize(row.position) === crewPosition && (row.requirement_type === 'P' || row.requirement_type === 'O'))
    .map((row) => ({ ...row, is_mandatory: row.requirement_type === 'P' }))

  ;(rules || []).forEach((rule) => {
    const hasTriggerCert = crewCerts.some((cert) => normalize(cert.cert_name) === normalize(rule.trigger_cert))
    if (!hasTriggerCert) return

    const index = required.findIndex((req) => normalize(req.cert_name) === normalize(rule.required_cert))
    if (index === -1) {
      const info = matrix.find((row) => normalize(row.cert_name) === normalize(rule.required_cert))
      required.push({ cert_name: rule.required_cert, is_mandatory: true, category: info?.category || 'Additional' })
    } else {
      required[index].is_mandatory = true
    }
  })

  const today = new Date()
  let ok = 0
  let expired = 0
  let warning = 0
  let missing = 0
  let mandatoryTotal = 0

  const list = required.map((req) => {
    if (req.is_mandatory) mandatoryTotal += 1

    const uploaded = crewCerts.find((cert) => normalize(cert.cert_name) === normalize(req.cert_name))
    let status = req.is_mandatory ? 'missing' : 'optional'
    let daysLeft = -1

    if (uploaded) {
      if (isNoExpiryDate(uploaded.expiry_date)) {
        status = 'ok'
        ok += 1
        daysLeft = 9999
      } else {
        const expiryDate = new Date(uploaded.expiry_date)
        daysLeft = Math.floor((expiryDate.getTime() - today.getTime()) / 86400000)
        if (daysLeft < 0) {
          status = 'expired'
          expired += 1
        } else if (daysLeft <= 90) {
          status = 'warning'
          warning += 1
          ok += 1
        } else {
          status = 'ok'
          ok += 1
        }
      }
    } else if (req.is_mandatory) {
      missing += 1
    }

    return { ...req, uploaded, status, daysLeft }
  }).sort((a, b) => {
    const weight: Record<string, number> = { expired: 1, missing: 2, warning: 3, ok: 4, optional: 5 }
    return (weight[a.status] || 99) - (weight[b.status] || 99)
  })

  return {
    list,
    progress: mandatoryTotal > 0 ? Math.round((ok / mandatoryTotal) * 100) : 0,
    ok,
    expired,
    warning,
    missing,
    mandatoryTotal,
  }
}
