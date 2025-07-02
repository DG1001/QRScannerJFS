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

// Define paths for the security token and database config
define('TOKEN_FILE', __DIR__ . '/.apitoken'); // File containing the secret token
define('DB_CONFIG_FILE', __DIR__ . '/.dbconfig'); // File containing database configuration

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

/**
 * Get database configuration from config file
 * @return array|false Database config array or false if not found
 */
function get_db_config() {
    if (!file_exists(DB_CONFIG_FILE)) {
        error_log("DATABASE ERROR: Config file not found at " . DB_CONFIG_FILE);
        return false;
    }
    
    $config_data = file_get_contents(DB_CONFIG_FILE);
    $config = json_decode($config_data, true);
    
    if (!$config || !isset($config['host'], $config['database'], $config['username'], $config['password'])) {
        error_log("DATABASE ERROR: Invalid config format in " . DB_CONFIG_FILE);
        return false;
    }
    
    return $config;
}

/**
 * Get database connection
 * @return PDO|false Database connection or false on failure
 */
function get_db_connection() {
    $config = get_db_config();
    if (!$config) return false;
    
    try {
        $dsn = "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4";
        $pdo = new PDO($dsn, $config['username'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        error_log("DATABASE CONNECTION ERROR: " . $e->getMessage());
        return false;
    }
}

/**
 * Initialize database tables if they don't exist
 * @return bool Success status
 */
function init_database() {
    $pdo = get_db_connection();
    if (!$pdo) return false;
    
    try {
        // Create registered_ids table
        $sql1 = "CREATE TABLE IF NOT EXISTS registered_ids (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scanned_id VARCHAR(50) NOT NULL UNIQUE,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_scanned_id (scanned_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        
        // Create rejected_ids table
        $sql2 = "CREATE TABLE IF NOT EXISTS rejected_ids (
            id INT AUTO_INCREMENT PRIMARY KEY,
            rejected_id VARCHAR(50) NOT NULL UNIQUE,
            reason TEXT NOT NULL,
            rejected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            rejected_by VARCHAR(100) DEFAULT NULL,
            INDEX idx_rejected_id (rejected_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        
        $pdo->exec($sql1);
        $pdo->exec($sql2);
        return true;
    } catch (PDOException $e) {
        error_log("DATABASE INIT ERROR: " . $e->getMessage());
        return false;
    }
}

/**
 * Get all registered IDs from database
 * @return array Array of registered IDs
 */
function get_registered_ids_from_db() {
    $pdo = get_db_connection();
    if (!$pdo) return [];
    
    try {
        $stmt = $pdo->prepare("SELECT scanned_id FROM registered_ids ORDER BY scanned_id ASC");
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_COLUMN);
        return $results ?: [];
    } catch (PDOException $e) {
        error_log("DATABASE SELECT ERROR: " . $e->getMessage());
        return [];
    }
}

/**
 * Check if ID is already registered
 * @param string $id The ID to check
 * @return bool True if already registered
 */
function is_id_registered($id) {
    $pdo = get_db_connection();
    if (!$pdo) return false;
    
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM registered_ids WHERE scanned_id = ?");
        $stmt->execute([$id]);
        return $stmt->fetchColumn() > 0;
    } catch (PDOException $e) {
        error_log("DATABASE CHECK ERROR: " . $e->getMessage());
        return false;
    }
}

/**
 * Add new ID to database
 * @param string $id The ID to register
 * @return bool Success status
 */
function add_registered_id($id) {
    $pdo = get_db_connection();
    if (!$pdo) return false;
    
    try {
        $stmt = $pdo->prepare("INSERT INTO registered_ids (scanned_id) VALUES (?)");
        $stmt->execute([$id]);
        return true;
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) { // Duplicate entry
            error_log("DATABASE DUPLICATE: ID '{$id}' already exists");
            return false;
        }
        error_log("DATABASE INSERT ERROR: " . $e->getMessage());
        return false;
    }
}

/**
 * Clear all registered IDs from database
 * @return bool Success status
 */
function clear_all_registered_ids() {
    $pdo = get_db_connection();
    if (!$pdo) return false;
    
    try {
        $stmt = $pdo->prepare("DELETE FROM registered_ids");
        $stmt->execute();
        return true;
    } catch (PDOException $e) {
        error_log("DATABASE CLEAR ERROR: " . $e->getMessage());
        return false;
    }
}

/**
 * Check if ID is rejected
 * @param string $id The ID to check
 * @return bool True if rejected
 */
function is_id_rejected($id) {
    $pdo = get_db_connection();
    if (!$pdo) return false;
    
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM rejected_ids WHERE rejected_id = ?");
        $stmt->execute([$id]);
        return $stmt->fetchColumn() > 0;
    } catch (PDOException $e) {
        error_log("DATABASE REJECTED CHECK ERROR: " . $e->getMessage());
        return false;
    }
}

/**
 * Get rejection reason for an ID
 * @param string $id The ID to get reason for
 * @return string|false Rejection reason or false if not found
 */
