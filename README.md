# Majalis Ijazah (مجالس الإجازة)

A simple, open-source Node.js web application for managing Islamic knowledge sessions, attendance, and generating digital Ijazah certificates (PDF) with QR verification.

<div align="center">
  <img src="https://via.placeholder.com/800x400?text=Majalis+Ijazah+Preview" alt="Preview">
</div>

## Features

-   **Session Management**: Create scientific sessions (Majalis) with Sheikh name, date, and time.
-   **QR Code Registration**: Attendees scan a QR code to register (only active during session time).
-   **Digital Certificates**: Auto-generate PDF certificates for all attendees with one click.
-   **Verification System**: Verify certificate authenticity via QR code scan.
-   **Islamic Design**: Clean UI with green/beige accents and Arabic typography (Amiri font).
-   **Privacy Focused**: No user accounts required, database stored locally.

## Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database**: SQLite (local file, no setup needed)
-   **Frontend**: HTML, EJS, TailwindCSS (CDN)
-   **PDF Generation**: PDFKit
-   **QR Codes**: qrcode

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/majalis-ijazah.git
    cd majalis-ijazah
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the application**:
    ```bash
    npm start
    ```
    The server will start at `http://localhost:3000`.

## Quick Start / Testing

1.  **Seed Data**:
    Run `node seed.js` to create a test session that is currently active (starts 1 hour ago, ends in 2 hours).

2.  **Access Admin Dashboard**:
    Go to `http://localhost:3000` to see the session list.

3.  **Register as an Attendee**:
    -   Click "إدارة المجلس" (Manage Session).
    -   Scan the QR code or click the "رابط مباشر" (Direct Link).
    -   Enter your name and register.

4.  **Generate Certificates**:
    -   In the session page, click "إصدار الإجازات" (Generate Certificates).
    -   Check the `/certificates` folder in the project directory for the generated PDFs.

## Deployment (Render.com)

1.  Push code to GitHub.
2.  Create a new **Web Service** on Render.
3.  Connect your repository.
4.  Set **Build Command**: `npm install`
5.  Set **Start Command**: `node server.js`
6.  Add Environment Variable (Optional): `BASE_URL` = `https://your-app-name.onrender.com`

---
*License: ISC (Open Source)*
