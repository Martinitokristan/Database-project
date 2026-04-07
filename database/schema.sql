-- ============================================================
-- AcadTrack — Full MySQL Schema
-- Run this in phpMyAdmin or MySQL CLI against the "acadtrack" database
-- ============================================================

CREATE DATABASE IF NOT EXISTS acadtrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE acadtrack;

-- ── roles ──────────────────────────────────────────────────────
CREATE TABLE roles (
  role_id    INT AUTO_INCREMENT PRIMARY KEY,
  role_name  ENUM('Admin', 'Faculty', 'Student') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO roles (role_name) VALUES ('Admin'), ('Faculty'), ('Student');

-- ── users ──────────────────────────────────────────────────────
CREATE TABLE users (
  user_id               VARCHAR(10) PRIMARY KEY,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  password_hash         VARCHAR(255) NOT NULL,
  role_id               INT NOT NULL,
  must_change_password  BOOLEAN NOT NULL DEFAULT TRUE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- ── applicants ─────────────────────────────────────────────────
CREATE TABLE applicants (
  applicant_id  INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  course_id     INT NOT NULL,
  status        ENUM('Pending', 'Enrolled', 'Rejected') NOT NULL DEFAULT 'Pending',
  applied_at    TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── profiles ───────────────────────────────────────────────────
CREATE TABLE profiles (
  profile_id    INT AUTO_INCREMENT PRIMARY KEY,
  user_id       VARCHAR(10) NOT NULL UNIQUE,
  applicant_id  INT NULL,
  first_name    VARCHAR(50)  NOT NULL,
  middle_name   VARCHAR(50)  NULL,
  last_name     VARCHAR(50)  NOT NULL,
  suffix        VARCHAR(10)  NULL,
  address       TEXT         NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  gender        ENUM('Male','Female','Other') NOT NULL,
  date_of_birth DATE         NOT NULL,
  avatar_url    VARCHAR(255) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user      FOREIGN KEY (user_id)      REFERENCES users(user_id),
  CONSTRAINT fk_profiles_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id),
  CONSTRAINT chk_profiles_owner    CHECK (user_id IS NOT NULL OR applicant_id IS NOT NULL)
);

-- ── departments ────────────────────────────────────────────────
CREATE TABLE departments (
  dept_id             INT AUTO_INCREMENT PRIMARY KEY,
  department_name     VARCHAR(255) NOT NULL,
  department_head_id  VARCHAR(10) NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dept_head FOREIGN KEY (department_head_id) REFERENCES users(user_id)
);

-- ── courses ────────────────────────────────────────────────────
CREATE TABLE courses (
  course_id    INT AUTO_INCREMENT PRIMARY KEY,
  dept_id      INT NOT NULL,
  course_name  VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

ALTER TABLE applicants
  ADD CONSTRAINT fk_applicants_course FOREIGN KEY (course_id) REFERENCES courses(course_id);

-- ── subjects ───────────────────────────────────────────────────
CREATE TABLE subjects (
  subject_id   INT AUTO_INCREMENT PRIMARY KEY,
  course_id    INT NOT NULL,
  code         VARCHAR(50) NOT NULL UNIQUE,
  title        VARCHAR(255) NOT NULL,
  credit_units INT NOT NULL DEFAULT 3,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subjects_course FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

-- ── semesters ──────────────────────────────────────────────────
CREATE TABLE semesters (
  semester_id    INT AUTO_INCREMENT PRIMARY KEY,
  school_year    VARCHAR(20) NOT NULL,
  term           VARCHAR(50) NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  midterm_deadline DATE NULL,
  final_deadline   DATE NULL,
  status           ENUM('Active', 'Inactive', 'Closed') NOT NULL DEFAULT 'Inactive',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── sections ───────────────────────────────────────────────────
CREATE TABLE sections (
  section_id     INT AUTO_INCREMENT PRIMARY KEY,
  subject_id     INT NOT NULL,
  instructor_id  VARCHAR(10) NOT NULL,
  semester_id    INT NOT NULL,
  section_name   VARCHAR(100) NOT NULL,
  capacity       INT NOT NULL DEFAULT 40,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sections_subject    FOREIGN KEY (subject_id)    REFERENCES subjects(subject_id),
  CONSTRAINT fk_sections_instructor FOREIGN KEY (instructor_id) REFERENCES users(user_id),
  CONSTRAINT fk_sections_semester   FOREIGN KEY (semester_id)   REFERENCES semesters(semester_id)
);

-- ── schedules ──────────────────────────────────────────────────
CREATE TABLE schedules (
  schedule_id  INT AUTO_INCREMENT PRIMARY KEY,
  section_id   INT NOT NULL,
  day_of_week  ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  room         VARCHAR(100) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedules_section FOREIGN KEY (section_id) REFERENCES sections(section_id)
);

-- ── enrollments ────────────────────────────────────────────────
CREATE TABLE enrollments (
  enrollment_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id        VARCHAR(10) NOT NULL,
  section_id     INT NOT NULL,
  status         ENUM('Pending', 'Enrolled', 'Rejected') NOT NULL DEFAULT 'Enrolled',
  date_enrolled  DATE NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_enrollments_user    FOREIGN KEY (user_id)    REFERENCES users(user_id),
  CONSTRAINT fk_enrollments_section FOREIGN KEY (section_id) REFERENCES sections(section_id),
  CONSTRAINT uq_enrollment          UNIQUE (user_id, section_id)
);

-- ── grades ─────────────────────────────────────────────────────
CREATE TABLE grades (
  grade_id       INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id  INT NOT NULL UNIQUE,
  prelim_grade   DECIMAL(5,2) NULL,
  midterm_grade  DECIMAL(5,2) NULL,
  final_grade    DECIMAL(5,2) NULL,
  remarks        ENUM('Passed', 'Failed', 'Incomplete') NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_grades_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(enrollment_id)
);

-- ── announcements ──────────────────────────────────────────────
CREATE TABLE announcements (
  announcement_id  INT AUTO_INCREMENT PRIMARY KEY,
  sender_id        VARCHAR(10) NOT NULL,
  title            VARCHAR(255) NOT NULL,
  content          TEXT NOT NULL,
  type             ENUM('General', 'Section') NOT NULL DEFAULT 'General',
  section_id       INT NULL,
  target_role_id   INT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_announcements_sender  FOREIGN KEY (sender_id)      REFERENCES users(user_id),
  CONSTRAINT fk_announcements_section FOREIGN KEY (section_id)     REFERENCES sections(section_id),
  CONSTRAINT fk_announcements_role    FOREIGN KEY (target_role_id) REFERENCES roles(role_id)
);

-- ── notifications ──────────────────────────────────────────────
CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id         VARCHAR(10) NOT NULL,
  sender_id       VARCHAR(10) NULL,
  title           VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user   FOREIGN KEY (user_id)   REFERENCES users(user_id),
  CONSTRAINT fk_notifications_sender FOREIGN KEY (sender_id) REFERENCES users(user_id)
);

-- ============================================================
-- Seed: Initial admin account
-- Password: Admin2026  (must_change_password = FALSE for admin)
-- Run bcrypt hash generation in Node.js first, then update below
-- ============================================================
-- INSERT INTO users (user_id, email, password_hash, role_id, must_change_password, is_active)
-- VALUES ('2026-0000', 'admin@acadtrack.edu', '<bcrypt_hash_here>', 1, FALSE, TRUE);
--
-- INSERT INTO profiles (user_id, first_name, last_name, address, phone, gender, date_of_birth)
-- VALUES ('2026-0000', 'System', 'Administrator', 'Campus', '0000000000', 'Other', '1990-01-01');
