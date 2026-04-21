import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireRole(req, ['student']);

  const grades = await query<any[]>(
    `SELECT g.grade_id, g.midterm_grade, g.final_grade, g.remarks, g.offering_id,
            e.enrollment_id, e.date_enrolled,
            sec.section_name,
            sub.code AS subject_code, sub.title AS subject_title, sub.credit_units, sub.subject_type,
            p.first_name AS instructor_first, p.last_name AS instructor_last,
            sem.school_year, sem.term,
            ROUND((COALESCE(g.midterm_grade,0) + COALESCE(g.final_grade,0)) / 2, 2) AS average
     FROM grades g
     JOIN enrollments e ON g.enrollment_id = e.enrollment_id
     JOIN subject_offerings so ON g.offering_id = so.offering_id
     JOIN sections sec ON e.section_id = sec.section_id
     JOIN subjects sub ON so.subject_id = sub.subject_id
     JOIN users u ON so.instructor_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     WHERE e.user_id = ? AND e.status = 'Enrolled'
     ORDER BY sem.start_date DESC, sub.title`,
    [payload.user_id]
  );

  return json({ success: true, data: grades });
});
