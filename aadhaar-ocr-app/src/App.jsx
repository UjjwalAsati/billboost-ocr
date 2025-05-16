import React, { useState } from "react";
import Tesseract from "tesseract.js";
import axios from "axios";
import "./App.css";

function App() {
  const [images, setImages] = useState([]);
  const [rawText, setRawText] = useState("");
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const validImages = files.filter(file => file.type.startsWith("image/"));
    setImages(validImages.map((file) => URL.createObjectURL(file)));
    setRawText("");
    setProcessedData(null);
    setError("");
  };

  const handleExtractText = async () => {
    if (images.length === 0) return;

    setLoading(true);
    setError("");
    let combinedText = "";

    try {
      for (const img of images) {
        const result = await Tesseract.recognize(img, "eng");
        combinedText += result.data.text + "\n";
      }

      setRawText(combinedText);

      const response = await axios.post("http://localhost:5000/extract-info", {
        text: combinedText,
      });

      if (response.data.result) {
        if (typeof response.data.result === "object") {
          setProcessedData(response.data.result);
        } else {
          setProcessedData({ message: response.data.result });
        }
      } else {
        setProcessedData({ message: "No cleaned data returned." });
      }
    } catch (err) {
      setError("Error during processing: " + err.message);
      setProcessedData(null);
    }

    setLoading(false);
  };

  return (
  <div style={{ padding: "2rem" }}>
    <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Aadhaar OCR Extractor</h1>

    <div style={{ display: "flex", gap: "2rem" }}>
      {/* Left Side: Image Upload */}
      <div style={{ flex: 1, textAlign: "center" }}>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          disabled={loading}
        />
        <br /><br />

        {images.length > 0 && (
          <div>
            {images.map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`Aadhaar ${index + 1}`}
                width="250"
                style={{ margin: "10px", borderRadius: "8px" }}
              />
            ))}

            <br />
            <button onClick={handleExtractText} disabled={loading}>
              {loading ? "Processing..." : "Extract & Clean"}
            </button>
          </div>
        )}

        {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}
      </div>

      {/* Right Side: Aadhaar Details */}
      <div style={{ flex: 1 }}>
        {processedData && (
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
            <h3>Cleaned Aadhaar Details:</h3>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "20px",
              }}
            >
              <div><strong>Name:</strong> {processedData.name || "N/A"}</div>
              <div><strong>DOB:</strong> {processedData.dob || "N/A"}</div>
              <div><strong>Gender:</strong> {processedData.gender || "N/A"}</div>
              <div><strong>Aadhaar Number:</strong> {processedData.aadhaarNumber || "N/A"}</div>
              <div style={{ flexBasis: "100%" }}>
                <strong>Address:</strong> {processedData.address || "N/A"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

}

export default App;
