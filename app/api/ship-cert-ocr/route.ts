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
5. For class/statutory certificates, annual/intermediate survey endorsement dates may appear on later pages. Extract the latest annual/intermediate/class survey endorsement date when visible. If the provided page is an annual survey endorsement page, focus on handwritten/stamped endorsement dates even if the handwriting is imperfect.
6. For equipment service/inspection certificates in FFE, LSA, or GMDSS categories, apply practical vessel certificate control rules when the document gives an inspection/service/issued date but does not print an expiry/next due date:
   - Annual inspection/service/test certificates are normally due at the next annual cycle. Set expiryDate and nextSurveyDate to one day before the same date next year.
   - Examples: fixed foam test system, fire extinguisher inspection, CO2 system inspection, life raft inspection, GMDSS annual test, EPIRB/SART/AIS/SSAS annual test.
   - Mention in note that the date is rule-derived from inspection/service date.
7. For class/statutory certificates, do not invent dates unless the certificate or endorsement gives a clear window/anniversary rule. If uncertain, leave empty and explain.
8. If a field is not visible and no applicable rule above exists, return an empty string.
9. If the uploaded document clearly does not match the selected checklist item, set certTypeMatch=false.

Return ONLY raw JSON:
{"issueBy":"issuer/class/authority or empty","issuedDate":"YYYY-MM-DD or empty","expiryDate":"YYYY-MM-DD or empty","lastSurveyDate":"YYYY-MM-DD or empty","nextSurveyDate":"YYYY-MM-DD or empty","detectedCertName":"text","certificateNumber":"text or empty","certTypeMatch":true,"note":"short English reasoning"}

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
