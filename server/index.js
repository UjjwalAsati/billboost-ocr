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

function cleanTitleFromName(name) {
  if (!name || name === "N/A") return name;
  return name.replace(/^(mr|mrs|ms|miss)\.?[\s]+/i, "").trim();
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
    Extract the following details from the OCR text of a Form 21:

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
        const match = text.match(/Name of the buyer\s*[:\s][\s\S]*?(?:Ph|Mob)\s*[:\s]*(\d{10})/i);
        if (match) parsedResult.mobileNumber = match[1];
      }

      if (!parsedResult.pincode || parsedResult.pincode === "N/A") {
        const match = text.match(/Address\s*(?:\(|:)?[\s\S]*?[-:\s]?\b(\d{6})\b/i);
        if (match) parsedResult.pincode = match[1];
      }

      if (parsedResult.monthOfManufacture) {
        parsedResult.monthOfManufacture = convertShortMonthToFull(parsedResult.monthOfManufacture);
      }

      if (parsedResult.nameOfBuyer) {
        parsedResult.nameOfBuyer = cleanTitleFromName(parsedResult.nameOfBuyer);
      }
    }

    console.log(
      docType === "aadhaar"
        ? "Aadhaar card data extracted successfully"
        : "Form 21 data extracted successfully"
    );

    res.json({ result: parsedResult });
  } catch (error) {
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

const PORT = 5000;
app.listen(PORT, () => {
  console.log(` Server listening on port ${PORT}`);
});
