import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

const YEAR_LEVEL_ORDER = [
  '1st Year', '2nd Year', '3rd Year', '4th Year',
] as const;

function getNextYearLevel(current: string | null): string | null {
  if (!current) return null;
  const idx = YEAR_LEVEL_ORDER.indexOf(current as any);
  if (idx === -1 || idx === YEAR_LEVEL_ORDER.length - 1) return current; // 4th Year+ no change
  return YEAR_LEVEL_ORDER[idx + 1];
}

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  // 1 — Verify semester
  const semesters = await query<any[]>(
    'SELECT semester_id, term, status FROM semesters WHERE semester_id = ?',
    [id]
  );
  if (semesters.length === 0) return json({ success: false, message: 'Semester not found.' }, 404);
  const semester = semesters[0];
  if (semester.status === 'Closed') return json({ success: false, message: 'Semester already closed.' }, 409);

  // 2 — Close the semester
  await query('UPDATE semesters SET status = ? WHERE semester_id = ?', ['Closed', id]);

  const isSecondSemester = semester.term === 'Second Semester';
  const summary: { user_id: string; result: string }[] = [];

  if (isSecondSemester) {
    // 3 — Get all distinct students enrolled in this semester
    const students = await query<any[]>(
      `SELECT DISTINCT e.user_id
       FROM enrollments e
       JOIN sections sec ON sec.section_id = e.section_id
       WHERE sec.semester_id = ? AND e.status != 'Rejected'`,
      [id]
    );

    for (const { user_id } of students) {
      // 4 — Get all enrollments for this student in this semester
      const enrollments = await query<any[]>(
        `SELECT e.enrollment_id, e.status as enroll_status, g.remarks
         FROM enrollments e
         JOIN sections sec ON sec.section_id = e.section_id
         LEFT JOIN grades g ON g.enrollment_id = e.enrollment_id
         WHERE sec.semester_id = ? AND e.user_id = ?`,
        [id, user_id]
      );

      // 5 — Fetch current year level
      const profileRows = await query<any[]>(
        'SELECT year_level, academic_status FROM profiles WHERE user_id = ?',
        [user_id]
      );
      const oldYearLevel = profileRows[0]?.year_level ?? null;

      // 6 — Determine outcome
      const hasDropped     = enrollments.some(e => e.enroll_status === 'Dropped');
      const hasFailed      = enrollments.some(e => e.remarks === 'Failed');
      const hasIncomplete  = enrollments.some(e => e.remarks === 'Incomplete' || e.remarks === null);
      const allPassed      = enrollments.every(e => e.remarks === 'Passed');

      let newYearLevel = oldYearLevel;
      let reason: string;
      let academicStatus: string = profileRows[0]?.academic_status ?? 'Good Standing';

      if (hasDropped || hasFailed) {
        // Case B & D — Failed / Dropped
        newYearLevel  = 'Irregular';
        reason        = hasDropped ? 'Dropped' : 'Failed';
        academicStatus = 'Irregular';
      } else if (hasIncomplete) {
        // Case C — Incomplete: skip, do not advance
        summary.push({ user_id, result: 'Skipped (Incomplete grades pending)' });
        continue;
      } else if (allPassed) {
        // Case A — Promote
        const next = getNextYearLevel(oldYearLevel);
        newYearLevel   = next;
        reason         = 'Promoted';
        academicStatus = newYearLevel === '4th Year' ? 'Graduating' : 'Good Standing';
      } else {
        summary.push({ user_id, result: 'No change (no grades recorded)' });
        continue;
      }

      // 7 — Update profiles
      await query(
        'UPDATE profiles SET year_level = ?, academic_status = ? WHERE user_id = ?',
        [newYearLevel, academicStatus, user_id]
      );

      // 8 — Log to academic_records
      await query(
        `INSERT INTO academic_records (user_id, semester_id, old_year_level, new_year_level, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [user_id, id, oldYearLevel, newYearLevel, reason!]
      );

      summary.push({ user_id, result: `${oldYearLevel} → ${newYearLevel} (${reason!})` });
    }
  }

  return json({
    success: true,
    message: isSecondSemester
      ? `Semester closed. ${summary.length} student(s) processed.`
      : 'Semester closed. Year level advance runs at end of Second Semester only.',
    data: { processed: summary },
  });
});
