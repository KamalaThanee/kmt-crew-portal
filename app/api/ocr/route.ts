import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType, certName, crewName, modelId, provider } = body;
    
    const apiKey = provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: `Missing ${provider} API Key` }, { status: 400 });
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const prompt = `Analyze this certificate for "${crewName}". Target Cert: "${certName}".
    Return ONLY a raw JSON object (no markdown).
    Format: {"issueDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD", "personNameMatch": true, "certTypeMatch": true, "note": "explain"}
    If no expiry date is found, use "2099-12-31". Convert Thai years to CE.`;

    let response;

    if (provider === "openrouter") {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${apiKey}`, 
          "Content-Type": "application/json", 
          "HTTP-Referer": "https://kmt-portal.vercel.app", 
          "X-Title": "KMT Crew Portal" 
        },
        body: JSON.stringify({ 
          model: modelId, 
          messages: [{ 
            role: "user", 
            content: [
              { type: "text", text: prompt }, 
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${cleanBase64}` } }
            ] 
          }] 
        })
      });
    } else {
      const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ 
            parts: [
              { text: prompt }, 
              { inline_data: { mime_type: mimeType, data: cleanBase64 } }
            ] 
          }],
          generationConfig: { temperature: 0.1, topK: 32, topP: 1 }
        })
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Upstream Error ${response.status}: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    const rawText = provider === "openrouter" ? data.choices?.[0]?.message?.content : data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Invalid AI JSON format: " + rawText }, { status: 500 });
    
    return NextResponse.json({ ...JSON.parse(jsonMatch[0]), activeModel: modelId });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
