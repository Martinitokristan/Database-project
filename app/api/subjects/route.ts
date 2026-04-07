import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const CreateSubjectSchema = z.object({
  course_id:    z.number().int().positive(),
  code:         z.string().min(1).max(50),
  title:        z.string().min(2).max(255),
  credit_units: z.number().int().min(1).default(3),
});

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const subjects = await query<any[]>(
    `SELECT s.*, c.course_name, d.department_name
     FROM subjects s
     JOIN courses c ON s.course_id = c.course_id
     JOIN departments d ON c.dept_id = d.dept_id
     ORDER BY c.course_name, s.code`
  );
  return json({ success: true, data: subjects });
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { course_id, code, title, credit_units } = parsed.data;

  const existing = await query<any[]>('SELECT subject_id FROM subjects WHERE code = ?', [code]);
  if (existing.length > 0) return json({ success: false, message: 'Subject code already exists.' }, 409);

  const result: any = await query(
    'INSERT INTO subjects (course_id, code, title, credit_units) VALUES (?, ?, ?, ?)',
    [course_id, code, title, credit_units]
  );
  return json({ success: true, data: { subject_id: result.insertId }, message: 'Subject created.' }, 201);
});
