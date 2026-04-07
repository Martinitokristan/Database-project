/**
 * Run this to create sample student accounts:
 *
 *   npx ts-node --project tsconfig.json database/seed-students.ts
 */
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const students = [
  {
    user_id: '2026-1001',
    email: 'alice.johnson@acadtrack.edu',
    password: 'Johnson2026',
    first_name: 'Alice',
    last_name: 'Johnson',
    gender: 'Female',
    date_of_birth: '2002-05-12',
    phone: '555-0201',
    address: '101 Dorm Road, Campus City'
  },
  {
    user_id: '2026-1002',
    email: 'bob.wilson@acadtrack.edu',
    password: 'Wilson2026',
    first_name: 'Bob',
    last_name: 'Wilson',
    gender: 'Male',
    date_of_birth: '2003-08-25',
    phone: '555-0202',
    address: '102 Dorm Road, Campus City'
  },
  {
    user_id: '2026-1003',
    email: 'carol.davis@acadtrack.edu',
    password: 'Davis2026',
    first_name: 'Carol',
    last_name: 'Davis',
    gender: 'Female',
    date_of_birth: '2002-12-03',
    phone: '555-0203',
    address: '103 Dorm Road, Campus City'
  },
  {
    user_id: '2026-1004',
    email: 'david.martinez@acadtrack.edu',
    password: 'Martinez2026',
    first_name: 'David',
    last_name: 'Martinez',
    gender: 'Male',
    date_of_birth: '2003-04-18',
    phone: '555-0204',
    address: '104 Dorm Road, Campus City'
  },
  {
    user_id: '2026-1005',
    email: 'emma.brown@acadtrack.edu',
    password: 'Brown2026',
    first_name: 'Emma',
    last_name: 'Brown',
    gender: 'Female',
    date_of_birth: '2002-09-30',
    phone: '555-0205',
    address: '105 Dorm Road, Campus City'
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

    for (const s of students) {
      const hash = await bcrypt.hash(s.password, 12);

      await conn.execute(
        `INSERT IGNORE INTO users (user_id, email, password_hash, role_id, must_change_password, is_active)
         VALUES (?, ?, ?, 3, FALSE, TRUE)`,
        [s.user_id, s.email, hash]
      );

      await conn.execute(
        `INSERT IGNORE INTO profiles (user_id, first_name, middle_name, last_name, address, phone, gender, date_of_birth)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
        [s.user_id, s.first_name, s.last_name, s.address, s.phone, s.gender, s.date_of_birth]
      );

      console.log(`✅ Student seeded: ${s.first_name} ${s.last_name} (${s.email})`);
    }

    conn.release();
    console.log('\n🎓 All student accounts created!');
    console.log('Passwords are LastName + Year (e.g., Johnson2026)');
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
