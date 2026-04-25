import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { percentToGrade } from '@/lib/auth';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params;
  const sectionId = Number(id);

  if (isNaN(sectionId)) throw { status: 400, message: 'Invalid ID format.' };

  // Get aggregated averages for the section across all periods
  const grades = await query<any[]>(
    `SELECT e.enrollment_id, e.user_id,
            p.first_name, p.last_name,
            u.email,
            AVG(g.prelim_grade) AS prelim,
            AVG(g.midterm_grade) AS midterm,
            AVG(g.semi_final_grade) AS semi_final,
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
    const p_grade = Number(g.prelim) || 0;
    const m_grade = Number(g.midterm) || 0;
    const s_grade = Number(g.semi_final) || 0;
    const f_grade = Number(g.final_grade) || 0;

    let parts = 0, sum = 0;
    if (p_grade > 0) { sum += p_grade; parts++; }
    if (m_grade > 0) { sum += m_grade; parts++; }
    if (s_grade > 0) { sum += s_grade; parts++; }
    if (f_grade > 0) { sum += f_grade; parts++; }

    const avgPct = parts > 0 ? (sum / parts) : 0;
    const gradeEq = avgPct > 0 ? percentToGrade(avgPct) : '—';
    const gradeVal = parseFloat(gradeEq);

    return {
      enrollment_id: g.enrollment_id,
      user_id: g.user_id,
      first_name: g.first_name,
      last_name: g.last_name,
      prelim_grade: p_grade > 0 ? p_grade.toFixed(2) : null,
      midterm_grade: m_grade > 0 ? m_grade.toFixed(2) : null,
      semi_final_grade: s_grade > 0 ? s_grade.toFixed(2) : null,
      final_grade: f_grade > 0 ? f_grade.toFixed(2) : null,
      average: gradeEq,
      remarks: avgPct > 0 ? (gradeVal <= 3.0 ? 'Passed' : 'Failed') : null
    };
  });

  return json({ success: true, data: mapped });
});
