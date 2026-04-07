/**
 * Run this to create sample data (departments, courses, subjects, sections, semesters):
 *
 *   npx ts-node --project tsconfig.json database/seed-data.ts
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function seed() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST!,
    port:     Number(process.env.DB_PORT!) || 3306,
    database: process.env.DB_NAME!,
    user:     process.env.DB_USER!,
    password: process.env.DB_PASS!,
  });

  try {
    const conn = await pool.getConnection();

    // ── Departments ──────────────────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO departments (dept_id, department_name, department_head_id) VALUES
      (1, 'Computer Science', NULL),
      (2, 'Information Technology', NULL),
      (3, 'Business Administration', NULL),
      (4, 'Engineering', NULL)
    `);

    // ── Courses ──────────────────────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO courses (course_id, course_name, dept_id) VALUES
      (1, 'Bachelor of Science in Computer Science', 1),
      (2, 'Bachelor of Science in Information Technology', 2),
      (3, 'Bachelor of Science in Business Administration', 3),
      (4, 'Bachelor of Science in Computer Engineering', 4)
    `);

    // ── Subjects ──────────────────────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO subjects (subject_id, code, title, credit_units, course_id) VALUES
      (1, 'CS101', 'Introduction to Computer Science', 3, 1),
      (2, 'CS102', 'Data Structures and Algorithms', 4, 1),
      (3, 'CS201', 'Database Systems', 3, 1),
      (4, 'CS202', 'Web Development', 3, 1),
      (5, 'IT101', 'Fundamentals of Information Technology', 3, 2),
      (6, 'IT201', 'Network Administration', 4, 2),
      (7, 'BA101', 'Principles of Management', 3, 3),
      (8, 'BA102', 'Business Ethics', 3, 3),
      (9, 'CE101', 'Digital Logic Design', 4, 4),
      (10, 'CE102', 'Circuit Analysis', 4, 4)
    `);

    // ── Semesters ──────────────────────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO semesters (semester_id, term, school_year, start_date, end_date, status) VALUES
      (1, 'First Semester', '2025-2026', '2025-08-15', '2025-12-20', 'Active'),
      (2, 'Second Semester', '2025-2026', '2026-01-10', '2026-05-15', 'Upcoming')
    `);

    // ── Sections ──────────────────────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO sections (section_id, section_name, subject_id, instructor_id, semester_id, capacity) VALUES
      (1, 'CS101-A', 1, '2026-0001', 1, 30),
      (2, 'CS101-B', 1, '2026-0002', 1, 30),
      (3, 'CS102-A', 2, '2026-0001', 1, 25),
      (4, 'CS201-A', 3, '2026-0003', 1, 25),
      (5, 'IT101-A', 5, '2026-0002', 1, 35),
      (6, 'BA101-A', 7, '2026-0003', 1, 40)
    `);

    // ── Schedules ──────────────────────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO schedules (schedule_id, section_id, day_of_week, start_time, end_time, room) VALUES
      (1, 1, 'Monday', '08:00:00', '10:00:00', 'Room 101'),
      (2, 1, 'Wednesday', '08:00:00', '10:00:00', 'Room 101'),
      (3, 1, 'Friday', '08:00:00', '10:00:00', 'Room 101'),
      (4, 2, 'Monday', '10:00:00', '12:00:00', 'Room 102'),
      (5, 2, 'Wednesday', '10:00:00', '12:00:00', 'Room 102'),
      (6, 2, 'Friday', '10:00:00', '12:00:00', 'Room 102'),
      (7, 3, 'Tuesday', '14:00:00', '16:00:00', 'Room 201'),
      (8, 3, 'Thursday', '14:00:00', '16:00:00', 'Room 201'),
      (9, 4, 'Monday', '14:00:00', '16:00:00', 'Room 202'),
      (10, 4, 'Wednesday', '14:00:00', '16:00:00', 'Room 202'),
      (11, 5, 'Tuesday', '08:00:00', '10:00:00', 'Room 301'),
      (12, 5, 'Thursday', '08:00:00', '10:00:00', 'Room 301'),
      (13, 6, 'Monday', '13:00:00', '15:00:00', 'Room 401'),
      (14, 6, 'Wednesday', '13:00:00', '15:00:00', 'Room 401')
    `);

    conn.release();
    console.log('✅ Sample data seeded successfully!');
    console.log('   Departments: 4');
    console.log('   Courses: 4');
    console.log('   Subjects: 10');
    console.log('   Semesters: 2 (1 active)');
    console.log('   Sections: 6');
    console.log('   Schedules: 14');
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
