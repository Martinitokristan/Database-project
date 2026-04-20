import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { computeRemarks } from '@/lib/auth';
import { z } from 'zod';

const UpdateGradeSchema = z.object({
  prelim_grade:  z.number().min(0).max(100).nullable().optional(),
  midterm_grade: z.number().min(0).max(100).nullable().optional(),
  final_grade:   z.number().min(0).max(100).nullable().optional(),
});

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params;
  const offeringId = id; // id is offering_id

  if (role === 'faculty') {
    const offering = await query<any[]>('SELECT instructor_id FROM subject_offerings WHERE offering_id = ?', [offeringId]);
    if (offering.length === 0 || offering[0].instructor_id !== payload.user_id) throw { status: 403, message: 'Access denied.' };
  }

  const grades = await query<any[]>(
    `SELECT e.enrollment_id, e.user_id, e.date_enrolled,
            p.first_name, p.last_name, p.middle_name,
            u.email,
            g.grade_id, g.prelim_grade, g.midterm_grade, g.final_grade, g.remarks, g.is_finalized,
            ROUND((COALESCE(g.prelim_grade,0) + COALESCE(g.midterm_grade,0) + COALESCE(g.final_grade,0)) / 3, 2) AS average
     FROM grades g
     JOIN enrollments e ON g.enrollment_id = e.enrollment_id
     JOIN users u ON e.user_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE g.offering_id = ? AND e.status = 'Enrolled'
     ORDER BY p.last_name, p.first_name`,
    [offeringId]
  );

  return json({ success: true, data: grades });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params; // id is grade_id
  const body   = await req.json();
  const parsed = UpdateGradeSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const existing = await query<any[]>(
    `SELECT g.*, so.instructor_id 
     FROM grades g
     JOIN subject_offerings so ON g.offering_id = so.offering_id
     WHERE g.grade_id = ?`,
    [id]
  );
  if (existing.length === 0) return json({ success: false, message: 'Grade record not found.' }, 404);

  if (role === 'faculty') {
    if (existing[0].instructor_id !== payload.user_id) {
      throw { status: 403, message: 'Access denied.' };
    }
    if (existing[0].is_finalized) {
      throw { status: 403, message: 'Grades are finalized and locked. Contact an administrator to make changes.' };
    }
  }

  const current = existing[0];
  const prelim  = parsed.data.prelim_grade  !== undefined ? parsed.data.prelim_grade  : current.prelim_grade;
  const midterm = parsed.data.midterm_grade !== undefined ? parsed.data.midterm_grade : current.midterm_grade;
  const final   = parsed.data.final_grade   !== undefined ? parsed.data.final_grade   : current.final_grade;
  const remarks = computeRemarks(prelim, midterm, final);

  await query(
    'UPDATE grades SET prelim_grade = ?, midterm_grade = ?, final_grade = ?, remarks = ? WHERE grade_id = ?',
    [prelim, midterm, final, remarks, id]
  );

  /* ── Notify student ── */
  try {
    const enrollment = await query<any[]>(
      `SELECT e.user_id, sub.title AS subject_title, sec.section_name
       FROM grades g
       JOIN enrollments e ON e.enrollment_id = g.enrollment_id
       JOIN subject_offerings so ON g.offering_id = so.offering_id
       JOIN sections sec ON sec.section_id = so.section_id
       JOIN subjects sub ON so.subject_id = sub.subject_id
       WHERE g.grade_id = ?`,
      [id]
    );
    if (enrollment.length > 0) {
      const { user_id, subject_title, section_name } = enrollment[0];
      const parts: string[] = [];
      if (parsed.data.prelim_grade  !== undefined && parsed.data.prelim_grade  !== null) parts.push(`Prelim: ${parsed.data.prelim_grade}`);
      if (parsed.data.midterm_grade !== undefined && parsed.data.midterm_grade !== null) parts.push(`Midterm: ${parsed.data.midterm_grade}`);
      if (parsed.data.final_grade   !== undefined && parsed.data.final_grade   !== null) parts.push(`Final: ${parsed.data.final_grade}`);
      const gradeStr = parts.length ? parts.join(', ') : 'updated';
      await query(
        'INSERT INTO notifications (user_id, sender_id, title, message) VALUES (?, ?, ?, ?)',
        [
          user_id,
          payload.user_id,
          `Grade Updated — ${subject_title} (${section_name})`,
          `Your grade has been updated. ${gradeStr}. Remarks: ${remarks ?? 'Pending'}.`,
        ]
      );
    }
  } catch { /* non-critical */ }

  return json({ success: true, data: { remarks }, message: 'Grade updated.' });
});
