import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = requireRole(req, ['student']);
  const { id } = await ctx.params;

  const subjects = await query<any[]>(
    `SELECT DISTINCT
       s.section_id, s.section_name,
       sub.subject_id, sub.code AS subject_code, sub.title AS subject_title,
       ip.first_name AS instructor_first_name, ip.last_name AS instructor_last_name,
       g.prelim_grade, g.midterm_grade, g.final_grade, g.remarks,
       ROUND((COALESCE(g.prelim_grade,0) + COALESCE(g.midterm_grade,0) + COALESCE(g.final_grade,0)) / 3, 2) AS average
     FROM enrollments e
     JOIN sections s ON e.section_id = s.section_id
     JOIN subjects sub ON s.subject_id = sub.subject_id
     LEFT JOIN profiles ip ON ip.user_id = s.instructor_id
     LEFT JOIN grades g ON g.enrollment_id = e.enrollment_id
     WHERE e.user_id = ? AND s.semester_id = ? AND e.status = 'Enrolled'
     ORDER BY sub.code`,
    [payload.user_id, id]
  );

  const result = await Promise.all(
    subjects.map(async (subj) => {
      const schedules = await query<any[]>(
        'SELECT day_of_week, start_time, end_time, room FROM schedules WHERE section_id = ? ORDER BY day_of_week, start_time',
        [subj.section_id]
      );
      return { ...subj, schedules: schedules };
    })
  );

  return json({ success: true, data: result });
});
