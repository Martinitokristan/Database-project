import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [profiles] = await connection.query('SELECT * FROM profiles WHERE user_id = "2026-0012"');
  console.log('PROFILE:', JSON.stringify(profiles, null, 2));

  await connection.end();
}

check().catch(console.error);
