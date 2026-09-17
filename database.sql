-- Create Database
CREATE DATABASE IF NOT EXISTS `post`;
USE `post`;

-- Create Projects Table
CREATE TABLE IF NOT EXISTS `projects` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL UNIQUE,
    `url` VARCHAR(500) NOT NULL,
    `api_url` VARCHAR(500) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Tickets Table
CREATE TABLE IF NOT EXISTS `tickets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `project_id` INT NOT NULL,
    `ticket_no` VARCHAR(100) NOT NULL UNIQUE,
    `type` ENUM('bug', 'feature', 'enhancement', 'documentation') NOT NULL DEFAULT 'bug',
    `platform` VARCHAR(255) NOT NULL,
    `module` VARCHAR(255) NOT NULL,
    `submodule` VARCHAR(255) NOT NULL,
    `date_detected` DATE NOT NULL,
    `current_state` LONGTEXT NOT NULL,
    `desired_state` LONGTEXT NOT NULL,
    `purpose` LONGTEXT NOT NULL,
    `status` ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `remarks` LONGTEXT,
    `page_url` VARCHAR(500) NOT NULL,
    `reporter_name` VARCHAR(255) NOT NULL,
    `reporter_role` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    INDEX `idx_ticket_no` (`ticket_no`),
    INDEX `idx_status` (`status`),
    INDEX `idx_type` (`type`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_project_id` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Evidence Table
CREATE TABLE IF NOT EXISTS `evidence` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `ticket_id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `size` INT NOT NULL COMMENT 'File size in bytes',
    `uploaded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `url` VARCHAR(500) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
    INDEX `idx_ticket_id` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Create view for easy querying (returns data similar to your GET response)
CREATE OR REPLACE VIEW `tickets_view` AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.url as project_url,
    p.api_url,
    t.id,
    t.ticket_no,
    t.type,
    t.platform,
    t.module,
    t.submodule,
    t.date_detected,
    t.current_state,
    t.desired_state,
    t.purpose,
    t.status,
    t.remarks,
    t.page_url,
    t.reporter_name,
    t.reporter_role,
    t.created_at,
    t.updated_at
FROM tickets t
LEFT JOIN projects p ON t.project_id = p.id
ORDER BY t.created_at DESC;

-- Optional: Insert sample data (commented out)
-- INSERT INTO `projects` (`name`, `url`, `api_url`) VALUES ('MoBilis', 'https://mobilis.brigada.net', 'https://api.mobilis.brigada.net');
