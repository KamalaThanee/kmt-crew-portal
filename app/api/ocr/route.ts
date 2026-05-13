import { NextResponse } from 'next/server';
import { auditCertTypeMatch, NO_EXPIRY_DATE, parseBooleanLike, resolveExpiryDate } from '@/lib/certificates';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType, certName, crewName, modelId, provider, refreshYears, noExpiry } = body;
    const apiKey = provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing OCR provider API key");
    
    // 🎯 Prompt ใหม่: เน้นการวิเคราะห์เชิงลึกแบบ Auditor
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
    3. DATE: Convert Thai years to CE. If the document does not clearly show an expiry date, return expiryDate as an empty string. Only use "2099-12-31" when the certificate explicitly states it never expires.
    4. PASSPORT CV FIELDS: If the selected requirement or uploaded document is a passport, extract CV profile fields from the passport page:
       - nationalIdNo: national identification / personal number if clearly printed. Do not use the passport number unless it is explicitly labeled as national ID / personal no.
       - nationality: nationality text exactly as shown, normalized to English when obvious.
       - dateOfBirth: date of birth as YYYY-MM-DD.
       - placeOfBirth: place of birth exactly as shown.
       If a field is not clearly visible, return an empty string for that field.

    Return ONLY raw JSON:
    {"issueDate": "YYYY-MM-DD or empty", "expiryDate": "YYYY-MM-DD or empty", "detectedPersonName": "text", "detectedCertName": "text", "personNameMatch": true, "certTypeMatch": true, "expiryFoundInDocument": true, "passportCvData": {"nationalIdNo": "text or empty", "nationality": "text or empty", "dateOfBirth": "YYYY-MM-DD or empty", "placeOfBirth": "text or empty"}, "note": "Explain your reasoning briefly in English."}`;

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    let response;

    if (provider === "openrouter") {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${cleanBase64}` } }] }] })
      });
    } else {
      const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: cleanBase64 } }] }] })
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "AI provider request failed");
    }

    const data = await response.json();
    const rawText = provider === "openrouter" ? data.choices?.[0]?.message?.content : data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("AI provider returned empty content");
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI Analysis Error");

    const parsed = JSON.parse(jsonMatch[0]);
    const certTypeAllowed = auditCertTypeMatch(certName, parsed.detectedCertName, parsed.note);
    const refreshYearsNumber = Number.isFinite(Number(refreshYears)) ? Number(refreshYears) : null;
    const noExpiryPolicy = parseBooleanLike(noExpiry);
    const policyOverrodeNoExpiry =
      parsed.expiryDate === NO_EXPIRY_DATE &&
      !noExpiryPolicy &&
      !!parsed.issueDate &&
      !!refreshYearsNumber &&
      refreshYearsNumber > 0;

    const resolvedExpiryDate = resolveExpiryDate({
      issueDate: parsed.issueDate,
      expiryDate: parsed.expiryDate,
      refreshYears: refreshYearsNumber,
      noExpiry: noExpiryPolicy,
    });

    return NextResponse.json({
      ...parsed,
      certTypeMatch: Boolean(parsed.certTypeMatch) && certTypeAllowed,
      expiryDate: resolvedExpiryDate,
      expiryFoundInDocument: policyOverrodeNoExpiry ? false : parsed.expiryFoundInDocument,
      expiryDerivedFromPolicy: (!parsed.expiryDate || policyOverrodeNoExpiry) && !!resolvedExpiryDate,
      activeModel: modelId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