function get_rejected_reason($id) {
    $pdo = get_db_connection();
    if (!$pdo) return false;
    
    try {
        $stmt = $pdo->prepare("SELECT reason FROM rejected_ids WHERE rejected_id = ?");
        $stmt->execute([$id]);
        $result = $stmt->fetchColumn();
        return $result ?: false;
    } catch (PDOException $e) {
        error_log("DATABASE REJECTED REASON ERROR: " . $e->getMessage());
        return false;
    }
}

/**
 * Add new ID to rejected list
 * @param string $id The ID to reject
 * @param string $reason The rejection reason
 * @param string|null $rejected_by Optional identifier of who rejected it
 * @return bool Success status
 */
function add_rejected_id($id, $reason, $rejected_by = null) {
    $pdo = get_db_connection();
    if (!$pdo) return false;
    
    try {
        $stmt = $pdo->prepare("INSERT INTO rejected_ids (rejected_id, reason, rejected_by) VALUES (?, ?, ?)");
        $stmt->execute([$id, $reason, $rejected_by]);
        return true;
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) { // Duplicate entry
            error_log("DATABASE DUPLICATE REJECTED: ID '{$id}' already rejected");
            return false;
        }
        error_log("DATABASE REJECTED INSERT ERROR: " . $e->getMessage());
        return false;
    }
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

// Initialize database (create table if doesn't exist)
if (!init_database()) {
    send_json_response(['status' => 'error', 'message' => 'Database initialization failed.'], 500);
}

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

        if (empty($scannedId) || !preg_match(ID_REGEX, $scannedId)) {
            send_json_response(['status' => 'error', 'message' => 'Invalid request: ID has an invalid format.'], 400);
        }
        
        if (GUEST_LIST !== null && !in_array($scannedId, GUEST_LIST)) {
            send_json_response(['status' => 'id not known', 'message' => "ID '{$scannedId}' is not recognized."], 404);
        }

        // Check if ID is rejected first
        if (is_id_rejected($scannedId)) {
            $rejectionReason = get_rejected_reason($scannedId);
            send_json_response([
                'status' => 'rejected', 
                'message' => "ID '{$scannedId}' has been rejected and cannot be used for check-in.",
                'reason' => $rejectionReason ?: 'No reason provided.'
            ], 200);
        }

        if (is_id_registered($scannedId)) {
            send_json_response(['status' => 'already registered', 'message' => "ID '{$scannedId}' was already checked in."], 200);
        }

        if (add_registered_id($scannedId)) {
            send_json_response(['status' => 'ok', 'message' => "ID '{$scannedId}' checked in successfully."], 200);
        } else {
            send_json_response(['status' => 'error', 'message' => 'An unexpected error occurred while registering the ID.'], 500);
        }
        break;

    case 'registered-ids':
        if ($requestMethod !== 'GET') send_json_response(['status' => 'error', 'message' => 'Method Not Allowed.'], 405);
        $registeredIds = get_registered_ids_from_db();
        send_json_response($registeredIds, 200);
        break;

    case 'clear':
        if ($requestMethod !== 'POST') send_json_response(['status' => 'error', 'message' => 'Method Not Allowed.'], 405);
        if (clear_all_registered_ids()) {
            send_json_response(['status' => 'ok', 'message' => 'All registered IDs have been cleared.'], 200);
        } else {
            send_json_response(['status' => 'error', 'message' => 'Failed to clear the list of registered IDs.'], 500);
        }
        break;

    case 'reject':
        if ($requestMethod !== 'POST') send_json_response(['status' => 'error', 'message' => 'Method Not Allowed.'], 405);
        $requestBody = json_decode(file_get_contents('php://input'), true);
        $rejectedId = isset($requestBody['id']) ? trim($requestBody['id']) : '';
        $reason = isset($requestBody['reason']) ? trim($requestBody['reason']) : '';
        $rejectedBy = isset($requestBody['rejected_by']) ? trim($requestBody['rejected_by']) : null;

        if (empty($rejectedId) || !preg_match(ID_REGEX, $rejectedId)) {
            send_json_response(['status' => 'error', 'message' => 'Invalid request: ID has an invalid format.'], 400);
        }

        if (empty($reason)) {
            send_json_response(['status' => 'error', 'message' => 'Invalid request: Rejection reason is required.'], 400);
        }

        // Check if ID is already rejected
        if (is_id_rejected($rejectedId)) {
            send_json_response(['status' => 'error', 'message' => "ID '{$rejectedId}' is already in the rejected list."], 200);
        }

        if (add_rejected_id($rejectedId, $reason, $rejectedBy)) {
            send_json_response(['status' => 'ok', 'message' => "ID '{$rejectedId}' has been added to the rejected list."], 200);
        } else {
            send_json_response(['status' => 'error', 'message' => 'An unexpected error occurred while rejecting the ID.'], 500);
        }
        break;

    default:
        send_json_response(['status' => 'error', 'message' => 'Action not specified or invalid.'], 404);
        break;
}