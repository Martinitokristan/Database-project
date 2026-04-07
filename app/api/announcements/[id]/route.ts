import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params;

  const announcements = await query<any[]>(
    'SELECT * FROM announcements WHERE announcement_id = ?',
    [id]
  );
  if (announcements.length === 0) return json({ success: false, message: 'Announcement not found.' }, 404);

  const ann = announcements[0];
  if (role !== 'admin' && ann.sender_id !== payload.user_id) {
    throw { status: 403, message: 'You can only delete your own announcements.' };
  }

  await query('DELETE FROM announcements WHERE announcement_id = ?', [id]);
  return json({ success: true, message: 'Announcement deleted.' });
});
