# QR Check-in Scanner

<div align="center">
  <img src="public/logo.png" alt="JFS 2025 Logo" width="200" />
</div>

This is a simple web-based QR code scanner application built with React, TypeScript, and Vite. It allows users to scan QR codes and send the extracted ID to a PHP backend for validation and check-in.

## Features

- **Continuous QR Code Scanning:** Uses `html5-qrcode` for a real-time scanning experience.
- **API Integration:** Sends scanned IDs to a PHP backend for processing.
- **Environment-based Configuration:** Keeps API URLs and tokens out of the codebase.
- **GitHub Pages Deployment:** Includes a GitHub Actions workflow for easy deployment.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- [npm](https://www.npmjs.com/)

### Local Development

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/<your-username>/QRScannerJFS.git
    cd QRScannerJFS
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Create a `.env` file:**

    Create a file named `.env` in the root of the project and add the following environment variables:

    ```
    VITE_API_URL=https://kirsten-controls.de/jfs/qr.php
    VITE_TOKEN=7382b853-ca0a-4760-aff0-1515afcb2dcd
    VITE_PIN_CODE=1234 # A 4-digit code for initial app access
    ```

4.  **Run the development server:****

    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:5173` (or the next available port).

## Deployment

This project includes a GitHub Actions workflow to automatically build and deploy the application to GitHub Pages.

### 1. Configure Repository Secrets

Before the workflow can run successfully, you must add the following secrets to your GitHub repository settings (`Settings` > `Secrets and variables` > `Actions`):

-   `VITE_API_URL`: The full base URL to your check-in API endpoint (e.g., `https://www.your-domain.com/qr.php`).
-   `VITE_TOKEN`: The API token for your backend.
-   `VITE_PIN_CODE`: A 4-digit code that the user must enter on first use of the scanner. This is stored in local browser memory.

### 2. Enable GitHub Pages

In your repository settings, go to `Pages` and set the `Source` to `Deploy from a branch`. Then select the `gh-pages` branch (the workflow will create it) and the `/ (root)` folder.

### 3. Push to `main`

Once the secrets are configured and GitHub Pages is enabled, any push to the `main` branch will trigger the workflow. The workflow will build the application and deploy it to the `gh-pages` branch. Your application will be available at `https://<your-username>.github.io/QRScannerJFS/`.

## Backend API Endpoints

The backend is a simple PHP script (`server/qr.php`) that handles check-in operations and data management. All API calls require the `X-API-Token` header for authentication.

-   **`POST /?action=checkin`**
    -   **Purpose:** Validates a scanned ID and records it as checked in.
    -   **Request Body:** `{"id": "string_value_of_the_scanned_id"}`
    -   **Response:** Returns a JSON object indicating success or failure, and a message.

-   **`GET /?action=registered-ids`**
    -   **Purpose:** Retrieves a list of all unique IDs that have been successfully checked in.
    -   **Response:** Returns a JSON array of registered IDs.

-   **`POST /?action=clear`**
    -   **Purpose:** **(Warning: Destructive Action)** Removes all currently registered IDs from the system.
    -   **Response:** Returns a JSON object indicating success or failure.

### API Token Configuration

The PHP script requires a `.apitoken` file in the same directory as `qr.php`. This file should contain your secret API token.

## Stress Testing the API

The `apidoc.html` file (located in the `server/` directory) includes an interactive stress test tool. This allows you to simulate multiple check-ins to test the API's performance and stability.

To use it:
1.  Open `apidoc.html` in your browser (e.g., `https://www.your-domain.com/apidoc.html`).
2.  Enter your API Base URL and API Token in the Configuration section.
3.  Navigate to the "Stress Test: Check-in Multiple IDs" section.
4.  Configure the number of IDs to generate (e.g., `TEST0001` to `TESTxxxx`) and the pause between requests.
5.  Click "Start Stress Test" to begin the simulation.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Copyright (c) 2025 MeiLuft**