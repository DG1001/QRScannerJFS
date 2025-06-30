-- MySQL Database Setup for QR Check-in Scanner
-- Run this script to create the database and user

-- Create database
CREATE DATABASE IF NOT EXISTS qr_checkin 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create user (replace 'your_password' with a strong password)
CREATE USER IF NOT EXISTS 'qr_user'@'localhost' IDENTIFIED BY 'your_password';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON qr_checkin.* TO 'qr_user'@'localhost';
FLUSH PRIVILEGES;

-- Use the database
USE qr_checkin;

-- Create the table (this will also be auto-created by the PHP script)
CREATE TABLE IF NOT EXISTS registered_ids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scanned_id VARCHAR(50) NOT NULL UNIQUE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_scanned_id (scanned_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Show the created table structure
DESCRIBE registered_ids;