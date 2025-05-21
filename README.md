BillBoost OCR
BillBoost OCR is a web-based Optical Character Recognition (OCR) tool designed to extract structured text from Form 21 sales certificates and Aadhaar cards. Form 21 documents are used in vehicle registration and insurance applications in India, while Aadhaar cards are used for identity verification. The project features a React frontend for uploading documents and a Node.js backend for OCR processing, making it easy to extract and use data in downstream applications like form autofilling or identity verification.

Form 21: Extracts vehicle details such as Engine Number, Chassis Number, and Month of Manufacture.
Aadhaar: Extracts identity details like Name, Aadhaar Number, and Address.

This project is ideal for automating data extraction from official documents, improving efficiency in insurance, registration, and verification workflows.
Features

React Frontend: A user-friendly interface for uploading Form 21 and Aadhaar PDFs/images, built with React and Vite.
Drag-and-Drop Uploads: Supports drag-and-drop file uploads via the DragAndDrop.jsx component.
OCR Extraction: Uses Tesseract.js on the backend to extract text from uploaded files.
Structured Output: Parses text into key-value pairs (e.g., Engine Number: KG5DS1522496, Aadhaar Number: 1234 5678 9012).
Flexible Parsing: Handles variations in Form 21 and Aadhaar layouts, including combined fields (e.g., Apr/2025) and multi-line addresses.
Open Source: Freely available for customization and integration.

Prerequisites

Node.js: Version 18 or higher (for both frontend and backend).
Tesseract.js: OCR library (installed via npm in the server/ directory).
Input Files: PDFs or images of Form 21 certificates and Aadhaar cards for testing.

Installation

Clone the Repository:
git clone https://github.com/UjjwalAsati/billboost-ocr.git
cd billboost-ocr


Set Up the Frontend (aadhaar-ocr-app/):
cd aadhaar-ocr-app
npm install


Set Up the Backend (server/):
cd ../server
npm install

This installs Tesseract.js and other dependencies listed in server/package.json.

Configure Environment:

Create a .env file in the root directory (if not already present) with necessary variables, e.g.:BACKEND_PORT=5000


Refer to server/index.js for required environment variables (e.g., API keys, if any).



Usage
Running the Application

Start the Backend Server:
cd server
npm start


The server runs at http://localhost:5000 (or the port specified in .env).


Start the Frontend Development Server:
cd ../aadhaar-ocr-app
npm run dev


The frontend runs at http://localhost:5173 (default Vite port).


Access the Web Interface:

Open a browser and navigate to http://localhost:5173.
Use the drag-and-drop interface to upload a Form 21 or Aadhaar PDF/image.


Process and View Output:

The frontend sends the file to the backend for OCR processing.
Extracted data is displayed on the web page or returned as JSON (depending on server/index.js configuration).


Example Outputs:

Form 21:Engine Number: KG5DS1522496
Chassis Number: MD626EG58S1D20052
Year of Manufacture: 2025
Month of Manufacture: April
Name of Buyer: MrDINESH TRIPATHI
Address: WARD NUMBER 05 SOSATY KE PASS BEGAUTA CHHATARPUR CHHATARPUR - 471001
Mobile Number: 9131043084
Pincode: 471001
Dated: 20/05/2025


Aadhaar:Name: Dinesh Tripathi
Aadhaar Number: 1234 5678 9012
Date of Birth: 15/03/1980
Gender: Male
Address: Ward Number 05, Sosaty Ke Pass, Begauta, Chhatarpur, Chhatarpur - 471001





Testing

Upload sample Form 21 or Aadhaar files via the web interface.
To improve testing, create a samples/ folder in the root directory with form21-sample.pdf and aadhaar-sample.jpg, and document their usage in aadhaar-ocr-app/README.md.

Notes

Month Handling: Short month names (e.g., Apr) are extracted as-is. Convert to full names (e.g., April) in downstream applications or website backends.
Aadhaar Compliance: Mask the first eight digits of Aadhaar numbers (e.g., XXXX XXXX 9012) unless required, per UIDAI guidelines.
Output: Extracted data is displayed via the frontend. Modify server/index.js to save to a file (e.g., output.txt) or return in a different format.
