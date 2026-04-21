import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { computeRemarks } from '@/lib/auth';
import { z } from 'zod';

const UpsertGradeSchema = z.object({
  offering_id: z.number(),
  enrollment_id: z.number(),
  prelim_grade:  z.number().min(0).max(100).nullable().optional(),
  midterm_grade: z.number().min(0).max(100).nullable().optional(),
  semi_final_grade: z.number().min(0).max(100).nullable().optional(),
  final_grade:   z.number().min(0).max(100).nullable().optional(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const body   = await req.json();
  const parsed = UpsertGradeSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const { offering_id, enrollment_id, prelim_grade, midterm_grade, semi_final_grade, final_grade } = parsed.data;

  // Check access and finalized status
  if (role === 'faculty') {
    const offering = await query<any[]>('SELECT instructor_id FROM subject_offerings WHERE offering_id = ?', [offering_id]);
    if (offering.length === 0 || offering[0].instructor_id !== payload.user_id) {
      throw { status: 403, message: 'Access denied.' };
    }
  }

  const existing = await query<any[]>(
    'SELECT * FROM grades WHERE offering_id = ? AND enrollment_id = ?',
    [offering_id, enrollment_id]
  );

  let p = prelim_grade, m = midterm_grade, s = semi_final_grade, f = final_grade, r = null;

  if (existing.length > 0) {
    if (role === 'faculty' && existing[0].is_finalized) {
      throw { status: 403, message: 'Grades are finalized and locked. Contact an administrator to make changes.' };
    }
    const current = existing[0];
    p = p !== undefined ? p : current.prelim_grade;
    m = m !== undefined ? m : current.midterm_grade;
    s = s !== undefined ? s : current.semi_final_grade;
    f = f !== undefined ? f : current.final_grade;
    // Compute remarks strictly using midterm and final (per user plan choice)
    r = computeRemarks(p ?? null, m ?? null, f ?? null);
    await query(
      'UPDATE grades SET prelim_grade = ?, midterm_grade = ?, semi_final_grade = ?, final_grade = ?, remarks = ? WHERE grade_id = ?',
      [p, m, s, f, r, current.grade_id]
    );
  } else {
    // defaults to null if undefined
    p = p ?? null;
    m = m ?? null;
    s = s ?? null;
    f = f ?? null;
    r = computeRemarks(p ?? null, m ?? null, f ?? null);
    await query(
      'INSERT INTO grades (offering_id, enrollment_id, prelim_grade, midterm_grade, semi_final_grade, final_grade, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [offering_id, enrollment_id, p, m, s, f, r]
    );
  }

  /* ── Notify student ── */
  try {
    const enrollment = await query<any[]>(
      `SELECT e.user_id, sub.title AS subject_title, sec.section_name
       FROM enrollments e
       JOIN subject_offerings so ON so.offering_id = ?
       JOIN sections sec ON sec.section_id = so.section_id
       JOIN subjects sub ON so.subject_id = sub.subject_id
       WHERE e.enrollment_id = ?`,
      [offering_id, enrollment_id]
    );
    if (enrollment.length > 0) {
      const { user_id, subject_title, section_name } = enrollment[0];
      const parts: string[] = [];
      if (prelim_grade !== undefined && prelim_grade !== null) parts.push(`Prelim: ${prelim_grade}`);
      if (midterm_grade !== undefined && midterm_grade !== null) parts.push(`Midterm: ${midterm_grade}`);
      if (final_grade !== undefined && final_grade !== null) parts.push(`Final: ${final_grade}`);
      const gradeStr = parts.length ? parts.join(', ') : 'updated';
      await query(
        'INSERT INTO notifications (user_id, sender_id, title, message) VALUES (?, ?, ?, ?)',
        [
          user_id,
          payload.user_id,
          `Grade Updated — ${subject_title} (${section_name})`,
          `Your grade has been updated. ${gradeStr}. Remarks: ${r ?? 'Pending'}.`,
        ]
      );
    }
  } catch { /* non-critical */ }

  return json({ success: true, data: { remarks: r }, message: 'Grade saved successfully.' });
});
