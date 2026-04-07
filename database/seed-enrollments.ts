/**
 * Run this to enroll students in sections and create grades:
 *
 *   npx ts-node --project tsconfig.json database/seed-enrollments.ts
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

    // ── Enroll students in sections ───────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO enrollments (enrollment_id, user_id, section_id, status, date_enrolled) VALUES
      (1, '2026-1001', 1, 'Enrolled', '2025-08-15'),
      (2, '2026-1002', 1, 'Enrolled', '2025-08-15'),
      (3, '2026-1003', 2, 'Enrolled', '2025-08-15'),
      (4, '2026-1004', 3, 'Enrolled', '2025-08-15'),
      (5, '2026-1005', 4, 'Enrolled', '2025-08-15'),
      (6, '2026-1001', 5, 'Enrolled', '2025-08-16'),
      (7, '2026-1002', 6, 'Enrolled', '2025-08-16')
    `);

    // ── Create grade records ───────────────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO grades (enrollment_id, prelim_grade, midterm_grade, final_grade, remarks) VALUES
      (1, 85.5, 88.0, 92.5, 'Passed'),
      (2, 78.0, 82.5, 85.0, 'Passed'),
      (3, 91.0, 89.5, 94.0, 'Passed'),
      (4, 76.5, 79.0, NULL, 'Incomplete'),
      (5, 88.0, 90.5, 87.0, 'Passed'),
      (6, 83.0, 85.5, NULL, 'Incomplete'),
      (7, 79.5, 81.0, NULL, 'Incomplete')
    `);

    // ── Create sample announcements ───────────────────────────────────
    await conn.execute(`
      INSERT IGNORE INTO announcements (announcement_id, sender_id, title, content, type, section_id, target_role_id, created_at) VALUES
      (1, '2026-0000', 'Welcome to AcadTrack!', 'Welcome to the new academic year. Please check your schedules and prepare for classes.', 'General', NULL, NULL, '2025-08-01'),
      (2, '2026-0001', 'CS101 First Meeting', 'Our first CS101 class will cover the course syllabus and introduction to programming concepts.', 'Section', 1, NULL, '2025-08-10'),
      (3, '2026-0002', 'Office Hours', 'I will be available for consultation every Tuesday and Thursday from 2-4 PM.', 'Section', 2, NULL, '2025-08-12'),
      (4, '2026-0000', 'Midterm Schedule', 'Midterm examinations will begin on October 15. Please prepare accordingly.', 'General', NULL, 3, '2025-09-20'),
      (5, '2026-0003', 'Project Deadline', 'Reminder: Database project proposals are due next Friday.', 'Section', 4, NULL, '2025-08-14')
    `);

    conn.release();
    console.log('✅ Enrollments and sample data created!');
    console.log('   Enrollments: 7');
    console.log('   Grades: 7 (some incomplete for testing)');
    console.log('   Announcements: 5');
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
