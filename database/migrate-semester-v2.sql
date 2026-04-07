-- Migration: Semester v2 + Notifications
-- Run once against your MySQL database

ALTER TABLE semesters
  ADD COLUMN midterm_deadline DATE NULL AFTER end_date,
  ADD COLUMN final_deadline   DATE NULL AFTER midterm_deadline,
  MODIFY COLUMN status ENUM('Active', 'Inactive', 'Closed') NOT NULL DEFAULT 'Inactive';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id VARCHAR(10) NULL;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id         VARCHAR(10) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);
