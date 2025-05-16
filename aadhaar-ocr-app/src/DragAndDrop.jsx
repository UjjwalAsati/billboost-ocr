import React from "react";
import { useDropzone } from "react-dropzone";
import "./App.css";

const DragAndDrop = ({ onFileSelect }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    }
  });

  return (
    <div {...getRootProps()} className="dropzone">
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the Aadhaar image here...</p>
      ) : (
        <p>Drag & drop Aadhaar image here, or click to select</p>
      )}
    </div>
  );
};

export default DragAndDrop;
