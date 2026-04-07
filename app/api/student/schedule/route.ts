import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireRole(req, ['student']);

  const schedules = await query<any[]>(
    `SELECT sch.schedule_id, sch.day_of_week, sch.start_time, sch.end_time, sch.room,
            sec.section_id, sec.section_name,
            sub.code AS subject_code, sub.title AS subject_title,
            p.first_name AS instructor_first, p.last_name AS instructor_last
     FROM schedules sch
     JOIN sections sec ON sch.section_id = sec.section_id
     JOIN subjects sub ON sec.subject_id = sub.subject_id
     JOIN users u ON sec.instructor_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     JOIN enrollments e ON e.section_id = sec.section_id
     WHERE e.user_id = ? AND e.status = 'Enrolled'
     ORDER BY FIELD(sch.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), sch.start_time`,
    [payload.user_id]
  );

  return json({ success: true, data: schedules });
});
