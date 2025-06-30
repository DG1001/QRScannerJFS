# MySQL Database Setup for QR Check-in Scanner

The backend has been converted from JSON file storage to MySQL database storage for better performance, scalability, and reliability.

## Database Requirements

- MySQL 5.7+ or MariaDB 10.2+
- PHP PDO MySQL extension

## Setup Instructions

### 1. Create Database and User

Run the SQL script to set up the database:

```bash
mysql -u root -p < setup_database.sql
```

Or manually execute the commands:

```sql
-- Create database
CREATE DATABASE qr_checkin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (replace with a strong password)
CREATE USER 'qr_user'@'localhost' IDENTIFIED BY 'your_strong_password';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON qr_checkin.* TO 'qr_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Configure Database Connection

1. Copy the example config file:
   ```bash
   cp .dbconfig.example .dbconfig
   ```

2. Edit `.dbconfig` with your database credentials:
   ```json
   {
     "host": "localhost",
     "database": "qr_checkin", 
     "username": "qr_user",
     "password": "your_strong_password"
   }
   ```

3. Set proper file permissions:
   ```bash
   chmod 600 .dbconfig
   ```

### 3. Table Structure

The table will be automatically created by the PHP script, but here's the structure:

```sql
CREATE TABLE registered_ids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scanned_id VARCHAR(50) NOT NULL UNIQUE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_scanned_id (scanned_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Security Features

- **Prepared statements**: All queries use prepared statements to prevent SQL injection
- **Unique constraints**: Database-level duplicate prevention
- **Index optimization**: Fast lookups with indexed scanned_id column
- **Connection security**: PDO with proper error handling and security settings
- **Config file protection**: Database credentials stored in separate file

## Migration from JSON

If you have existing data in `registered_ids.json`, you can migrate it with this PHP script:

```php
<?php
// migrate_data.php
require_once 'qr.php';

// Read existing JSON data
$json_file = 'registered_ids.json';
if (file_exists($json_file)) {
    $json_data = file_get_contents($json_file);
    $ids = json_decode($json_data, true) ?: [];
    
    echo "Migrating " . count($ids) . " IDs...\n";
    
    $migrated = 0;
    foreach ($ids as $id) {
        if (add_registered_id($id)) {
            $migrated++;
        }
    }
    
    echo "Successfully migrated {$migrated} IDs\n";
    
    // Backup and remove old file
    rename($json_file, $json_file . '.backup');
    echo "Old JSON file backed up as {$json_file}.backup\n";
} else {
    echo "No JSON file found to migrate\n";
}
?>
```

## API Endpoints (Unchanged)

The API endpoints remain the same:
- `POST /?action=checkin` - Register a new ID
- `GET /?action=registered-ids` - Get all registered IDs  
- `POST /?action=clear` - Clear all registered IDs

## Error Handling

The system includes comprehensive error logging:
- Database connection errors
- SQL execution errors  
- Configuration file issues
- All errors are logged to PHP error log

## Performance Benefits

- **Concurrent access**: Multiple users can scan simultaneously
- **ACID compliance**: Reliable transactions
- **Scalability**: Handles large numbers of check-ins
- **Backup/restore**: Standard database backup tools
- **Reporting**: Easy to create reports with SQL queries