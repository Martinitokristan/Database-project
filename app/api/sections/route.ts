import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { requireRole, apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const CreateSectionSchema = z.object({
  semester_id:   z.number().int().positive(),
  section_name:  z.string().min(1).max(100),
  year_level:    z.enum(['1st Year','2nd Year','3rd Year','4th Year','Masteral','Doctorate','Irregular']).optional(),
  capacity:      z.number().int().min(1).default(40),
  course_id:     z.number().int().positive().optional(),
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
  const courseId   = searchParams.get('course_id');
  const deptId     = searchParams.get('dept_id');
  const yearLevelId = searchParams.get('year_level_id');
  const limit      = searchParams.get('limit') ? `LIMIT ${Number(searchParams.get('limit'))}` : '';

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (semesterId) {
    whereClauses.push('sec.semester_id = ?');
    params.push(semesterId);
  }
  if (courseId) {
    whereClauses.push('sec.course_id = ?');
    params.push(courseId);
  }
  if (deptId) {
    whereClauses.push('c.dept_id = ?');
    params.push(deptId);
  }
  if (yearLevelId) {
    whereClauses.push('sec.year_level_id = ?');
    params.push(yearLevelId);
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

  const sections = await query<any[]>(
    `SELECT sec.*, yl.level_name AS year_level,
            sem.school_year, sem.term, sem.status AS semester_status,
            COUNT(DISTINCT e.enrollment_id) AS enrolled_count,
            (SELECT GROUP_CONCAT(sub.code SEPARATOR ', ')
             FROM subject_offerings so
             JOIN subjects sub ON so.subject_id = sub.subject_id
             WHERE so.section_id = sec.section_id) as subject_codes,
            c.course_name,
            d.department_name
     FROM sections sec
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     LEFT JOIN courses c ON sec.course_id = c.course_id
     LEFT JOIN departments d ON c.dept_id = d.dept_id
     LEFT JOIN year_levels yl ON sec.year_level_id = yl.year_level_id
     LEFT JOIN enrollments e ON e.section_id = sec.section_id AND e.status = 'Enrolled'
     ${where}
     GROUP BY sec.section_id, yl.level_name, sem.school_year, sem.term, sem.status,
              sec.section_name, sec.semester_id, sec.year_level_id, sec.capacity, sec.is_archived, sec.created_at,
              c.course_name, d.department_name
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
  
  const { semester_id, section_name, year_level, capacity, course_id, subject_id, instructor_id } = parsed.data;

  try {
    const result = await transaction(async (conn) => {
    // 1. Resolve year_level_id if provided
    let yearLevelId = null;
    if (year_level) {
      const [ylRows] = await conn.execute('SELECT year_level_id FROM year_levels WHERE level_name = ?', [year_level]) as any;
      if (ylRows.length > 0) yearLevelId = ylRows[0].year_level_id;
    }

    // 2. Create section
    const [secRes] = await conn.execute(
      'INSERT INTO sections (semester_id, section_name, year_level_id, capacity, course_id) VALUES (?, ?, ?, ?, ?)',
      [semester_id, section_name, yearLevelId, capacity, course_id || null]
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
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return json({ success: false, message: 'A section with this name already exists in this semester.' }, 409);
    }
    throw error;
  }
});
