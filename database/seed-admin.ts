/**
 * Run this once to create the initial Admin account:
 *
 *   npx ts-node --project tsconfig.json database/seed-admin.ts
 *
 * Or add to package.json: "seed": "ts-node database/seed-admin.ts"
 */
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const ADMIN_EMAIL    = 'admin@acadtrack.edu';
const ADMIN_PASSWORD = 'Admin@2026';
const ADMIN_ID       = '2026-0000';

async function seed() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST!,
    port:     Number(process.env.DB_PORT!) || 3306,
    database: process.env.DB_NAME!,
    user:     process.env.DB_USER!,
    password: process.env.DB_PASS!,
  });

  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const conn = await pool.getConnection();

    await conn.execute(
      `INSERT IGNORE INTO users (user_id, email, password_hash, role_id, must_change_password, is_active)
       VALUES (?, ?, ?, 1, FALSE, TRUE)`,
      [ADMIN_ID, ADMIN_EMAIL, hash]
    );

    await conn.execute(
      `INSERT IGNORE INTO profiles (user_id, first_name, last_name, address, phone, gender, date_of_birth)
       VALUES (?, 'System', 'Administrator', 'Campus', '0000000000', 'Other', '1990-01-01')`,
      [ADMIN_ID]
    );

    conn.release();
    console.log('✅ Admin seeded successfully!');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   ID:       ${ADMIN_ID}`);
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
