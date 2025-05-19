// server/index.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import multer from "multer";
import PDFParser from "pdf2json";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

app.post("/extract-info", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: "Request body is required" });
  }

  const { docType, text } = req.body;

  if (!docType || !text) {
    return res.status(400).json({ error: "docType and text are required" });
  }

  let prompt = "";
  if (docType === "aadhaar") {
    prompt = `
    Extract the following details from the OCR text of an Aadhaar card (which may include text from both front and back sides):

    * Full Name (look for "Name", "नाम", or similar labels, or a name-like string near the top)
    * Date of Birth (format: DD/MM/YYYY, look for "DOB", "Date of Birth", "जन्म तिथि", or a date pattern like DD/MM/YYYY)
    * Gender (look for "Gender", "लिंग", "Male", "Female", "M", "F", or similar)
    * Aadhaar Number (12 digits, often in the format XXXX XXXX XXXX or 12 consecutive digits)
    * Full Address (look for "Address", "पता", or a multi-line string that looks like an address, often containing words like "Street", "Road", "Village", "City", "Pin", etc.)

    Return ONLY a valid JSON object with these keys:
    {
      "name": "",
      "dob": "",
      "gender": "",
      "aadhaarNumber": "",
      "address": ""
    }

    If a field cannot be found, return "N/A" for that field. Be flexible with formatting and look for patterns even if labels are missing.

    OCR Text:
    """
    ${text.trim()}
    """
    `.trim();
  } else if (docType === "form21") {
    prompt = `
    Extract the following details from the text of a Form 21 (Vehicle Sale Certificate):

    * Engine Number (look for "Engine No" or similar)
    * Chassis Number (look for "Chassis No" or similar)
    * Year of Manufacture (format: YYYY, extract from "Year of Manufacture" like "May/2025")
    * Month of Manufacture (e.g., January, February, etc., extract from "Year of Manufacture" like "May/2025")
    * Name of Buyer (look for "Name of the buyer" or similar)
    * Full Address (look for "Address (Permanent)" or similar)
    * Mobile Number (a 10-digit number following "Ph :" or "Mob :" appearing near or after "Name of the buyer" or "Address (Permanent)", NOT the dealer's phone number appearing earlier in the text near "JATASHANKAR MOTORS" or similar dealer-related text)
    * Dated (format: DD/MM/YYYY, look for "Dated" or similar)

    Return ONLY a valid JSON object with these keys:
    {
      "engineNumber": "",
      "chassisNumber": "",
      "yearOfManufacture": "",
      "monthOfManufacture": "",
      "nameOfBuyer": "",
      "address": "",
      "mobileNumber": "",
      "dated": ""
    }

    If a field cannot be found, return "N/A" for that field. Be flexible with formatting and look for patterns even if labels are missing.

    Text:
    """
    ${text.trim()}
    """
    `.trim();
  } else {
    return res.status(400).json({ error: "Invalid docType" });
  }

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
      console.error("Gemini API error:", data.error.message);
      return res.status(400).json({ error: data.error.message });
    }

    const finalTextRaw = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!finalTextRaw) {
      console.log(`No result found for ${docType} extraction`);
      return res.json({ result: "No result found" });
    }

    const extractJson = (text) => {
      return text.trim().replace(/^```json\s*/, "").replace(/\s*```$/, "");
    };

    const finalText = extractJson(finalTextRaw);

    let parsedResult;
    try {
      parsedResult = JSON.parse(finalText);
    } catch (e) {
      console.error(`Failed to parse JSON for ${docType}:`, e.message, finalText);
      parsedResult = { error: "Failed to parse Gemini response", raw: finalText };
    }

    // Fallback for mobileNumber if Gemini fails (for Form 21)
    if (docType === "form21" && (!parsedResult.mobileNumber || parsedResult.mobileNumber === "N/A")) {
      const buyerSectionMatch = text.match(/Name of the buyer\s*[:\s].*?((?:Ph|Mob)\s*[:\s]*(\d{10}))/is);
      if (buyerSectionMatch) {
        parsedResult.mobileNumber = buyerSectionMatch[2];
      }
    }

    console.log(`✅ ${docType === "aadhaar" ? "Aadhaar" : "Form 21"} data extracted successfully`);
    res.json({ result: parsedResult });
  } catch (error) {
    console.error(`❌ Error during ${docType} extraction:`, error.message);
    res.status(500).json({ error: "Failed to fetch from Gemini" });
  }
});

app.post("/extract-pdf-text", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded." });
    }

    const pdfParser = new PDFParser();
    let text = "";

    return new Promise((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", err => reject(err));
      pdfParser.on("pdfParser_dataReady", pdfData => {
        text = pdfData.Pages.reduce((acc, page) => {
          return acc + (page.Texts.map(text => decodeURIComponent(text.R[0].T)).join(" ") + "\n");
        }, "");
        resolve(res.json({ text: text.trim() }));
      });

      pdfParser.parseBuffer(req.file.buffer);
    });
  } catch (err) {
    console.error("Error extracting PDF text:", err);
    res.status(500).json({ error: "Failed to extract text from PDF: " + err.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});