import { NextResponse } from 'next/server'

export const runtime = 'edge'

type SmsHeaderAiBody = {
  fileBase64?: string
  mimeType?: string
  extractedText?: string
  fileName?: string
  category?: string
  pageNumber?: number
  modelId?: string
  provider?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SmsHeaderAiBody
    const { fileBase64, mimeType, extractedText, fileName, category, pageNumber, modelId, provider } = body
    const apiKey = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY
    if (!apiKey || !modelId || !provider) throw new Error('Missing SMS AI provider configuration')
    if (!extractedText?.trim() && (!fileBase64 || !mimeType)) throw new Error('Missing SMS header AI input')

    const mode = extractedText?.trim() ? 'TEXT_EXTRACTION' : 'VISION_PAGE'
    const prompt = `You are a strict document controller for a maritime Safety Management System (SMS).
Read only the document header/table and extract the controlled-document fields.

DOCUMENT TYPE: ${category || 'Unknown'}.
FILE NAME: ${fileName || '-'}.
TARGET PAGE: ${pageNumber || (category === 'Procedure' || category === 'Support Document' ? 2 : 1)}.
MODE: ${mode}.

Rules:
1. Return ONLY raw JSON. No markdown.
2. Extract these exact fields: title, revision, effectiveDate, docNo.
3. Revision must be normalized as Rev.XX, e.g. "01" => "Rev.01". If cells are split like "0 1", combine to "01".
4. Effective date must be YYYY-MM-DD. If cells are split like "1 0 August 2021", combine to "10 August 2021".
5. Document number must preserve category identity. If category is Procedure and document number is "2", return "Procedure 2". If category is Checklist and document number is "11.105" or split as "11. 10 5", return "11.105". If category is Support Document and document number is "OFSPV-HB" or "HB-2026-01", preserve that code exactly.
6. Use the file name as a fallback only for docNo/title when the header is unreadable. Do not invent revision/effectiveDate.
7. confidence is 0 to 1. Set needsReview true when any field is missing or uncertain.

Return JSON shape:
{"docNo":"Procedure 2, 11.105, OFSPV-HB, HB-2026-01, or empty","title":"text or empty","revision":"Rev.01 or empty","effectiveDate":"YYYY-MM-DD or empty","confidence":0.8,"needsReview":false,"note":"short reason"}

${extractedText?.trim() ? `EXTRACTED TEXT:\n${extractedText.slice(0, 16000)}` : ''}`

    const cleanBase64 = fileBase64?.includes(',') ? fileBase64.split(',')[1] : fileBase64
    let response: Response

    if (provider === 'openrouter') {
      const content = extractedText?.trim()
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
      const parts = extractedText?.trim()
        ? [{ text: prompt }]
        : [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: cleanBase64 } },
          ]

      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      let message = errorText || 'SMS AI provider request failed'
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
    if (!rawText) throw new Error('SMS AI returned empty content')

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('SMS AI did not return JSON')

    return NextResponse.json({
      ...JSON.parse(jsonMatch[0]),
      activeModel: modelId,
      analysisMode: mode === 'VISION_PAGE' ? 'vision' : 'text',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'SMS header AI failed' }, { status: 500 })
  }
}
