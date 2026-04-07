import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const CreateSectionSchema = z.object({
  subject_id:    z.number().int().positive(),
  instructor_id: z.string().min(1),
  semester_id:   z.number().int().positive(),
  section_name:  z.string().min(1).max(100),
  capacity:      z.number().int().min(1).default(40),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { searchParams } = req.nextUrl;
  const semesterId = searchParams.get('semester_id');

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (role === 'faculty') {
    whereClauses.push('sec.instructor_id = ?');
    params.push(payload.user_id);
  }
  if (semesterId) {
    whereClauses.push('sec.semester_id = ?');
    params.push(semesterId);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sections = await query<any[]>(
    `SELECT sec.*,
            sub.code AS subject_code, sub.title AS subject_title, sub.credit_units,
            p.first_name AS instructor_first, p.last_name AS instructor_last,
            sem.school_year, sem.term, sem.status AS semester_status,
            COUNT(e.enrollment_id) AS enrolled_count
     FROM sections sec
     JOIN subjects sub ON sec.subject_id = sub.subject_id
     JOIN users u ON sec.instructor_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     LEFT JOIN enrollments e ON e.section_id = sec.section_id AND e.status = 'Enrolled'
     ${where}
     GROUP BY sec.section_id
     ORDER BY sem.start_date DESC, sub.title`,
    params
  );

  return json({ success: true, data: sections });
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { subject_id, instructor_id, semester_id, section_name, capacity } = parsed.data;
  const result: any = await query(
    'INSERT INTO sections (subject_id, instructor_id, semester_id, section_name, capacity) VALUES (?, ?, ?, ?, ?)',
    [subject_id, instructor_id, semester_id, section_name, capacity]
  );
  return json({ success: true, data: { section_id: result.insertId }, message: 'Section created.' }, 201);
});
