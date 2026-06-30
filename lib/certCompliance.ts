import {
  getBasicSafetyComponentDefinitions,
  isBasicSafetyParentName,
  isBasicSafetyRefresherName,
  isNoExpiryDate,
} from '@/lib/certificates'

const normalize = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()
const normalizeRequirementType = (value: unknown) => String(value || '').trim().toUpperCase()

function evaluateCertStatus(uploaded: any, today: Date) {
  if (!uploaded) return { status: 'missing', daysLeft: -1 }

  if (isNoExpiryDate(uploaded.expiry_date)) {
    return { status: 'ok', daysLeft: 9999 }
  }

  const expiryDate = new Date(uploaded.expiry_date)
  const daysLeft = Math.floor((expiryDate.getTime() - today.getTime()) / 86400000)
  if (daysLeft < 0) return { status: 'expired', daysLeft }
  if (daysLeft <= 90) return { status: 'warning', daysLeft }
  return { status: 'ok', daysLeft }
}

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
    .filter((row) => {
      const requirementType = normalizeRequirementType(row.requirement_type)
      return normalize(row.position) === crewPosition && (requirementType === 'P' || requirementType === 'O')
    })
    .map((row) => {
      const requirementType = normalizeRequirementType(row.requirement_type)
      return { ...row, ...(masterByCert.get(normalize(row.cert_name)) || {}), requirement_type: requirementType, is_mandatory: requirementType === 'P' }
    })

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

    const directUploaded = crewCerts.find((cert) => normalize(cert.cert_name) === normalize(req.cert_name))
    let status = req.is_mandatory ? 'missing' : 'optional'
    let daysLeft = -1
    let uploaded = directUploaded
    let basicSafetyChildren: any[] = []
    let satisfiedByRefresher = false

    if (isBasicSafetyParentName(req.cert_name)) {
      const refresherUploaded = crewCerts.find((cert) => isBasicSafetyRefresherName(cert.cert_name))
      const parentFallbackUploaded = directUploaded
      const refresherCertName =
        required.find((row) => isBasicSafetyRefresherName(row.cert_name))?.cert_name ||
        refresherUploaded?.cert_name ||
        'Basic Safety Training ( 4 Basic COP )'
      const refresherState = evaluateCertStatus(refresherUploaded, today)
      const refresherChild = {
        cert_name: refresherCertName,
        uploaded: refresherUploaded,
        status: refresherUploaded ? refresherState.status : 'missing',
        daysLeft: refresherUploaded ? refresherState.daysLeft : -1,
        cert_family: req.cert_family || req.category,
        relationKind: 'proficiency',
        triggerCert: req.cert_name,
        virtualRelated: !refresherUploaded,
      }

      const componentRows = getBasicSafetyComponentDefinitions().map((definition) => {
        const componentUploaded = crewCerts.find((cert) =>
          definition.aliases.some((alias) => normalize(alias) === normalize(cert.cert_name)),
        )
        const componentState = evaluateCertStatus(componentUploaded, today)
        return {
          cert_name: definition.displayName,
          uploaded: componentUploaded,
          status: componentUploaded ? componentState.status : 'missing',
          daysLeft: componentUploaded ? componentState.daysLeft : -1,
          cert_family: req.cert_family || req.category,
          relationKind: 'requirement',
          triggerCert: req.cert_name,
          virtualRelated: !componentUploaded,
        }
      })

      basicSafetyChildren = [refresherChild, ...componentRows]
      const validComponentRows = componentRows.filter((row) => row.status === 'ok' || row.status === 'warning')
      const allComponentsPresent = componentRows.every((row) => row.uploaded)
      const allComponentsValid = componentRows.every((row) => row.status === 'ok' || row.status === 'warning')
      const anyComponentExpired = componentRows.some((row) => row.status === 'expired')
      const anyComponentWarning = componentRows.some((row) => row.status === 'warning')
      const missingComponentCount = componentRows.filter((row) => row.status === 'missing').length

      if (refresherUploaded) {
        uploaded = refresherUploaded
        satisfiedByRefresher = refresherState.status === 'ok' || refresherState.status === 'warning'
        status = refresherState.status
        daysLeft = refresherState.daysLeft
      } else if (parentFallbackUploaded) {
        const parentState = evaluateCertStatus(parentFallbackUploaded, today)
        uploaded = parentFallbackUploaded
        satisfiedByRefresher = true
        status = parentState.status
        daysLeft = parentState.daysLeft
      } else if (allComponentsValid) {
        status = anyComponentWarning ? 'warning' : 'ok'
        daysLeft = validComponentRows.reduce((lowest, row) => Math.min(lowest, row.daysLeft), 9999)
      } else if (anyComponentExpired) {
        status = 'expired'
      } else if (allComponentsPresent && !allComponentsValid) {
        status = 'expired'
      } else if (missingComponentCount < componentRows.length && anyComponentWarning) {
        status = 'warning'
        daysLeft = validComponentRows.reduce((lowest, row) => Math.min(lowest, row.daysLeft), 9999)
      } else if (req.is_mandatory) {
        status = 'missing'
      }

      if (status === 'ok') ok += 1
      else if (status === 'warning') {
        warning += 1
        ok += 1
      } else if (status === 'expired') expired += 1
      else if (req.is_mandatory) missing += 1
    } else if (uploaded) {
      const state = evaluateCertStatus(uploaded, today)
      status = state.status
      daysLeft = state.daysLeft
      if (status === 'ok') ok += 1
      else if (status === 'warning') {
        warning += 1
        ok += 1
      } else if (status === 'expired') expired += 1
    } else if (req.is_mandatory) {
      missing += 1
    }

    const relationship = relationshipByCert.get(normalize(req.cert_name))
    const requiredCert = basicSafetyChildren.length > 0 ? undefined : relationship?.requiredCerts?.[0]
    const triggerCert = relationship?.triggerCerts?.[0]
    const requiredCerts = basicSafetyChildren.length > 0
      ? basicSafetyChildren.map((child) => child.cert_name)
      : relationship?.requiredCerts

    return {
      ...req,
      ...relationship,
      requiredCert,
      requiredCerts,
      triggerCert,
      uploaded,
      status,
      daysLeft,
      basicSafetyChildren,
      satisfiedByRefresher,
    }
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

  const basicSafetyVirtualChildren = list.flatMap((row) => {
    if (!Array.isArray(row.basicSafetyChildren)) return []
    if (isBasicSafetyParentName(row.cert_name) && (row.uploaded || row.satisfiedByRefresher)) {
      return row.basicSafetyChildren.filter((child: any) => child.relationKind !== 'requirement')
    }
    return row.basicSafetyChildren
  })

  const hasBasicSafetyParent = list.some((row) => isBasicSafetyParentName(row.cert_name))
  const visibleTopLevelRows = hasBasicSafetyParent
    ? list.filter((row) => !isBasicSafetyRefresherName(row.cert_name))
    : list

  const finalList = [...visibleTopLevelRows, ...basicSafetyVirtualChildren]

  const mandatoryParentNames = new Set(list.filter((row) => row.is_mandatory).map((row) => normalize(row.cert_name)))
  const mandatoryRows = finalList.filter((row) => {
    if (row.is_mandatory) return true
    if (row.triggerCert && mandatoryParentNames.has(normalize(row.triggerCert))) return true
    return false
  })
  const countedOk = mandatoryRows.filter((row) => row.status === 'ok' || row.status === 'warning').length
  const countedWarning = mandatoryRows.filter((row) => row.status === 'warning').length
  const countedExpired = mandatoryRows.filter((row) => row.status === 'expired').length
  const countedMissing = mandatoryRows.filter((row) => row.status === 'missing').length
  const countedMandatoryTotal = mandatoryRows.length

  return {
    list: finalList,
    progress: countedMandatoryTotal > 0 ? Math.round((countedOk / countedMandatoryTotal) * 100) : 0,
    ok: countedOk,
    expired: countedExpired,
    warning: countedWarning,
    missing: countedMissing,
    mandatoryTotal: countedMandatoryTotal,
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
