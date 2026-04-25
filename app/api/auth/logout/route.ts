import { NextRequest } from 'next/server';
import { apiHandler, json } from '@/lib/middleware';
import { cookies } from 'next/headers';

export const POST = apiHandler(async (_req: NextRequest) => {
  const cookieStore = await cookies();
  cookieStore.set(process.env.COOKIE_NAME || 'acadtrack_token', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  });
  return json({ success: true, message: 'Logged out successfully.' });
});
