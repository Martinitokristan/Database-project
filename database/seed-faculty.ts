/**
 * Run this to create sample faculty accounts:
 *
 *   npx ts-node --project tsconfig.json database/seed-faculty.ts
 */
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const faculty = [
  {
    user_id: '2026-0001',
    email: 'john.smith@acadtrack.edu',
    password: 'Smith2026',
    first_name: 'John',
    last_name: 'Smith',
    gender: 'Male',
    date_of_birth: '1985-03-15',
    phone: '555-0101',
    address: '123 Faculty Lane, Campus City'
  },
  {
    user_id: '2026-0002',
    email: 'maria.garcia@acadtrack.edu',
    password: 'Garcia2026',
    first_name: 'Maria',
    last_name: 'Garcia',
    gender: 'Female',
    date_of_birth: '1988-07-22',
    phone: '555-0102',
    address: '456 Academic Ave, Campus City'
  },
  {
    user_id: '2026-0003',
    email: 'robert.chen@acadtrack.edu',
    password: 'Chen2026',
    first_name: 'Robert',
    last_name: 'Chen',
    gender: 'Male',
    date_of_birth: '1990-11-08',
    phone: '555-0103',
    address: '789 Professor Blvd, Campus City'
  }
];

async function seed() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST!,
    port:     Number(process.env.DB_PORT!) || 3306,
    database: process.env.DB_NAME!,
    user:     process.env.DB_USER!,
    password: process.env.DB_PASS!,
  });

  try {
    const conn = await pool.getConnection();

    for (const f of faculty) {
      const hash = await bcrypt.hash(f.password, 12);

      await conn.execute(
        `INSERT IGNORE INTO users (user_id, email, password_hash, role_id, must_change_password, is_active)
         VALUES (?, ?, ?, 2, FALSE, TRUE)`,
        [f.user_id, f.email, hash]
      );

      await conn.execute(
        `INSERT IGNORE INTO profiles (user_id, first_name, middle_name, last_name, address, phone, gender, date_of_birth)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
        [f.user_id, f.first_name, f.last_name, f.address, f.phone, f.gender, f.date_of_birth]
      );

      console.log(`✅ Faculty seeded: ${f.first_name} ${f.last_name} (${f.email})`);
    }

    conn.release();
    console.log('\n🎓 All faculty accounts created!');
    console.log('Passwords are LastName + Year (e.g., Smith2026)');
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
