import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Helper to strip markdown code blocks
function extractJson(text) {
  return text.trim().replace(/^```json\s*/, "").replace(/\s*```$/, "");
}

app.post("/extract-info", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  const prompt = `
Extract the following details from the OCR text of an Aadhaar card:
- Full Name
- Date of Birth (format: DD/MM/YYYY)
- Gender
- Aadhaar Number (12 digits)
- Full Address

Return ONLY a valid JSON object with these keys:
{
  "name": "",
  "dob": "",
  "gender": "",
  "aadhaarNumber": "",
  "address": ""
}

OCR Text:
"""
${text.trim()}
"""`.trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
          },
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const finalTextRaw = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!finalTextRaw) {
      return res.json({ result: "No result found" });
    }

    const finalText = extractJson(finalTextRaw);

    let parsedResult;
    try {
      parsedResult = JSON.parse(finalText);
    } catch (e) {
      parsedResult = finalText;
    }

    console.log("✅ Aadhaar data extraction successful.");
    res.json({ result: parsedResult });
  } catch (error) {
    console.error("❌ Gemini API error:", error.message);
    res.status(500).json({ error: "Failed to fetch from Gemini" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
