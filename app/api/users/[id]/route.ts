import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const users = await query<any[]>(
    `SELECT u.user_id, u.email, u.role_id, u.must_change_password, u.created_at,
            r.role_name,
            p.first_name, p.last_name, p.middle_name, p.suffix,
            p.address, p.phone, p.gender, p.date_of_birth
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE u.user_id = ?`,
    [id]
  );

  if (users.length === 0) {
    return json({ success: false, message: 'User not found.' }, 404);
  }

  return json({ success: true, data: users[0] });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const users = await query<any[]>('SELECT user_id FROM users WHERE user_id = ?', [id]);
  if (users.length === 0) {
    return json({ success: false, message: 'User not found.' }, 404);
  }

  await query('UPDATE users SET is_active = FALSE WHERE user_id = ?', [id]);

  return json({ success: true, message: 'User deactivated successfully.' });
});
