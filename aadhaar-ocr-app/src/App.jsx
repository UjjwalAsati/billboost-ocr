import React, { useState } from "react";
import DragAndDrop from "./DragAndDrop";
import Tesseract from "tesseract.js";
import axios from "axios";
import "./App.css";

function App() {
  const [docType, setDocType] = useState("aadhaar");
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_URL = import.meta.env.VITE_API_URL;

  const handleFileSelect = async (selectedFiles) => {
    const newFiles = [...files, ...selectedFiles].slice(0, docType === "aadhaar" ? 2 : 1);
    setFiles(newFiles);
    setProcessedData(null);
    setError("");

    if (docType === "aadhaar") {
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setFilePreviews(newPreviews);
    }
  };

  const handleExtractText = async () => {
    if (files.length === 0) {
      setError("Please upload a file first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let text = "";

      if (docType === "aadhaar") {
        for (const file of files) {
          const { data: { text: ocrText } } = await Tesseract.recognize(file, "eng");
          text += ocrText + "\n";
        }
      } else if (docType === "form21") {
        const formData = new FormData();
        formData.append("pdf", files[0]);

        const textResponse = await axios.post(`${API_URL}/extract-pdf-text`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        text = textResponse.data.text.trim();
      }

      const response = await axios.post(`${API_URL}/extract-info`, { docType, text }, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.data.result && typeof response.data.result === "object") {
        setProcessedData(response.data.result);
      } else {
        setProcessedData({ message: "No data extracted." });
      }
    } catch (err) {
      const errorMessage = "Error during processing: " + err.message;
      console.error(errorMessage, err.response?.data);
      setError(errorMessage);
      setProcessedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!processedData) return;

    let cleaned = "";
    if (docType === "aadhaar") {
      cleaned = `
Name: ${processedData.name || "N/A"}
DOB: ${processedData.dob || "N/A"}
Gender: ${processedData.gender || "N/A"}
Aadhaar Number: ${processedData.aadhaarNumber || "N/A"}
Address: ${processedData.address || "N/A"}
      `.trim();
    } else if (docType === "form21") {
      cleaned = `
Engine Number: ${processedData.engineNumber || "N/A"}
Chassis Number: ${processedData.chassisNumber || "N/A"}
Year of Manufacture: ${processedData.yearOfManufacture || "N/A"}
Month of Manufacture: ${processedData.monthOfManufacture || "N/A"}
Name of Buyer: ${processedData.nameOfBuyer || "N/A"}
Address: ${processedData.address || "N/A"}
Mobile Number: ${processedData.mobileNumber || "N/A"}
Pincode: ${processedData.pincode || "N/A"}
Dated: ${processedData.dated || "N/A"}
      `.trim();
    }

    try {
      await navigator.clipboard.writeText(cleaned);
      alert("Extracted data copied to clipboard!");
    } catch (err) {
      const errorMessage = "Failed to copy to clipboard: " + err.message;
      console.error(errorMessage);
      alert("Failed to copy.");
    }
  };

  const handleRemoveFile = (index) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    const updatedPreviews = filePreviews.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    setFilePreviews(updatedPreviews);
    if (docType === "form21") {
      setProcessedData(null);
    }
  };

  return (
    <div className="container">
      <h1>OCR Document Extractor</h1>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ marginRight: "10px", fontWeight: "bold" }}>Select Document Type: </label>
        <select
          value={docType}
          onChange={(e) => {
            setDocType(e.target.value);
            setFiles([]);
            setFilePreviews([]);
            setProcessedData(null);
            setError("");
          }}
          style={{ padding: "5px", borderRadius: "4px" }}
        >
          <option value="aadhaar">Aadhaar Card</option>
          <option value="form21">Form 21 (Vehicle Sale Certificate)</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          {docType === "aadhaar" ? (
            <>
              <DragAndDrop
                onFileSelect={handleFileSelect}
                accept="image/*"
                multiple={true}
              />
              {filePreviews.length > 0 && (
                <div>
                  {filePreviews.map((preview, index) => (
                    <div key={index} style={{ display: "inline-block", position: "relative", margin: "10px" }}>
                      <img
                        src={preview}
                        alt={`Uploaded Aadhaar ${index + 1}`}
                        width="150"
                        style={{ borderRadius: "8px" }}
                      />
                      <button
                        onClick={() => handleRemoveFile(index)}
                        style={{
                          position: "absolute",
                          top: "-10px",
                          right: "-10px",
                          background: "red",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                        }}
                      >
                        X
                      </button>
                    </div>
                  ))}
                  <br />
                </div>
              )}
              {(files.length > 0 && !processedData) && (
                <button onClick={handleExtractText} disabled={loading}>
                  {loading ? "Processing..." : "Extract Data"}
                </button>
              )}
            </>
          ) : (
            <>
              {!processedData && (
                <DragAndDrop
                  onFileSelect={handleFileSelect}
                  accept="application/pdf"
                  multiple={false}
                />
              )}
              {files.length > 0 && !processedData && (
                <div style={{ margin: "10px" }}>
                  <span>Uploaded PDF: {files[0].name}</span>
                  <button
                    onClick={() => handleRemoveFile(0)}
                    style={{
                      marginLeft: "10px",
                      background: "red",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      cursor: "pointer",
                    }}
                  >
                    X
                  </button>
                  <br /><br />
                  <button onClick={handleExtractText} disabled={loading}>
                    {loading ? "Processing..." : "Extract Data"}
                  </button>
                </div>
              )}
            </>
          )}

          {error && <p className="error">{error}</p>}
        </div>

        <div style={{ flex: 1 }}>
          {processedData && !processedData.message && (
            <div
              style={{
                backgroundColor: "#f9f9f9",
                padding: "20px",
                borderRadius: "10px",
                boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                fontSize: "16px",
                lineHeight: "1.8",
              }}
            >
              <h3>Extracted Details:</h3>
              {docType === "aadhaar" ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                  <div><strong>Name:</strong> {processedData.name || "N/A"}</div>
                  <div><strong>DOB:</strong> {processedData.dob || "N/A"}</div>
                  <div><strong>Gender:</strong> {processedData.gender || "N/A"}</div>
                  <div><strong>Aadhaar Number:</strong> {processedData.aadhaarNumber || "N/A"}</div>
                  <div style={{ flexBasis: "100%" }}>
                    <strong>Address:</strong> {processedData.address || "N/A"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                  <div><strong>Engine Number:</strong> {processedData.engineNumber || "N/A"}</div>
                  <div><strong>Chassis Number:</strong> {processedData.chassisNumber || "N/A"}</div>
                  <div><strong>Year of Manufacture:</strong> {processedData.yearOfManufacture || "N/A"}</div>
                  <div><strong>Month of Manufacture:</strong> {processedData.monthOfManufacture || "N/A"}</div>
                  <div><strong>Name of Buyer:</strong> {processedData.nameOfBuyer || "N/A"}</div>
                  <div style={{ flexBasis: "100%" }}>
                    <strong>Address:</strong> {processedData.address || "N/A"}
                  </div>
                  <div><strong>Mobile Number:</strong> {processedData.mobileNumber || "N/A"}</div>
                  <div><strong>Pincode:</strong> {processedData.pincode || "N/A"}</div>
                  <div><strong>Dated:</strong> {processedData.dated || "N/A"}</div>
                </div>
              )}
              <button style={{ marginTop: "20px" }} onClick={handleCopy}>
                Copy
              </button>
              {docType === "form21" && (
                <button
                  style={{ marginTop: "10px", marginLeft: "10px" }}
                  onClick={() => {
                    setFiles([]);
                    setFilePreviews([]);
                    setProcessedData(null);
                  }}
                >
                  Upload Another PDF
                </button>
              )}
            </div>
          )}
          {processedData && processedData.message && (
            <div
              style={{
                backgroundColor: "#f9f9f9",
                padding: "20px",
                borderRadius: "10px",
                boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                fontSize: "16px",
                lineHeight: "1.8",
              }}
            >
              <p>{processedData.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
