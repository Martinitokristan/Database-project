import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const { searchParams } = req.nextUrl;
  const search   = searchParams.get('search') || '';
  const role     = searchParams.get('role') || '';
  const page     = parseInt(searchParams.get('page') || '1');
  const limit    = parseInt(searchParams.get('limit') || '20');
  const offset   = (page - 1) * limit;

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (search) {
    whereClauses.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR u.email LIKE ? OR u.user_id LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (role) {
    whereClauses.push('r.role_name = ?');
    params.push(role);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const users = await query<any[]>(
    `SELECT u.user_id, u.email, u.role_id, u.must_change_password, u.created_at,
            r.role_name,
            p.first_name, p.last_name, p.middle_name, p.gender, p.phone
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [{ total }] = await query<any[]>(
    `SELECT COUNT(*) AS total FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     ${where}`,
    params
  );

  return json({ success: true, data: { users, total, page, limit } });
});
