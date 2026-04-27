import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const { searchParams } = req.nextUrl;
  const search     = searchParams.get('search') || '';
  const role       = searchParams.get('role') || '';
  const year_level = searchParams.get('year_level') || '';
  const dept_id    = searchParams.get('dept_id') || '';
  const limitParam = searchParams.get('limit');
  const noLimit    = limitParam === '0' || limitParam === 'all';
  const page       = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit      = noLimit ? 0 : Math.max(1, Math.min(100, parseInt(limitParam || '20') || 20));
  const offset     = (page - 1) * (noLimit ? 0 : limit);

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
    whereClauses.push('yl.level_name = ?');
    params.push(year_level);
  }
  if (dept_id) {
    whereClauses.push('p.dept_id = ?');
    params.push(dept_id);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const users = await query<any[]>(
    `SELECT u.user_id, u.email, u.role_id, u.must_change_password, u.is_active, u.created_at,
            r.role_name,
            p.first_name, p.last_name, p.middle_name, p.suffix,
            p.gender, p.phone, p.address, p.date_of_birth,
            p.dept_id, d.department_name,
            yl.level_name AS year_level, sas.academic_status,
            e.section_id
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     LEFT JOIN departments d ON p.dept_id = d.dept_id
     LEFT JOIN (
       SELECT s1.* FROM student_academic_status s1
       JOIN (SELECT user_id, MAX(status_id) as max_id FROM student_academic_status GROUP BY user_id) s2
       ON s1.status_id = s2.max_id
     ) sas ON sas.user_id = u.user_id
     LEFT JOIN year_levels yl ON sas.year_level_id = yl.year_level_id
     LEFT JOIN (
       SELECT e1.* FROM enrollments e1
       JOIN (SELECT user_id, MAX(enrollment_id) as max_id FROM enrollments GROUP BY user_id) e2
       ON e1.enrollment_id = e2.max_id
     ) e ON e.user_id = u.user_id
     ${where}
     ORDER BY p.last_name ASC, p.first_name ASC
     ${noLimit ? '' : `LIMIT ${Number(limit)} OFFSET ${Number(offset)}`}`,
    params
  );

  const totalRows = await query<any[]>(
    `SELECT COUNT(*) AS total FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     LEFT JOIN (
       SELECT s1.* FROM student_academic_status s1
       JOIN (SELECT user_id, MAX(status_id) as max_id FROM student_academic_status GROUP BY user_id) s2
       ON s1.status_id = s2.max_id
     ) sas ON sas.user_id = u.user_id
     LEFT JOIN year_levels yl ON sas.year_level_id = yl.year_level_id
     ${where}`,
    params
  );

  const total = Number(totalRows[0]?.total || 0);

  return json({ success: true, data: { users, total, page, limit } });
});
