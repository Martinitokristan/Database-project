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

  const [rows] = await connection.query('SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_NAME = "profiles" AND TABLE_SCHEMA = ?', [process.env.DB_NAME]);
  console.log(JSON.stringify(rows, null, 2));

  await connection.end();
}

check().catch(console.error);
