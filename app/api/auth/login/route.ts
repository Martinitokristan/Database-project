import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { apiHandler, json } from '@/lib/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body   = await req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Invalid credentials.' }, 422);
  }
  const { email, password } = parsed.data;

  const users = await query<any[]>(
    `SELECT u.user_id, u.email, u.password_hash, u.role_id, u.must_change_password, r.role_name 
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.email = ? LIMIT 1`,
    [email]
  );

  const user = (users as any[])[0];
  if (!user) return json({ success: false, message: 'Invalid email or password.' }, 401);

  const valid = await comparePassword(password, user.password_hash);
  if (!valid)  return json({ success: false, message: 'Invalid email or password.' }, 401);

  const token = signToken({
    user_id:              user.user_id,
    role_id:              user.role_id,
    role_name:            user.role_name,
    must_change_password: Boolean(user.must_change_password),
  });

  const cookieStore = await cookies();
  cookieStore.set(process.env.COOKIE_NAME || 'acadtrack_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  });

  return json({
    success: true,
    data: {
      user_id:              user.user_id,
      email:                user.email,
      role_name:            user.role_name,
      must_change_password: Boolean(user.must_change_password),
    },
    message: 'Login successful.',
  });
});
