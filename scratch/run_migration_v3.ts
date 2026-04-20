import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  const queries = [
    // 1. Link profiles to applicants by email for those missing applicant_id
    `UPDATE profiles p
     JOIN users u ON p.user_id = u.user_id
     JOIN applicants a ON u.email = a.email
     SET p.applicant_id = a.applicant_id
     WHERE p.applicant_id IS NULL`,

    // 2. Migrate data from applicants to profiles
    `UPDATE profiles p
     JOIN applicants a ON p.applicant_id = a.applicant_id
     SET 
       p.personal_email = COALESCE(p.personal_email, a.email),
       p.course_id = a.course_id,
       p.applicant_status = a.status,
       p.applied_at = a.applied_at`,

    // 3. For existing students/faculty
    `UPDATE profiles SET applicant_status = 'Enrolled' WHERE user_id IS NOT NULL AND applicant_status IS NULL`,

    // 4. Drop check constraint (MariaDB syntax)
    `ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_owner`,

    // 5. Drop foreign key
    `ALTER TABLE profiles DROP FOREIGN KEY IF EXISTS fk_profiles_applicant`,

    // 6. Drop column
    `ALTER TABLE profiles DROP COLUMN IF EXISTS applicant_id`,

    // 7. Drop applicants table
    `DROP TABLE IF EXISTS applicants`
  ];

  for (const q of queries) {
    try {
      console.log('Running:', q.trim().split('\n')[0], '...');
      await connection.query(q);
    } catch (err) {
      console.warn('Query failed (might be ok):', err.message);
    }
  }

  console.log('Migration finished!');
  await connection.end();
}

migrate().catch(console.error);
