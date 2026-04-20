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

  const [rows] = await connection.query('DESCRIBE profiles');
  console.log('--- PROFILES ---');
  console.log(JSON.stringify(rows, null, 2));

  const [rows2] = await connection.query('DESCRIBE applicants');
  console.log('--- APPLICANTS ---');
  console.log(JSON.stringify(rows2, null, 2));

  await connection.end();
}

check().catch(console.error);
