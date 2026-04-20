import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
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

  const sqlPath = path.join(process.cwd(), 'database', 'migration_normalize_applicants.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration...');
  await connection.query(sql);
  console.log('Migration successful!');

  await connection.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
