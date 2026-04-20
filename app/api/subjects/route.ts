import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const CreateSubjectSchema = z.object({
  course_id:    z.number().int().positive(),
  code:         z.string().min(1).max(50),
  title:        z.string().min(2).max(255),
  credit_units: z.number().int().min(1).default(3),
  year_level:   z.enum(['1st Year','2nd Year','3rd Year','4th Year','Masteral','Doctorate','Irregular']).optional(),
  subject_type: z.enum(['Major', 'Minor']).default('Major'),
  prerequisite_id: z.number().int().nullable().optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const { searchParams } = new URL(req.url);
  const course_id = searchParams.get('course_id');

  let sql = `
    SELECT s.*, c.course_name, c.dept_id, d.department_name,
           pre.code AS prerequisite_code, pre.title AS prerequisite_title
    FROM subjects s
    JOIN courses c ON s.course_id = c.course_id
    JOIN departments d ON c.dept_id = d.dept_id
    LEFT JOIN subjects pre ON s.prerequisite_id = pre.subject_id
  `;
  const params: any[] = [];

  if (course_id) {
    sql += ' WHERE s.course_id = ?';
    params.push(course_id);
  }

  sql += ' ORDER BY c.course_name, s.code';

  const subjects = await query<any[]>(sql, params);
  return json({ success: true, data: subjects });
});


export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { course_id, code, title, credit_units, year_level, subject_type, prerequisite_id } = parsed.data;

  const existing = await query<any[]>('SELECT subject_id FROM subjects WHERE code = ?', [code]);
  if (existing.length > 0) return json({ success: false, message: 'Subject code already exists.' }, 409);

  const result: any = await query(
    'INSERT INTO subjects (course_id, code, title, credit_units, year_level, subject_type, prerequisite_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [course_id, code, title, credit_units, year_level || null, subject_type, prerequisite_id || null]
  );
  return json({ success: true, data: { subject_id: result.insertId }, message: 'Subject created.' }, 201);
});
