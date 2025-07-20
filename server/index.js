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

function convertShortMonthToFull(month) {
  if (!month || month === "N/A") return month;
  const map = {
    jan: "January",
    feb: "February",
    mar: "March",
    apr: "April",
    may: "May",
    jun: "June",
    jul: "July",
    aug: "August",
    sep: "September",
    oct: "October",
    nov: "November",
    dec: "December",
  };
  return map[month.toLowerCase()] || month;
}

function cleanName(name) {
  if (!name || name === "N/A") return name;
  let cleaned = name
    .replace(/^(mr|mrs|ms|miss|shri|smt|km)\.?\s*/i, "")
    .trim()
    .replace(/\s+/g, " ");
  if (/^([A-Z]\s){2,}[A-Z]$/.test(cleaned)) {
    cleaned = cleaned.replace(/\s+/g, "");
  }
  return cleaned;
}

function normalizeWhitespace(text) {
  if (!text) return text;
  return text.replace(/\s+/g, " ").trim();
}

function cleanAddress(address, pincode) {
  if (!address || address === "N/A") return address;
  let cleaned = normalizeWhitespace(address);
  if (pincode && pincode !== "N/A") {
    const pinRegex = new RegExp(`\\b${pincode}\\b`);
    cleaned = cleaned.replace(pinRegex, "").trim();
  }
  cleaned = cleaned
    .replace(/\bNH\s*(\d+)\b/gi, 'NH $1')
    .replace(/\bPUC\s*HYT\s*BWM\s*I\b/gi, 'Panchayat Bhawan Bamitha')
    .replace(/\bBWM\s*I\b/gi, 'Bamitha')
    .replace(/\bPUC\s*HYT\b/gi, 'Panchayat')
    .replace(/\bT\s*B\s*W\s*N\b/gi, 'Town')
    .replace(/\bCHH\s*ATAR\s*PUR\b/gi, 'Chhatarpur');
  const words = cleaned.split(" ");
  const seen = new Set();
  const deduped = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduped.push(word);
    }
  }
  let result = deduped.join(" ");
  const cityPattern = /(?:^|\s)(Chhatarpur|Bamitha|Near|NH \d+)/i;
  const cityMatch = result.match(cityPattern);
  if (cityMatch) {
    result = result.replace(cityPattern, '\n$1');
  }
  return result.toUpperCase();
}


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
    Extract the following details from the OCR text of an Aadhaar card:

    {
      "name": "",
      "dob": "",
      "gender": "",
      "aadhaarNumber": "",
      "address": ""
    }

    Return valid JSON only. If a field is missing, use "N/A".

    OCR Text:
    """
    ${text.trim()}
    """
    `.trim();
  } else if (docType === "form21") {
    prompt = `
Extract the following details from the OCR text of a Form 21 document.

- "Name of Buyer": Just remove titles like Mr, Mrs, etc.
- "Address": Use the permanent address only. Remove dashes, fix common OCR issues (e.g., NH39 → NH 39), and normalize whitespace, and make everything in UPPERCASE.
- **Include the "Wife/Son/Daughter of" line (like "S/O DEENDAYAL NAMDEO") as the first part of the address. IF NOT AVAILABLE THEN DONT PUT N/A JUST LEAVE IT**
- "Month of Manufacture": Convert short form (e.g., May) to full form ("May").
- Ensure all values are clean and structured.

JSON format:
{
  "engineNumber": "",
  "chassisNumber": "",
  "yearOfManufacture": "",
  "monthOfManufacture": "",
  "nameOfBuyer": "",
  "address": "",
  "pincode": "",
  "mobileNumber": "",
  "dated": ""
}

Return valid JSON only. If a field is missing, use "N/A".

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
      return res.status(400).json({ error: data.error.message });
    }

    const finalTextRaw = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!finalTextRaw) {
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
      parsedResult = { error: "Failed to parse Gemini response", raw: finalText };
    }

    if (docType === "form21") {
      if (!parsedResult.mobileNumber || parsedResult.mobileNumber === "N/A") {
        const match = text.match(/(?:mobile|mob|phone)\s*[:]?\s*(\d{10})/i);
        if (match) parsedResult.mobileNumber = match[1];
      }

      if (!parsedResult.pincode || parsedResult.pincode === "N/A") {
        const match = text.match(/\b(\d{6})\b/);
        if (match) parsedResult.pincode = match[1];
      }

      if (parsedResult.monthOfManufacture) {
        parsedResult.monthOfManufacture = convertShortMonthToFull(parsedResult.monthOfManufacture);
      }

      if (parsedResult.nameOfBuyer) {
        parsedResult.nameOfBuyer = cleanName(parsedResult.nameOfBuyer);
      }

      if (parsedResult.address) {
 
  let cleanedAddress = cleanAddress(parsedResult.address, parsedResult.pincode);

  const relationLineMatch = text.match(/Wife\/Son\/Daughter of\s*[:\-]?\s*(S\/O|D\/O|W\/O)\s+([A-Z\s]{3,40})/i);

  if (relationLineMatch) {
    const relation = relationLineMatch[1].toUpperCase(); 
    const name = normalizeWhitespace(relationLineMatch[2]);
    const relationPhrase = `${relation} ${name}`.trim();
    if (!cleanedAddress.toLowerCase().includes(relationPhrase.toLowerCase())) {
      cleanedAddress = `${relationPhrase} ${cleanedAddress}`;
    }
  }

  parsedResult.address = cleanedAddress.trim();
}



      for (const key in parsedResult) {
        if (typeof parsedResult[key] === "string") {
          parsedResult[key] = normalizeWhitespace(parsedResult[key]);
        }
      }
    }

    console.log(
      docType === "aadhaar"
        ? "Aadhaar card data extracted successfully"
        : "Form 21 data extracted successfully"
    );

    res.json({ result: parsedResult });
  } catch (error) {
    console.error("Error in extract-info:", error);
    res.status(500).json({ error: "Failed to fetch from Gemini" });
  }
});

app.post("/extract-pdf-text", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded." });
    }

    const pdfParser = new PDFParser();

    const text = await new Promise((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", err => reject(err));
      pdfParser.on("pdfParser_dataReady", pdfData => {
        const resultText = pdfData.Pages.reduce((acc, page) => {
          return acc + page.Texts.map(t => decodeURIComponent(t.R[0].T)).join(" ") + "\n";
        }, "");
        resolve(resultText.trim());
      });

      pdfParser.parseBuffer(req.file.buffer);
    });

    console.log("PDF text extraction successful");
    res.json({ text });
  } catch (err) {
    console.error("PDF extraction failed:", err.message);
    res.status(500).json({ error: "Failed to extract text from PDF: " + err.message });
  }
});

app.get("/ping", (req, res) => {
  res.send("Server is alive");
});
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});