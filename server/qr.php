<?php



// --- 1. General Setup & Configuration ---

// Set the content type for all responses to JSON
header("Content-Type: application/json");

// --- CORS Headers ---
// Allow requests from any origin. For production, you might want to restrict this to your app's domain.
header("Access-Control-Allow-Origin: *");
// Allow specific headers and methods needed for the app.
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-API-Token");

// Handle pre-flight OPTIONS requests sent by browsers
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
  exit(0);
}

// Define paths for data and the security token
define('DATA_FILE', __DIR__ . '/registered_ids.json');
define('TOKEN_FILE', __DIR__ . '/.apitoken'); // File containing the secret token

// Server-side ID validation rules
define('ID_REGEX', '/^[a-zA-Z0-9-]{5,50}$/');

// Optional "Guest List" - set to null to disable
define('GUEST_LIST', null);


// --- 2. Helper Functions ---

function send_json_response($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

function get_registered_ids_from_file() {
    if (!file_exists(DATA_FILE)) return [];
    $json_data = file_get_contents(DATA_FILE);
    return json_decode($json_data, true) ?: [];
}

function save_registered_ids_to_file($ids) {
    $json_data = json_encode(array_values($ids), JSON_PRETTY_PRINT);
    if (file_put_contents(DATA_FILE, $json_data) === false) {
        error_log("Failed to write to data file: " . DATA_FILE);
        return false;
    }
    return true;
}

/**
 * Reads the secret token from the server's token file.
 * @return string|false The token, or false if not found.
 */
function get_server_token() {
    if (!file_exists(TOKEN_FILE)) {
        error_log("SECURITY ALERT: Token file not found at " . TOKEN_FILE);
        return false;
    }
    // trim() is important to remove any accidental newlines or whitespace
    return trim(file_get_contents(TOKEN_FILE));
}

/**
 * Validates the token sent by the client in the headers.
 */
function validate_token() {
    $serverToken = get_server_token();
    if ($serverToken === false) {
        // This is a server configuration error
        send_json_response(['status' => 'error', 'message' => 'API not configured correctly.'], 500);
    }

    // Get the token from the request header 'X-API-Token'
    $clientToken = isset($_SERVER['HTTP_X_API_TOKEN']) ? trim($_SERVER['HTTP_X_API_TOKEN']) : '';

    if (empty($clientToken) || !hash_equals($serverToken, $clientToken)) {
        // Use hash_equals for secure, timing-attack-safe comparison
        send_json_response(['status' => 'error', 'message' => 'Unauthorized: Invalid or missing API token.'], 401);
    }
}


// --- 3. API Entry Point ---

// First, validate the request token. This is the gatekeeper for the entire API.
validate_token();

// If validation passes, proceed to the routing logic.
$requestMethod = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'checkin':
        if ($requestMethod !== 'POST') send_json_response(['status' => 'error', 'message' => 'Method Not Allowed.'], 405);
        $requestBody = json_decode(file_get_contents('php://input'), true);
        $scannedId = isset($requestBody['id']) ? trim($requestBody['id']) : '';

        if (empty($scannedId) || !preg_match(ID_REGEX, $scannedId)) send_json_response(['status' => 'error', 'message' => 'Invalid request: ID has an invalid format.'], 400);
        if (GUEST_LIST !== null && !in_array($scannedId, GUEST_LIST)) send_json_response(['status' => 'id not known', 'message' => "ID '{$scannedId}' is not recognized."], 404);

        $registeredIds = get_registered_ids_from_file();
        if (in_array($scannedId, $registeredIds)) send_json_response(['status' => 'already registered', 'message' => "ID '{$scannedId}' was already checked in."], 200);

        $registeredIds[] = $scannedId;
        if (save_registered_ids_to_file($registeredIds)) send_json_response(['status' => 'ok', 'message' => "ID '{$scannedId}' checked in successfully."], 200);
        else send_json_response(['status' => 'error', 'message' => 'An unexpected error occurred.'], 500);
        break;

    case 'registered-ids':
        if ($requestMethod !== 'GET') send_json_response(['status' => 'error', 'message' => 'Method Not Allowed.'], 405);
        $registeredIds = get_registered_ids_from_file();
        sort($registeredIds);
        send_json_response($registeredIds, 200);
        break;

    case 'clear':
        if ($requestMethod !== 'POST') send_json_response(['status' => 'error', 'message' => 'Method Not Allowed.'], 405);
        if (save_registered_ids_to_file([])) send_json_response(['status' => 'ok', 'message' => 'All registered IDs have been cleared.'], 200);
        else send_json_response(['status' => 'error', 'message' => 'Failed to clear the list of registered IDs.'], 500);
        break;

    default:
        send_json_response(['status' => 'error', 'message' => 'Action not specified or invalid.'], 404);
        break;
}