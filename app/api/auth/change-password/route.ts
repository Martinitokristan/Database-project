import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { comparePassword, hashPassword, signToken } from '@/lib/auth';
import { requireAuth, apiHandler, json } from '@/lib/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password:     z.string().min(6),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = requireAuth(req);
  const body    = await req.json();
  const parsed  = ChangePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const { current_password, new_password } = parsed.data;

  const [users] = await pool.execute(
    'SELECT * FROM users WHERE user_id = ?',
    [payload.user_id]
  ) as any;

  const user = (users as any[])[0];
  if (!user) return json({ success: false, message: 'User not found.' }, 404);

  const valid = await comparePassword(current_password, user.password_hash);
  if (!valid) return json({ success: false, message: 'Current password is incorrect.' }, 401);

  const newHash = await hashPassword(new_password);

  await pool.execute(
    'UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE user_id = ?',
    [newHash, payload.user_id]
  );

  const token = signToken({
    user_id:              payload.user_id,
    role_id:              payload.role_id,
    role_name:            payload.role_name,
    must_change_password: false,
  });

  const cookieStore = await cookies();
  cookieStore.set(process.env.COOKIE_NAME || 'acadtrack_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  });

  return json({ success: true, message: 'Password changed successfully.' });
});
