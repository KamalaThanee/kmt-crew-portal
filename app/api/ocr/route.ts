import { NextResponse } from 'next/server'
import { auditCertTypeMatch, NO_EXPIRY_DATE, parseBooleanLike, parseThaiDateEvidence, resolveExpiryDate } from '@/lib/certificates'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { imageBase64, mimeType, certName, crewName, modelId, provider, refreshYears, noExpiry } = body
    const apiKey = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('Missing OCR provider API key')

    const prompt = `You are a strict maritime certificate auditor with STCW 2010 awareness and Thai maritime/workplace safety compliance awareness.
TASK: Determine if the uploaded document satisfies the requirement for "${certName}".
USER IDENTITY: "${crewName}".

AUDIT RULES:
1. NAME MATCH: Be flexible only with titles (Mr, Capt) and harmless spacing/order differences. If the core person name is different or missing, personNameMatch = false.
2. CERT TYPE MATCH: Be strict. The uploaded certificate must satisfy the selected requirement, not just be vaguely related.
   - Advanced/Advance Fire Fighting requires advanced fire fighting evidence. Basic Fire Fighting is NOT acceptable for Advance Fire.
   - Safety Officer Training requires a safety officer/supervisor certificate. Generic Basic Offshore Safety Training, BOSIET, FOET, or general safety induction is NOT acceptable.
   - BOSIET/FOET can satisfy "Basic Offshore Safety Training / Further Offshore Training" only when the document title/content explicitly indicates BOSIET, FOET, Basic Offshore Safety, or Further Offshore Training.
   - Use maritime/STCW compliance knowledge, but reject when unsure. Do not approve a lower-level certificate for a higher-level requirement.
3. DATE: Convert Thai years to CE. Thai Buddhist year 2568 = 2025. Thai digits ๐๑๒๓๔๕๖๗๘๙ must be read as 0123456789.
   - For Thai training certificates, do NOT use the training period/range as issue date.
   - Prefer the actual certificate issuance line such as "ให้ไว้ ณ วันที่ ..." or the final awarded/issued date.
   - If the only visible dates are attendance/training dates such as "ระหว่างวันที่ 7-8 ..." then issueDate must be empty until the real issue line is identified.
   - issueDateEvidence and expiryDateEvidence must quote the exact original text used for each date. If you cannot quote it exactly, leave the related date empty.
   - If the document does not clearly show an expiry date, return expiryDate as an empty string. Only use "2099-12-31" when the certificate explicitly states it never expires.
4. CV CERTIFICATE FIELDS: Extract these fields when visible:
   - certNumber: certificate number / document number / license number.
   - placeOfIssue: for training certificates, prefer the training institute / training center / school / provider name. For licenses, passports, medicals, and authority documents use place of issue or issuing place. If only a country/city is shown, use that.
   - issueAuthority: issuing authority / administration / training center / school / hospital / class society.
   If a field is not clearly visible, return an empty string.
5. CERTIFICATE OF COMPETENCY FIELDS: If the uploaded document is a Certificate of Competency / COC / license-style competency certificate, extract:
   - competencyTitle: the competency grade/title ONLY, such as "Master", "Chief Mate", "Officer in Charge of an Engineering Watch". Do not include tonnage / kW / near coastal / ship size wording here unless it is truly part of the grade title.
   - competencyCapacity: the capacity / limitation / scope wording, such as "3,000 gross tonnage or more", "500 gross tonnage or more", "750 kW propulsion power or more", or "near coastal voyage". If the document combines the title and capacity on one line, split them into title vs capacity.
   If it is not a competency certificate, return empty strings for both fields.
6. PASSPORT CV FIELDS: If the selected requirement or uploaded document is a passport, extract CV profile fields from the passport page:
   - nationalIdNo: national identification / personal number if clearly printed. Do not use the passport number unless it is explicitly labeled as national ID / personal no.
   - nationality: nationality text exactly as shown, normalized to English when obvious.
   - dateOfBirth: date of birth as YYYY-MM-DD.
   - placeOfBirth: place of birth exactly as shown.
   If a field is not clearly visible, return an empty string for that field.

Return ONLY raw JSON:
{"issueDate":"YYYY-MM-DD or empty","issueDateEvidence":"original document text for issue date or empty","expiryDate":"YYYY-MM-DD or empty","expiryDateEvidence":"original document text for expiry date or empty","certNumber":"text or empty","placeOfIssue":"text or empty","issueAuthority":"text or empty","competencyTitle":"text or empty","competencyCapacity":"text or empty","detectedPersonName":"text","detectedCertName":"text","personNameMatch":true,"certTypeMatch":true,"expiryFoundInDocument":true,"passportCvData":{"nationalIdNo":"text or empty","nationality":"text or empty","dateOfBirth":"YYYY-MM-DD or empty","placeOfBirth":"text or empty"},"note":"Explain your reasoning briefly in English."}`

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
    let response: Response

    if (provider === 'openrouter') {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${cleanBase64}` } },
              ],
            },
          ],
        }),
      })
    } else {
      const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: cleanBase64 } }],
            },
          ],
        }),
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'AI provider request failed')
    }

    const data = await response.json()
    const rawText =
      provider === 'openrouter' ? data.choices?.[0]?.message?.content : data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) throw new Error('AI provider returned empty content')

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI Analysis Error')

    const parsed = JSON.parse(jsonMatch[0])
    const certTypeAllowed = auditCertTypeMatch(certName, parsed.detectedCertName, parsed.note)
    const issueDateFromEvidence = parseThaiDateEvidence(parsed.issueDateEvidence)
    const expiryDateFromEvidence = parseThaiDateEvidence(parsed.expiryDateEvidence)
    const normalizedIssueDate = issueDateFromEvidence || parsed.issueDate || ''
    const normalizedExpiryDate = expiryDateFromEvidence || parsed.expiryDate || ''
    const refreshYearsNumber = Number.isFinite(Number(refreshYears)) ? Number(refreshYears) : null
    const noExpiryPolicy = parseBooleanLike(noExpiry)
    const policyOverrodeNoExpiry =
      normalizedExpiryDate === NO_EXPIRY_DATE &&
      !noExpiryPolicy &&
      !!normalizedIssueDate &&
      !!refreshYearsNumber &&
      refreshYearsNumber > 0

    const resolvedExpiryDate = resolveExpiryDate({
      issueDate: normalizedIssueDate,
      expiryDate: normalizedExpiryDate,
      refreshYears: refreshYearsNumber,
      noExpiry: noExpiryPolicy,
    })

    return NextResponse.json({
      ...parsed,
      issueDate: normalizedIssueDate,
      certTypeMatch: Boolean(parsed.certTypeMatch) && certTypeAllowed,
      expiryDate: resolvedExpiryDate,
      expiryFoundInDocument: policyOverrodeNoExpiry ? false : parsed.expiryFoundInDocument,
      expiryDerivedFromPolicy: (!parsed.expiryDate || policyOverrodeNoExpiry) && !!resolvedExpiryDate,
      activeModel: modelId,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
