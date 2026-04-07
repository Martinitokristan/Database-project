import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireRole(req, ['student']);

  const enrollments = await query<any[]>(
    `SELECT e.enrollment_id, e.status, e.date_enrolled,
            sec.section_id, sec.section_name,
            sub.code AS subject_code, sub.title AS subject_title, sub.credit_units,
            p.first_name AS instructor_first, p.last_name AS instructor_last,
            sem.school_year, sem.term
     FROM enrollments e
     JOIN sections sec ON e.section_id = sec.section_id
     JOIN subjects sub ON sec.subject_id = sub.subject_id
     JOIN users u ON sec.instructor_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     WHERE e.user_id = ? AND e.status = 'Enrolled'
     ORDER BY sem.start_date DESC, sub.title`,
    [payload.user_id]
  );

  return json({ success: true, data: enrollments });
});
