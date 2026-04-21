import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
async function run() {
  const pool = mysql.createPool({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: process.env.DB_NAME || 'acadtrack' });
  try {
    console.log("Altering table grades...");
    await pool.execute('ALTER TABLE grades ADD COLUMN is_finalized BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.execute('ALTER TABLE grades ADD COLUMN finalized_at DATETIME NULL');
    console.log("Success!");
  } catch (e: any) {
    if (e.message.includes('Duplicate column')) {
      console.log('Columns already exist.');
    } else {
      console.error('SQL ERROR:', e.message);
    }
  }
  process.exit(0);
}
run();
