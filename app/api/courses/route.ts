import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const CreateCourseSchema = z.object({
  dept_id:     z.number().int().positive(),
  course_name: z.string().min(2).max(255),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const dept_id = searchParams.get('dept_id');

  let sql = `
    SELECT c.*, d.department_name
    FROM courses c
    JOIN departments d ON c.dept_id = d.dept_id
  `;
  const params: any[] = [];

  if (dept_id) {
    sql += ' WHERE c.dept_id = ?';
    params.push(dept_id);
  }

  sql += ' ORDER BY d.department_name, c.course_name';

  const courses = await query<any[]>(sql, params);
  return json({ success: true, data: courses });
});


export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { dept_id, course_name } = parsed.data;
  const result: any = await query(
    'INSERT INTO courses (dept_id, course_name) VALUES (?, ?)',
    [dept_id, course_name]
  );
  return json({ success: true, data: { course_id: result.insertId }, message: 'Course created.' }, 201);
});
