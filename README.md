# QR Check-in Scanner

<div align="center">
  <img src="public/logo.png" alt="JFS 2025 Logo" width="200" />
</div>

This is a simple web-based QR code scanner application built with React, TypeScript, and Vite. It allows users to scan QR codes and send the extracted ID to a PHP backend for validation and check-in.

## Features

- **Continuous QR Code Scanning:** Uses `html5-qrcode` for a real-time scanning experience.
- **API Integration:** Sends scanned IDs to a PHP backend for processing.
- **Rejected ID Management:** Administrative control over invalid/blocked IDs with reasons.
- **Enhanced Audio Feedback:** Distinctive sounds for success, warnings, errors, and rejections.
- **Environment-based Configuration:** Keeps API URLs and tokens out of the codebase.
- **GitHub Pages Deployment:** Includes a GitHub Actions workflow for easy deployment.
- **Progressive Web App:** Installable with offline capabilities and service worker caching.

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
    VITE_API_URL=https://example.com/api/qr.php?action=checkin
    VITE_TOKEN=your-api-token-here
    VITE_PIN_CODE=1234 # A 4-digit code for initial app access
    ```

4.  **Run the development server:****

    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:5173` (or the next available port).

## How It Works

### Scanning Workflow

1. **PIN Verification** - Users enter a 4-digit PIN code to access the scanner
2. **QR Code Scanning** - Continuous scanning using device camera
3. **ID Extraction** - Extract ID from QR code URLs (format: `/checkin/[id]`)
4. **Validation Process**:
   - ✅ **Format Check** - Validate ID format (5-50 alphanumeric characters)
   - 🚫 **Rejection Check** - Check if ID is in rejected list (shows reason)
   - ⚠️ **Duplicate Check** - Check if ID already registered
   - ✅ **Registration** - Record successful check-in

### Audio Feedback System

- **Success** (✅): Ascending tone (800Hz → 1000Hz)
- **Warning** (⚠️): Descending tone (600Hz → 500Hz) 
- **Rejection** (🚫): Triple buzzer pattern (400Hz pulses)
- **Error** (❌): Descending sequence (300Hz → 250Hz → 200Hz)

### User Interface States

- **PIN Entry**: Initial access control
- **Scanner Active**: Camera view with scanning indicator
- **Message Display**: Status feedback with auto-timeout
- **Loading**: Processing indicator during API calls

## Deployment

This project includes a GitHub Actions workflow to automatically build and deploy the application to GitHub Pages.

### 1. Configure Repository Secrets

Before the workflow can run successfully, you must add the following secrets to your GitHub repository settings (`Settings` > `Secrets and variables` > `Actions`):

-   `VITE_API_URL`: The full base URL to your check-in API endpoint (e.g., `https://example.com/api/qr.php?action=checkin`).
-   `VITE_TOKEN`: The API token for your backend.
-   `VITE_PIN_CODE`: A 4-digit code that the user must enter on first use of the scanner. This is stored in local browser memory.

### 2. Enable GitHub Pages

In your repository settings, go to `Pages` and set the `Source` to `Deploy from a branch`. Then select the `gh-pages` branch (the workflow will create it) and the `/ (root)` folder.

### 3. Push to `main`

Once the secrets are configured and GitHub Pages is enabled, any push to the `main` branch will trigger the workflow. The workflow will build the application and deploy it to the `gh-pages` branch. Your application will be available at `https://<your-username>.github.io/QRScannerJFS/`.

## Backend API Endpoints

The backend is a simple PHP script (`server/qr.php`) that handles check-in operations and data management. All API calls require the `X-API-Token` header for authentication.

### Check-in Operations

-   **`POST /?action=checkin`**
    -   **Purpose:** Validates a scanned ID and records it as checked in. Checks for rejected IDs first, then duplicate registrations.
    -   **Request Body:** `{"id": "string_value_of_the_scanned_id"}`
    -   **Response:** Returns a JSON object with status: `"ok"`, `"already registered"`, `"rejected"`, `"id not known"`, or `"error"`
    -   **Rejected Response:** Includes additional `"reason"` field with rejection explanation

### Data Management

-   **`GET /?action=registered-ids`**
    -   **Purpose:** Retrieves a list of all unique IDs that have been successfully checked in.
    -   **Response:** Returns a JSON array of registered IDs.

-   **`POST /?action=clear`**
    -   **Purpose:** **(Warning: Destructive Action)** Removes all currently registered IDs from the system.
    -   **Response:** Returns a JSON object indicating success or failure.

### Rejected ID Management

-   **`POST /?action=reject`**
    -   **Purpose:** Adds an ID to the rejected list with a reason. Rejected IDs cannot be used for check-in.
    -   **Request Body:** `{"id": "id_to_reject", "reason": "rejection_reason", "rejected_by": "optional_admin_identifier"}`
    -   **Response:** Returns a JSON object indicating success or failure.

-   **`GET /?action=rejected-ids`**
    -   **Purpose:** Retrieves a list of all rejected IDs with their reasons, timestamps, and who rejected them.
    -   **Response:** Returns a JSON array of rejected ID records with full details.

### Backend Configuration

The PHP script requires two configuration files in the same directory as `qr.php`:

1. **`.apitoken`** - Contains your secret API token
2. **`.dbconfig`** - Contains database connection details in JSON format:
   ```json
   {
     "host": "localhost",
     "database": "your_database_name",
     "username": "your_db_username", 
     "password": "your_db_password"
   }
   ```

The system automatically creates the required database tables (`registered_ids` and `rejected_ids`) on first run.

## API Documentation & Testing

The `apidoc.html` file (located in the `server/` directory) provides comprehensive interactive documentation for all API endpoints.

### Features:
- **Interactive testing forms** for all endpoints
- **Complete cURL and Python examples**
- **Real-time API response viewing**
- **Stress testing tool** for performance validation
- **Rejected ID management interface**

### Usage:
1.  Open `apidoc.html` in your browser (e.g., `https://www.your-domain.com/apidoc.html`).
2.  Enter your API Base URL and API Token in the Configuration section.
3.  Test individual endpoints or use the stress test tool.
4.  Use the rejected ID management section to add/view blocked IDs.

### Available Tests:
- **Check-in simulation** with various ID formats
- **Rejected ID management** (add/view rejected IDs with reasons)
- **Data retrieval** (registered IDs, rejected IDs)
- **Stress testing** with configurable load (TEST0001 to TESTxxxx)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Copyright (c) 2025 MeiLuft**