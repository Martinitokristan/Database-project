import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = requireRole(req, ['faculty']);
  const { id } = await ctx.params;

  const sections = await query<any[]>(
    `SELECT so.offering_id, so.subject_id, s.section_id, s.section_name, s.capacity,
            sub.code AS subject_code, sub.title AS subject_title, sub.credit_units, sub.subject_type,
            COUNT(e.enrollment_id) AS enrolled_count
     FROM subject_offerings so
     JOIN sections s ON so.section_id = s.section_id
     JOIN subjects sub ON so.subject_id = sub.subject_id
     LEFT JOIN enrollments e ON e.section_id = s.section_id AND e.status = 'Enrolled'
     WHERE so.instructor_id = ? AND s.semester_id = ?
     GROUP BY so.offering_id
     ORDER BY sub.code`,
    [payload.user_id, id]
  );

  const result = await Promise.all(
    sections.map(async (sec) => {
      const schedules = await query<any[]>(
        'SELECT day_of_week, start_time, end_time, room FROM schedules WHERE offering_id = ? ORDER BY day_of_week, start_time',
        [sec.offering_id]
      );
      return { ...sec, schedules };
    })
  );

  return json({ success: true, data: result });
});
