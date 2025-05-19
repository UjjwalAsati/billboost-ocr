// aadhaar-ocr-app/src/DragAndDrop.jsx
import React from "react";
import { useDropzone } from "react-dropzone";
import "./App.css";

const DragAndDrop = ({ onFileSelect, accept, multiple }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: accept === "image/*" ? { "image/*": [] } : { "application/pdf": [] },
    multiple,
    maxFiles: 2,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles);
      }
    },
  });

  return (
    <div {...getRootProps()} className="dropzone">
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the {accept === "image/*" ? "Aadhaar images" : "Form 21 PDF"} here...</p>
      ) : (
        <p>Drag & drop {accept === "image/*" ? "Aadhaar images (up to 2)" : "Form 21 PDF"} here, or click to select</p>
      )}
    </div>
  );
};

export default DragAndDrop;