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

  // Check section capacity
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

  // Check user is a student
  const user = await query<any[]>('SELECT user_id, role_id FROM users WHERE user_id = ?', [user_id]);
  if (user.length === 0) return json({ success: false, message: 'Student not found.' }, 404);
  if (user[0].role_id !== 3) return json({ success: false, message: 'User is not a student.' }, 400);

  // Prerequisite check — evaluate all offerings in this section
  const offerings = await query<any[]>(
    `SELECT so.offering_id, sub.subject_id, sub.prerequisite_id,
            pre.code AS pre_code, pre.title AS pre_title
     FROM subject_offerings so
     JOIN subjects sub ON so.subject_id = sub.subject_id
     LEFT JOIN subjects pre ON sub.prerequisite_id = pre.subject_id
     WHERE so.section_id = ? AND sub.prerequisite_id IS NOT NULL`,
    [id]
  );

  for (const offering of offerings) {
    const passed = await query<any[]>(
      `SELECT g.remarks FROM grades g
       JOIN enrollments e ON g.enrollment_id = e.enrollment_id
       JOIN subject_offerings so ON so.section_id = e.section_id
       WHERE e.user_id = ? AND so.subject_id = ? AND g.remarks = 'Passed'
       LIMIT 1`,
      [user_id, offering.prerequisite_id]
    );
    if (passed.length === 0) {
      return json({
        success: false,
        message: `Prerequisite not met. Student must pass ${offering.pre_code} — ${offering.pre_title} first.`
      }, 403);
    }
  }

  // Check not already enrolled
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
  const enrollmentId = result.insertId;

  const sofferings = await query<any[]>('SELECT offering_id FROM subject_offerings WHERE section_id = ?', [id]);
  for (const offering of sofferings) {
    await query('INSERT INTO grades (enrollment_id, offering_id) VALUES (?, ?)', [enrollmentId, offering.offering_id]);
  }

  return json({ success: true, message: 'Student added to section.' }, 201);
});
