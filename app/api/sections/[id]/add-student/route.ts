import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const AddStudentSchema = z.object({
  user_id: z.string().min(1),
});

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;
  const body   = await req.json();
  const parsed = AddStudentSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { user_id } = parsed.data;

  const section = await query<any[]>(
    `SELECT s.*, COUNT(e.enrollment_id) AS enrolled_count
     FROM sections s
     LEFT JOIN enrollments e ON e.section_id = s.section_id AND e.status = 'Enrolled'
     WHERE s.section_id = ?
     GROUP BY s.section_id`,
    [id]
  );
  if (section.length === 0) return json({ success: false, message: 'Section not found.' }, 404);
  if (Number(section[0].enrolled_count) >= section[0].capacity) {
    return json({ success: false, message: 'Section is at full capacity.' }, 409);
  }

  const user = await query<any[]>('SELECT user_id, role_id FROM users WHERE user_id = ?', [user_id]);
  if (user.length === 0) return json({ success: false, message: 'Student not found.' }, 404);
  if (user[0].role_id !== 3) return json({ success: false, message: 'User is not a student.' }, 400);

  const existing = await query<any[]>(
    'SELECT enrollment_id FROM enrollments WHERE user_id = ? AND section_id = ?',
    [user_id, id]
  );
  if (existing.length > 0) return json({ success: false, message: 'Student is already enrolled in this section.' }, 409);

  const today = new Date().toISOString().slice(0, 10);
  const result: any = await query(
    'INSERT INTO enrollments (user_id, section_id, status, date_enrolled) VALUES (?, ?, "Enrolled", ?)',
    [user_id, id, today]
  );

  await query('INSERT INTO grades (enrollment_id) VALUES (?)', [result.insertId]);

  return json({ success: true, message: 'Student added to section.' }, 201);
});
