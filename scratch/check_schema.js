require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    console.log('--- assessments ---');
    const [a] = await pool.execute('DESCRIBE assessments');
    console.table(a);
    
    console.log('--- schedules ---');
    const [s] = await pool.execute('DESCRIBE schedules');
    console.table(s);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
