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

  const [users] = await connection.query('SELECT * FROM users WHERE email = "test-apply-1775922880365@test.com"');
  console.log('USER:', JSON.stringify(users, null, 2));

  await connection.end();
}

check().catch(console.error);
