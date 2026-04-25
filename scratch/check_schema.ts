import pool from './lib/db';

async function check() {
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
