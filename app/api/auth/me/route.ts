import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireAuth(req);

  const users = await query<any[]>(
    `SELECT u.user_id, u.email, u.role_id, u.must_change_password, r.role_name,
            p.first_name, p.last_name, p.middle_name, p.avatar_url
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE u.user_id = ?`,
    [payload.user_id]
  );

  const user = users[0];
  if (!user) return json({ success: false, message: 'User not found.' }, 404);

  return json({
    success: true,
    data: {
      user_id:              user.user_id,
      email:                user.email,
      role_id:              user.role_id,
      role_name:            user.role_name,
      must_change_password: Boolean(user.must_change_password),
      first_name:           user.first_name,
      last_name:            user.last_name,
      middle_name:          user.middle_name,
      avatar_url:           user.avatar_url ?? null,
    },
  });
});
