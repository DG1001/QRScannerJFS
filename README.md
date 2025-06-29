# QR Check-in Scanner

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
    VITE_API_URL=https://kirsten-controls.de/jfs/qr.php?action=checkin
    VITE_TOKEN=7382b853-ca0a-4760-aff0-1515afcb2dcd
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:5173` (or the next available port).

## Deployment

This project includes a GitHub Actions workflow to automatically build and deploy the application to GitHub Pages.

### 1. Configure Repository Secrets

Before the workflow can run successfully, you must add the following secrets to your GitHub repository settings (`Settings` > `Secrets and variables` > `Actions`):

-   `VITE_API_URL`: The full URL to your check-in API endpoint.
-   `VITE_TOKEN`: The API token for your backend.

### 2. Enable GitHub Pages

In your repository settings, go to `Pages` and set the `Source` to `Deploy from a branch`. Then select the `gh-pages` branch (the workflow will create it) and the `/ (root)` folder.

### 3. Push to `main`

Once the secrets are configured and GitHub Pages is enabled, any push to the `main` branch will trigger the workflow. The workflow will build the application and deploy it to the `gh-pages` branch. Your application will be available at `https://<your-username>.github.io/QRScannerJFS/`.

## Backend API

The backend is a simple PHP script that handles the following actions:

-   `checkin`: Validates a scanned ID and records it.
-   `registered-ids`: Returns a list of all registered IDs.
-   `clear`: Clears the list of registered IDs.

The PHP script requires a `.apitoken` file in the same directory containing the API token.