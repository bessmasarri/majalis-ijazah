# Majalis Ijazah (مجالس الإجازة)

A simple, open-source Node.js web application for managing Islamic knowledge sessions, attendance, and generating digital Ijazah certificates (PDF) with QR verification.

<div align="center">
  <img src="https://via.placeholder.com/800x400?text=Majalis+Ijazah+Preview" alt="Preview">
</div>

## Features

-   **Authentication System**: Secure Login/Signup for Sheikhs and Professors to manage their own sessions.
-   **Session Management**: Create scientific sessions (Majalis) with Sheikh name, date, and time.
-   **Mobile Optimized**: Fully responsive design with a mobile-friendly dashboard and registration flow.
-   **QR Code Registration**: Attendees scan a QR code to register (only active during session time).
-   **Digital Certificates**: Auto-generate PDF certificates for all attendees with one click.
-   **Verification System**: Verify certificate authenticity via QR code scan.
-   **Islamic Design**: Clean UI with green/beige accents and Arabic typography (Amiri font).

## Tech Stack

-   **Backend**: Node.js, Express.js
-   **Authentication**: bcryptjs, express-session
-   **Database**: SQLite (local file, no setup needed)
-   **Frontend**: HTML, EJS, TailwindCSS (CDN)
-   **PDF Generation**: PDFKit
-   **QR Codes**: qrcode

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/bessmasarri/majalis-ijazah.git
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
    Run `node seed.js` to create a test user and session.
    -   **Default Admin Email**: `sheikh@example.com`
    -   **Default Password**: `123456`

2.  **Access the Platform**:
    Go to `http://localhost:3000`. You will see the Landing Page.

3.  **Login**:
    Click "دخول" (Login) and use the default credentials above.

4.  **Create a Session**:
    Go to your **Dashboard** (لوحة التحكم) and click "إلشاء مجلس جديد" (Create Session).

5.  **Attendee Registration**:
    -   Open the session page.
    -   Scan the QR code or use the direct link (open in Incognito/Private window to simulate a student).
    -   Register a name.

6.  **Generate Certificates**:
    -   Back in the Admin Dashboard, inside the session page, click "إصدار الإجازات" (Generate Certificates).
    -   PDFs are saved in the `/certificates` folder.

## Deployment

1.  Push code to GitHub.
2.  Deploy to **Render** or **Railway** as a Node.js Web Service.
3.  **Build Command**: `npm install`
4.  **Start Command**: `node server.js`
5.  **Environment Variables**:
    -   `BASE_URL`: Set to your production URL (e.g., `https://myapp.onrender.com`)
    -   `SESSION_SECRET`: Set a strong random string.

---
*License: ISC (Open Source)*
