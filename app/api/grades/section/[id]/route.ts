import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params;
  const sectionId = Number(id);

  if (isNaN(sectionId)) throw { status: 400, message: 'Invalid ID format.' };

  // Get aggregated averages for the section (midterm + final only, no prelim)
  const grades = await query<any[]>(
    `SELECT e.enrollment_id, e.user_id,
            p.first_name, p.last_name,
            u.email,
            AVG(g.midterm_grade) AS midterm,
            AVG(g.final_grade) AS final_grade
     FROM enrollments e
     JOIN users u ON e.user_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     LEFT JOIN subject_offerings so ON so.section_id = e.section_id
     LEFT JOIN grades g ON g.enrollment_id = e.enrollment_id AND g.offering_id = so.offering_id
     WHERE e.section_id = ? AND e.status = 'Enrolled'
     GROUP BY e.enrollment_id, e.user_id, p.first_name, p.last_name, u.email
     ORDER BY p.last_name, p.first_name`,
    [sectionId]
  );

  const mapped = grades.map(g => {
    const m = Number(g.midterm) || 0;
    const f = Number(g.final_grade) || 0;

    let parts = 0, sum = 0;
    if (m > 0) { sum += m; parts++; }
    if (f > 0) { sum += f; parts++; }

    const avg = parts > 0 ? (sum / parts) : 0;

    return {
      enrollment_id: g.enrollment_id,
      user_id: g.user_id,
      first_name: g.first_name,
      last_name: g.last_name,
      midterm_grade: m > 0 ? m.toFixed(2) : null,
      final_grade: f > 0 ? f.toFixed(2) : null,
      average: avg > 0 ? avg.toFixed(2) : '0.00',
      remarks: avg > 0 ? (avg <= 3.0 ? 'Passed' : 'Failed') : null
    };
  });

  return json({ success: true, data: mapped });
});
