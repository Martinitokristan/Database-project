import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { requireRole, apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const CreateSectionSchema = z.object({
  semester_id:   z.number().int().positive(),
  section_name:  z.string().min(1).max(100),
  year_level:    z.enum(['1st Year','2nd Year','3rd Year','4th Year','Masteral','Doctorate','Irregular']).optional(),
  capacity:      z.number().int().min(1).default(40),
  // Optional: Auto-create offering
  subject_id:    z.number().int().positive().optional(),
  instructor_id: z.string().optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  
  const { searchParams } = req.nextUrl;
  const semesterId = searchParams.get('semester_id');
  const limitParam = searchParams.get('limit');

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (semesterId) {
    whereClauses.push('sec.semester_id = ?');
    params.push(semesterId);
  }

  // Faculty only see sections they have an offering in
  if (role === 'faculty') {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM subject_offerings so
      WHERE so.section_id = sec.section_id
        AND so.instructor_id = ?
    )`);
    params.push(payload.user_id);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const limit = limitParam ? `LIMIT ${parseInt(limitParam, 10)}` : '';

  const sections = await query<any[]>(
    `SELECT sec.*,
            sem.school_year, sem.term, sem.status AS semester_status,
            COUNT(DISTINCT e.enrollment_id) AS enrolled_count,
            (SELECT GROUP_CONCAT(sub.code SEPARATOR ', ')
             FROM subject_offerings so
             JOIN subjects sub ON so.subject_id = sub.subject_id
             WHERE so.section_id = sec.section_id) as subject_codes
     FROM sections sec
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     LEFT JOIN enrollments e ON e.section_id = sec.section_id AND e.status = 'Enrolled'
     ${where}
     GROUP BY sec.section_id
     ORDER BY sem.school_year DESC, sec.section_name
     ${limit}`,
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
  
  const { semester_id, section_name, year_level, capacity, subject_id, instructor_id } = parsed.data;

  // Use a transaction for atomic creation of section + offering
  const result = await transaction(async (conn) => {
    // 1. Create the section shell
    const [secRes] = await conn.execute(
      'INSERT INTO sections (semester_id, section_name, year_level, capacity) VALUES (?, ?, ?, ?)',
      [semester_id, section_name, year_level || null, capacity]
    ) as any;
    const newSectionId = secRes.insertId;

    // 2. If subject_id provided, create the offering
    if (subject_id && instructor_id) {
      await conn.execute(
        'INSERT INTO subject_offerings (section_id, subject_id, instructor_id) VALUES (?, ?, ?)',
        [newSectionId, subject_id, instructor_id]
      );
    }

    return { section_id: newSectionId };
  });

  return json({ success: true, data: result, message: 'Section created successfully.' }, 201);
});
