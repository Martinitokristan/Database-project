import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  // Verify enrollment exists
  const enrollments = await query<any[]>(
    `SELECT e.enrollment_id, e.user_id, e.section_id, e.status,
            sec.semester_id
     FROM enrollments e
     JOIN sections sec ON sec.section_id = e.section_id
     WHERE e.enrollment_id = ?`,
    [id]
  );
  if (enrollments.length === 0) return json({ success: false, message: 'Enrollment not found.' }, 404);
  const enrollment = enrollments[0];
  if (enrollment.status === 'Dropped') return json({ success: false, message: 'Already dropped.' }, 409);

  // 1 — Set enrollment status to Dropped
  await query('UPDATE enrollments SET status = ? WHERE enrollment_id = ?', ['Dropped', id]);

  // 2 — Set grade remarks to Failed
  await query(
    'UPDATE grades SET remarks = ? WHERE enrollment_id = ?',
    ['Failed', id]
  );

  // 3 — Fetch current status and year level mapping
  const ylRows = await query<any[]>('SELECT year_level_id, level_name FROM year_levels');
  const ylMap = Object.fromEntries(ylRows.map(r => [r.level_name, r.year_level_id]));
  
  const statusRows = await query<any[]>(
    'SELECT status_id, year_level_id FROM student_academic_status WHERE user_id = ? AND semester_id = ?',
    [enrollment.user_id, enrollment.semester_id]
  );
  
  const currentSas = statusRows[0];
  const oldYearLevelId = currentSas?.year_level_id || ylMap['1st Year'];
  const irregularId = ylMap['Irregular'];

  // 4 — Set student to Irregular in current status record
  if (currentSas) {
    await query(
      'UPDATE student_academic_status SET year_level_id = ?, academic_status = ? WHERE status_id = ?',
      [irregularId, 'Irregular', currentSas.status_id]
    );
  } else {
    await query(
      'INSERT INTO student_academic_status (user_id, semester_id, year_level_id, academic_status) VALUES (?, ?, ?, ?)',
      [enrollment.user_id, enrollment.semester_id, irregularId, 'Irregular']
    );
  }

  // 5 — Log to academic_records
  await query(
    `INSERT INTO academic_records (user_id, semester_id, old_year_level_id, new_year_level_id, reason, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [enrollment.user_id, enrollment.semester_id, oldYearLevelId, irregularId, 'Dropped', `Enrollment #${id} dropped by admin`]
  );

  return json({ success: true, message: 'Enrollment dropped. Student marked as Irregular.' });
});
