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

  // 3 — Fetch current year level
  const profileRows = await query<any[]>('SELECT year_level FROM profiles WHERE user_id = ?', [enrollment.user_id]);
  const oldYearLevel = profileRows[0]?.year_level ?? null;

  // 4 — Set student to Irregular
  await query('UPDATE profiles SET year_level = ?, academic_status = ? WHERE user_id = ?', ['Irregular', 'Irregular', enrollment.user_id]);

  // 5 — Log to academic_records
  await query(
    `INSERT INTO academic_records (user_id, semester_id, old_year_level, new_year_level, reason, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [enrollment.user_id, enrollment.semester_id, oldYearLevel, 'Irregular', 'Dropped', `Enrollment #${id} dropped by admin`]
  );

  return json({ success: true, message: 'Enrollment dropped. Student marked as Irregular.' });
});
