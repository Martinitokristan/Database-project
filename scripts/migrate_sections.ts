import { query } from '../lib/db';

async function migrate() {
  console.log('Running migration...');
  try {
    // Check if column exists first
    const [cols]: any = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'acadtrack' 
      AND TABLE_NAME = 'sections' 
      AND COLUMN_NAME = 'is_archived'
    `);
    
    if (cols && cols.length > 0) {
      console.log('is_archived column already exists.');
    } else {
      await query(`ALTER TABLE sections ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;`);
      console.log('Successfully added is_archived to sections table.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit();
}

migrate();
