import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = requireRole(req, ['faculty']);
  const { id } = await ctx.params;

  const sections = await query<any[]>(
    `SELECT s.section_id, s.section_name, s.capacity,
            sub.code AS subject_code, sub.title AS subject_title, sub.credit_units,
            COUNT(e.enrollment_id) AS enrolled_count
     FROM sections s
     JOIN subjects sub ON s.subject_id = sub.subject_id
     LEFT JOIN enrollments e ON e.section_id = s.section_id AND e.status = 'Enrolled'
     WHERE s.instructor_id = ? AND s.semester_id = ?
     GROUP BY s.section_id
     ORDER BY sub.code`,
    [payload.user_id, id]
  );

  const result = await Promise.all(
    sections.map(async (sec) => {
      const schedules = await query<any[]>(
        'SELECT day_of_week, start_time, end_time, room FROM schedules WHERE section_id = ? ORDER BY day_of_week, start_time',
        [sec.section_id]
      );
      return { ...sec, schedules };
    })
  );

  return json({ success: true, data: result });
});
