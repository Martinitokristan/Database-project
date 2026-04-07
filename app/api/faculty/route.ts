import { NextRequest } from 'next/server';
import { transaction } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';
import { z } from 'zod';

const CreateFacultySchema = z.object({
  first_name:    z.string().min(1).max(100),
  middle_name:   z.string().max(100).optional().nullable(),
  last_name:     z.string().min(1).max(100),
  email:         z.string().email(),
  gender:        z.enum(['Male', 'Female', 'Other']),
  date_of_birth: z.string().min(1),
  phone:         z.string().min(7).max(20),
  address:       z.string().min(1),
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateFacultySchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const { first_name, middle_name, last_name, email, gender, date_of_birth, phone, address } = parsed.data;

  const userId = await transaction(async (conn) => {
    const year = new Date().getFullYear();
    const [rows] = await conn.execute(
      'SELECT COUNT(*) AS cnt FROM users WHERE user_id LIKE ?',
      [`${year}-%`]
    ) as any;
    const count  = (rows as any[])[0].cnt;
    const padded = String(count + 1).padStart(4, '0');
    const newUserId = `${year}-${padded}`;

    const plain  = generateDefaultPassword(last_name);
    const hashed = await hashPassword(plain);

    await conn.execute(
      'INSERT INTO users (user_id, email, password_hash, role_id, must_change_password) VALUES (?, ?, ?, 2, TRUE)',
      [newUserId, email, hashed]
    );

    await conn.execute(
      `INSERT INTO profiles (user_id, first_name, middle_name, last_name, address, phone, gender, date_of_birth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newUserId, first_name, middle_name ?? null, last_name, address, phone, gender, date_of_birth]
    );

    return newUserId;
  });

  return json({ success: true, data: { user_id: userId }, message: 'Faculty member created.' }, 201);
});
