import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireAuth(req);
  try {
    const rows = await query<any[]>(
      `SELECT n.notification_id, n.title, n.message, n.is_read, n.created_at,
              n.sender_id,
              sp.first_name  AS sender_first,
              sp.last_name   AS sender_last,
              sp.avatar_url  AS sender_avatar,
              sr.role_name   AS sender_role
       FROM notifications n
       LEFT JOIN users  su ON su.user_id  = n.sender_id
       LEFT JOIN profiles sp ON sp.user_id = n.sender_id
       LEFT JOIN roles    sr ON sr.role_id  = su.role_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [payload.user_id]
    );
    return json({ success: true, data: rows });
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return json({ success: true, data: [] });
    throw err;
  }
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const payload = requireAuth(req);
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [payload.user_id]);
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return json({ success: true, message: 'No table.' });
    throw err;
  }
  return json({ success: true, message: 'All notifications marked as read.' });
});
