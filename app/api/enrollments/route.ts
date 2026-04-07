import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const { searchParams } = req.nextUrl;
  const status    = searchParams.get('status') || '';
  const sectionId = searchParams.get('section_id') || '';
  const page      = parseInt(searchParams.get('page') || '1');
  const limit     = parseInt(searchParams.get('limit') || '30');
  const offset    = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (status) { whereClauses.push('e.status = ?'); params.push(status); }
  if (sectionId) { whereClauses.push('e.section_id = ?'); params.push(sectionId); }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const enrollments = await query<any[]>(
    `SELECT e.*,
            p.first_name, p.last_name, p.middle_name,
            u.email,
            sec.section_name,
            sub.code AS subject_code, sub.title AS subject_title,
            sem.school_year, sem.term
     FROM enrollments e
     JOIN users u ON e.user_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     JOIN sections sec ON e.section_id = sec.section_id
     JOIN subjects sub ON sec.subject_id = sub.subject_id
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     ${where}
     ORDER BY e.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [{ total }] = await query<any[]>(
    `SELECT COUNT(*) AS total FROM enrollments e ${where}`,
    params
  );

  return json({ success: true, data: { enrollments, total, page, limit } });
});
