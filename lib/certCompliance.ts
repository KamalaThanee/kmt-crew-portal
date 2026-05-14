import { isNoExpiryDate } from '@/lib/certificates'

const normalize = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()

export function calculateCrewCertificateCompliance({
  certMaster,
  crew,
  crewCerts,
  matrix,
  rules,
}: {
  certMaster?: any[]
  crew: any
  crewCerts: any[]
  matrix: any[]
  rules?: any[]
}) {
  if (!matrix.length) return { progress: 0, ok: 0, expired: 0, warning: 0, missing: 0, mandatoryTotal: 0, list: [] as any[] }

  const crewPosition = normalize(crew?.position)
  const masterByCert = new Map((certMaster || []).map((row) => [normalize(row.cert_name), row]))
  const required = matrix
    .filter((row) => normalize(row.position) === crewPosition && (row.requirement_type === 'P' || row.requirement_type === 'O'))
    .map((row) => ({ ...row, ...(masterByCert.get(normalize(row.cert_name)) || {}), is_mandatory: row.requirement_type === 'P' }))

  ;(rules || []).forEach((rule) => {
    const hasTriggerCert = crewCerts.some((cert) => normalize(cert.cert_name) === normalize(rule.trigger_cert))
    if (!hasTriggerCert) return

    const index = required.findIndex((req) => normalize(req.cert_name) === normalize(rule.required_cert))
    if (index === -1) {
      const info = matrix.find((row) => normalize(row.cert_name) === normalize(rule.required_cert))
      const masterInfo = masterByCert.get(normalize(rule.required_cert))
      required.push({ ...info, ...masterInfo, cert_name: rule.required_cert, is_mandatory: true, cert_family: masterInfo?.cert_family || info?.category || 'Additional' })
    } else {
      required[index].is_mandatory = true
    }
  })

  const relationshipByCert = new Map<string, { requiredCerts: string[]; triggerCerts: string[]; relationKey: string }>()
  ;(rules || []).forEach((rule) => {
    const triggerKey = normalize(rule.trigger_cert)
    const requiredKey = normalize(rule.required_cert)
    if (!triggerKey || !requiredKey) return
    const triggerRelation = relationshipByCert.get(triggerKey) || { requiredCerts: [], triggerCerts: [], relationKey: triggerKey }
    if (!triggerRelation.requiredCerts.some((cert) => normalize(cert) === requiredKey)) triggerRelation.requiredCerts.push(rule.required_cert)
    triggerRelation.relationKey = `${triggerKey}:${triggerRelation.requiredCerts.map(normalize).sort().join(':')}`
    relationshipByCert.set(triggerKey, triggerRelation)

    const requiredRelation = relationshipByCert.get(requiredKey) || { requiredCerts: [], triggerCerts: [], relationKey: requiredKey }
    if (!requiredRelation.triggerCerts.some((cert) => normalize(cert) === triggerKey)) requiredRelation.triggerCerts.push(rule.trigger_cert)
    requiredRelation.relationKey = `${requiredRelation.triggerCerts.map(normalize).sort().join(':')}:${requiredKey}`
    relationshipByCert.set(requiredKey, requiredRelation)
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

    const relationship = relationshipByCert.get(normalize(req.cert_name))
    const requiredCert = relationship?.requiredCerts?.[0]
    const triggerCert = relationship?.triggerCerts?.[0]

    return { ...req, ...relationship, requiredCert, triggerCert, uploaded, status, daysLeft }
  }).sort((a, b) => {
    const weight: Record<string, number> = { expired: 1, missing: 2, warning: 3, ok: 4, optional: 5 }
    const categorySort = categoryWeight(a.cert_family || a.category) - categoryWeight(b.cert_family || b.category)
    if (categorySort !== 0) return categorySort
    const orderSort = Number(a.cv_order || 999) - Number(b.cv_order || 999)
    if (orderSort !== 0) return orderSort
    const relationSort = String(a.relationKey || a.cert_name || '').localeCompare(String(b.relationKey || b.cert_name || ''))
    if (relationSort !== 0) return relationSort
    const statusSort = (weight[a.status] || 99) - (weight[b.status] || 99)
    if (statusSort !== 0) return statusSort
    return String(a.cert_name || '').localeCompare(String(b.cert_name || ''))
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

function categoryWeight(value: unknown) {
  const category = normalize(value)
  if (category === 'stcw') return 1
  if (category === 'offshore') return 2
  if (category === 'medical') return 3
  if (category === 'personaldocument') return 4
  if (category === 'other') return 5
  if (category === 'additional') return 6
  return 9
}
