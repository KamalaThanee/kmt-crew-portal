import { NextResponse } from 'next/server'

export const runtime = 'edge'

type ShipCertOcrBody = {
  fileBase64?: string
  mimeType?: string
  certName?: string
  code?: string
  category?: string
  modelId?: string
  provider?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ShipCertOcrBody
    const { fileBase64, mimeType, certName, code, category, modelId, provider } = body
    const apiKey = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY

    if (!fileBase64 || !mimeType || !certName || !modelId || !provider) {
      throw new Error('Missing ship certificate OCR input')
    }
    if (!apiKey) throw new Error('Missing OCR provider API key')

    const prompt = `You are a strict maritime vessel certificate auditor.
TASK: Read the uploaded ship/vessel certificate and extract fields for the checklist item.
CHECKLIST ITEM: "${code || ''} ${certName}".
CATEGORY: "${category || ''}".

RULES:
1. Certificate type match must be strict. Do not treat a different vessel certificate as acceptable just because it is maritime related.
2. Convert all dates to YYYY-MM-DD. Convert Thai Buddhist years to CE.
3. For class/statutory certificates, annual/intermediate survey endorsement dates may appear on later pages. Extract the latest annual/intermediate/class survey endorsement date when visible.
4. If a field is not visible, return an empty string. Do not invent dates.
5. If the uploaded document clearly does not match the selected checklist item, set certTypeMatch=false.

Return ONLY raw JSON:
{"issueBy":"issuer/class/authority or empty","issuedDate":"YYYY-MM-DD or empty","expiryDate":"YYYY-MM-DD or empty","lastSurveyDate":"YYYY-MM-DD or empty","nextSurveyDate":"YYYY-MM-DD or empty","detectedCertName":"text","certificateNumber":"text or empty","certTypeMatch":true,"note":"short English reasoning"}`

    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64
    let response: Response

    if (provider === 'openrouter') {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: cleanBase64 } },
              ],
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
    const rawText = provider === 'openrouter'
      ? data.choices?.[0]?.message?.content
      : data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) throw new Error('AI provider returned empty content')

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI analysis did not return JSON')

    return NextResponse.json({
      ...JSON.parse(jsonMatch[0]),
      activeModel: modelId,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ship certificate OCR failed' }, { status: 500 })
  }
}
