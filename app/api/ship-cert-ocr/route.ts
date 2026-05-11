import { NextResponse } from 'next/server'

export const runtime = 'edge'

type ShipCertOcrBody = {
  fileBase64?: string
  mimeType?: string
  extractedText?: string
  certName?: string
  code?: string
  category?: string
  pageMapHints?: Array<{
    fieldName?: string
    preferredPages?: number[]
    fallbackPages?: number[]
    extractionHint?: string
    confidence?: number | string
  }>
  analysisFocus?: 'full_certificate' | 'annual_survey'
  modelId?: string
  provider?: string
}

const parseJsonSafely = (value: string) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const getProviderErrorMessage = (responseText: string) => {
  const parsed = parseJsonSafely(responseText)
  const message = parsed?.error?.message || parsed?.message || responseText || 'AI provider request failed'
  if (/request entity too large|payload too large|content length/i.test(message)) {
    return 'AI request payload is too large. Please use a smaller PDF, split the certificate pages, or fill the fields manually.'
  }
  return String(message).slice(0, 600)
}

const extractJsonObject = (rawText: string) => {
  const cleaned = rawText
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim()
  const direct = parseJsonSafely(cleaned)
  if (direct) return direct

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`AI analysis did not return JSON. Response starts: ${cleaned.slice(0, 160)}`)
  }

  const parsed = parseJsonSafely(jsonMatch[0])
  if (!parsed) {
    throw new Error(`AI analysis returned invalid JSON. Response starts: ${cleaned.slice(0, 160)}`)
  }
  return parsed
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ShipCertOcrBody
    const { fileBase64, mimeType, extractedText, certName, code, category, pageMapHints, analysisFocus, modelId, provider } = body
    const apiKey = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY

    if ((!extractedText && (!fileBase64 || !mimeType)) || !modelId || !provider) {
      throw new Error('Missing ship certificate OCR input')
    }
    if (!apiKey) throw new Error('Missing OCR provider API key')

    const hasExtractedText = !!extractedText?.trim()
    const prompt = `You are a strict maritime vessel certificate auditor and document controller with working knowledge of IMO instruments, SOLAS, MARPOL, STCW where relevant, ISM/ISPS, MLC, flag-state statutory certificates, classification society certificates, and annual/intermediate/class survey endorsement practice.
TASK: Read the uploaded ship/vessel certificate and extract fields for the checklist item.
CHECKLIST ITEM: "${certName ? `${code || ''} ${certName}` : `NEW ${category || ''} SHIP CERTIFICATE - identify the certificate type from the uploaded file`}".
CATEGORY: "${category || ''}".
SOURCE MODE: ${hasExtractedText ? 'OCR/TEXT EXTRACTION FIRST. Use the extracted text below. Do not require vision unless the text is incomplete.' : 'VISION FALLBACK. OCR/text extraction did not provide enough readable text.'}
ANALYSIS FOCUS: ${analysisFocus === 'annual_survey' ? 'Annual/intermediate/class survey endorsement page. Prioritize handwritten/stamped endorsement dates, surveyor signatures, and next/last annual survey clues.' : 'Full certificate identification and date extraction.'}
KNOWN PAGE MEMORY FROM PREVIOUS REVIEW:
${pageMapHints?.length ? pageMapHints.map((hint) => `- ${hint.fieldName}: preferred pages ${hint.preferredPages?.join(', ') || '-'}; fallback ${hint.fallbackPages?.join(', ') || '-'}; hint: ${hint.extractionHint || '-'}`).join('\n') : '- None yet. If page numbers are visible or inferable, create page mapping from this run.'}
If page memory is provided, use it as the primary navigation guide. Treat preferred pages as the first evidence locations to inspect, fallback pages as secondary locations, and report if the uploaded file appears to use a different layout.

RULES:
1. Certificate type match must be strict when a checklist item name is provided. Do not treat a different vessel certificate as acceptable just because it is maritime related. If this is a new certificate with no checklist item name, identify the certificate type and set certTypeMatch=true when it is a genuine vessel/ship certificate.
2. Use maritime regulatory context to interpret equivalent names:
   - Flag/statutory examples: Certificate of Registry, Minimum Safe Manning, Safety Radio, Safety Equipment, Load Line, IOPP, Sewage, IAPP, Civil Liability, Maritime Labour, DOC/SMC/ISSC where applicable.
   - Class examples: Classification Certificate, Hull/Machinery, Load Line class endorsements, annual/intermediate/special survey endorsements.
   - GMDSS/LSA/FFE documents may include equipment lists, service certificates, inspection certificates, or shore-based maintenance certificates.
3. Do not approve a lower-level or unrelated document for a higher/specific checklist item. If uncertain, certTypeMatch=false and explain why.
4. Convert all dates to YYYY-MM-DD. Convert Thai Buddhist years to CE.
5. Act as an expert document controller, not just an OCR reader. If the certificate does not explicitly print a due/expiry date, infer the expected renewal/survey interval from the certificate type, IMO/SOLAS/MARPOL/ISM/ISPS/MLC context, flag/class practice, and marine service certificate norms. The uploader can edit later, so provide your best professional estimate rather than leaving common intervals blank.
6. For class/statutory certificates, annual/intermediate survey endorsement dates may appear on later pages. Extract the latest annual/intermediate/class survey endorsement date when visible. If the provided page is an annual survey endorsement page, focus on handwritten/stamped endorsement dates even if the handwriting is imperfect.
7. Use these expert interval guidelines when the document itself is silent:
   - Annual service/inspection/test certificates in FFE, LSA, or GMDSS: surveyIntervalMonths=12 and nextSurveyDate/expiryDate = one day before the same date next year.
   - Fixed firefighting systems, fixed foam systems, fire detection/alarm, portable fire extinguisher inspection, EEBD/SCBA/medical oxygen cylinder service: usually annual inspection/service unless the certificate states a longer hydrostatic interval.
   - Hydrostatic pressure test certificates for cylinders/CO2/SCBA/EEBD/fire extinguishers: often 60 months unless the document or local rule states otherwise.
   - Life raft/service station inspection: usually annual service.
   - EPIRB/SART/AIS/SSAS/GMDSS annual radio test: usually annual.
   - Class/statutory certificates with 5-year validity and annual endorsements: expiryIntervalMonths=60, surveyIntervalMonths=12, nextSurveyDate should follow the annual endorsement/anniversary window when derivable.
8. If you infer any interval/date rather than reading it directly, clearly state that in ruleBasis and note.
9. If genuinely impossible to infer a common maritime interval, leave date empty but still explain why in ruleBasis.
10. If the uploaded document clearly does not match the selected checklist item, set certTypeMatch=false.
11. Build a pageMap for future cost-saving reads. For each important field, identify the page number(s) where the evidence appears or is most likely found. If exact page numbers are not printed, estimate from document order and keep confidence lower. Use 1-based page numbers.
12. pageMap keys should include only relevant known fields: cert_name, certificate_number, issue_by, issued_date, expiry_date, last_survey_date, next_survey_date, annual_survey_endorsement.

Return ONLY raw JSON:
{"issueBy":"issuer/class/authority or empty","issuedDate":"YYYY-MM-DD or empty","expiryDate":"YYYY-MM-DD or empty","lastSurveyDate":"YYYY-MM-DD or empty","nextSurveyDate":"YYYY-MM-DD or empty","surveyIntervalMonths":12,"expiryIntervalMonths":12,"ruleBasis":"short rule/regulatory/practice basis used, or empty","detectedCertName":"text","certificateNumber":"text or empty","certTypeMatch":true,"note":"short English reasoning","pageMap":{"issued_date":{"pages":[1],"confidence":0.8,"hint":"issued date on certificate face page"},"expiry_date":{"pages":[1],"confidence":0.8,"hint":"valid until on certificate face page"},"last_survey_date":{"pages":[3,4],"confidence":0.6,"hint":"latest annual/class endorsement page"}}}

${hasExtractedText ? `EXTRACTED TEXT:\n${extractedText?.slice(0, 18000)}` : ''}`

    const cleanBase64 = fileBase64?.includes(',') ? fileBase64.split(',')[1] : fileBase64
    let response: Response

    if (provider === 'openrouter') {
      const content = hasExtractedText
        ? prompt
        : [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${cleanBase64}` } },
          ]

      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content }],
        }),
      })
    } else {
      const parts = hasExtractedText
        ? [{ text: prompt }]
        : [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: cleanBase64 } },
          ]

      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      })
    }

    const responseText = await response.text()
    if (!response.ok) {
      throw new Error(getProviderErrorMessage(responseText))
    }

    const data = parseJsonSafely(responseText)
    if (!data) {
      throw new Error(`AI provider returned non-JSON response. Response starts: ${responseText.slice(0, 160)}`)
    }

    const rawText = provider === 'openrouter'
      ? data.choices?.[0]?.message?.content
      : data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) throw new Error('AI provider returned empty content')

    const parsedResult = extractJsonObject(String(rawText))

    return NextResponse.json({
      ...parsedResult,
      analysisMode: hasExtractedText ? 'text' : 'vision',
      activeModel: modelId,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ship certificate OCR failed' }, { status: 500 })
  }
}
