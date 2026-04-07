import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, apiHandler, json } from '@/lib/middleware';

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = requireAuth(req);
  const { id }  = await ctx.params;

  await query(
    'UPDATE notifications SET is_read = FALSE WHERE notification_id = ? AND user_id = ?',
    [id, payload.user_id]
  );
  return json({ success: true, message: 'Marked as unread.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = requireAuth(req);
  const { id }  = await ctx.params;

  await query(
    'DELETE FROM notifications WHERE notification_id = ? AND user_id = ?',
    [id, payload.user_id]
  );
  return json({ success: true, message: 'Notification deleted.' });
});
