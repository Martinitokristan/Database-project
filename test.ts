import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
async function run() {
  const pool = mysql.createPool({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: process.env.DB_NAME || 'acadtrack' });
  const sql = `SELECT e.enrollment_id, e.user_id,
            p.first_name, p.last_name,
            u.email,
            g.grade_id, g.prelim_grade, g.midterm_grade, g.final_grade, g.remarks, g.is_finalized,
            COALESCE(g.prelim_grade, 0) AS prelim,
            COALESCE(g.midterm_grade, 0) AS midterm,
            COALESCE(g.final_grade, 0) AS final
     FROM enrollments e
     JOIN users u ON e.user_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     JOIN subject_offerings so ON so.section_id = e.section_id
     LEFT JOIN grades g ON g.enrollment_id = e.enrollment_id AND g.offering_id = so.offering_id
     WHERE so.offering_id = 12 AND e.status = 'Enrolled'
     ORDER BY p.last_name, p.first_name`;
  try {
    const [r] = await pool.execute(sql);
    console.log("SQL Results:", r);
  } catch (e: any) {
    console.error('SQL ERROR:', e.message);
  }
  process.exit(0);
}
run();
