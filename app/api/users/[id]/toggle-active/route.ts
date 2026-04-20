import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const users = await query<any[]>('SELECT user_id, is_active FROM users WHERE user_id = ?', [id]);
  if (users.length === 0) return json({ success: false, message: 'User not found.' }, 404);

  const newStatus = !users[0].is_active;
  await query('UPDATE users SET is_active = ? WHERE user_id = ?', [newStatus, id]);

  return json({ success: true, data: { is_active: newStatus }, message: `Account ${newStatus ? 'enabled' : 'disabled'}.` });
});
