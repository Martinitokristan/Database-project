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

  const sql = `
    -- 1. Pre-migration: Link profiles to applicants by email for those missing applicant_id
    UPDATE profiles p
    JOIN users u ON p.user_id = u.user_id
    JOIN applicants a ON u.email = a.email
    SET p.applicant_id = a.applicant_id
    WHERE p.applicant_id IS NULL;

    -- 2. Migrate data from applicants to profiles
    UPDATE profiles p
    JOIN applicants a ON p.applicant_id = a.applicant_id
    SET 
      p.personal_email = COALESCE(p.personal_email, a.email),
      p.course_id = a.course_id,
      p.applicant_status = a.status,
      p.applied_at = a.applied_at;

    -- 3. For existing students/faculty who don't have an applicant record (e.g. seeded), 
    -- set their status to 'Enrolled' if they have a user_id.
    UPDATE profiles
    SET applicant_status = 'Enrolled'
    WHERE user_id IS NOT NULL AND applicant_status IS NULL;

    -- 4. Drop the check constraint that references applicant_id
    -- Note: some MySQL/MariaDB versions use different syntax or might not have named it.
    -- We try to drop it by name.
    ALTER TABLE profiles DROP CHECK chk_profiles_owner;

    -- 5. Clean up: Drop old foreign key and column from profiles
    ALTER TABLE profiles DROP FOREIGN KEY fk_profiles_applicant;
    ALTER TABLE profiles DROP COLUMN applicant_id;

    -- 6. Drop applicants table
    DROP TABLE applicants;
  `;

  console.log('Running recovery migration...');
  await connection.query(sql);
  console.log('Migration successful!');

  await connection.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
