import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const { searchParams } = req.nextUrl;
  const search     = searchParams.get('search') || '';
  const role       = searchParams.get('role') || '';
  const year_level = searchParams.get('year_level') || '';
  const page       = parseInt(searchParams.get('page') || '1');
  const limit      = parseInt(searchParams.get('limit') || '20');
  const offset     = (page - 1) * limit;

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
  if (year_level) {
    whereClauses.push('p.year_level = ?');
    params.push(year_level);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const users = await query<any[]>(
    `SELECT u.user_id, u.email, u.role_id, u.must_change_password, u.is_active, u.created_at,
            r.role_name,
            p.first_name, p.last_name, p.middle_name, p.suffix,
            p.gender, p.phone, p.address, p.date_of_birth,
            p.year_level, p.academic_status,
            e.section_id
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     LEFT JOIN enrollments e ON e.user_id = u.user_id
       AND e.enrollment_id = (SELECT MAX(enrollment_id) FROM enrollments WHERE user_id = u.user_id)
     ${where}
     ORDER BY p.last_name ASC, p.first_name ASC
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
