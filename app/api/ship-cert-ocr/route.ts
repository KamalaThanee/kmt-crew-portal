import { NextResponse } from 'next/server'

export const runtime = 'edge'

type ShipCertOcrBody = {
  fileBase64?: string
  mimeType?: string
  extractedText?: string
  certName?: string
  code?: string
  category?: string
  analysisFocus?: 'full_certificate' | 'annual_survey'
  modelId?: string
  provider?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ShipCertOcrBody
    const { fileBase64, mimeType, extractedText, certName, code, category, analysisFocus, modelId, provider } = body
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

Return ONLY raw JSON:
{"issueBy":"issuer/class/authority or empty","issuedDate":"YYYY-MM-DD or empty","expiryDate":"YYYY-MM-DD or empty","lastSurveyDate":"YYYY-MM-DD or empty","nextSurveyDate":"YYYY-MM-DD or empty","surveyIntervalMonths":12,"expiryIntervalMonths":12,"ruleBasis":"short rule/regulatory/practice basis used, or empty","detectedCertName":"text","certificateNumber":"text or empty","certTypeMatch":true,"note":"short English reasoning"}

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
        }),
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      let message = errorText || 'AI provider request failed'
      try {
        const parsed = JSON.parse(errorText)
        message = parsed?.error?.message || parsed?.message || message
      } catch {
        // Keep provider text when it is not JSON.
      }
      throw new Error(message)
    }

    const data = await response.json()
    const rawText = provider === 'openrouter'
      ? data.choices?.[0]?.message?.content
      : data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) throw new Error('AI provider returned empty content')

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI analysis did not return JSON')

    return NextResponse.json({
      ...JSON.parse(jsonMatch[0]),
      analysisMode: hasExtractedText ? 'text' : 'vision',
      activeModel: modelId,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ship certificate OCR failed' }, { status: 500 })
  }
}
