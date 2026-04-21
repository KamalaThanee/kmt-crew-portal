import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType, certName, crewName, modelId, provider } = body;
    const apiKey = provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY;
    
    // 🎯 Prompt ใหม่: เน้นการวิเคราะห์เชิงลึกแบบ Auditor
    const prompt = `You are a maritime safety auditor.
    TASK: Determine if the uploaded document satisfies the requirement for "${certName}".
    USER IDENTITY: "${crewName}".

    AUDIT RULES:
    1. NAME MATCH: Be flexible with titles (Mr, Capt) and middle names. If the core name matches, personNameMatch = true.
    2. CERT TYPE MATCH: DO NOT look for exact string matches. Analyze the CONTENT.
       - Example: "DGR Course for Offshore" satisfies "Dangerous Goods Regulations Training".
       - Example: "Basic Fire Fighting" satisfies "Advance Fire" only if the content shows advanced modules (use your knowledge).
       - Training providers often use different titles for the same regulatory requirement (STCW/OPITO). If it serves the same purpose, certTypeMatch = true.
    3. DATE: Convert Thai years to CE. If no expiry, use "2099-12-31".

    Return ONLY raw JSON:
    {"issueDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD", "personNameMatch": true, "certTypeMatch": true, "note": "Explain your reasoning briefly in English."}`;

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

    const data = await response.json();
    const rawText = provider === "openrouter" ? data.choices?.[0]?.message?.content : data.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI Analysis Error");
    
    return NextResponse.json({ ...JSON.parse(jsonMatch[0]), activeModel: modelId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
