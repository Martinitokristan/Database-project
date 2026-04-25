import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const UpdateOfferingSchema = z.object({
  instructor_id: z.string().min(1).optional(),
});

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin', 'faculty']);
  const { id } = await ctx.params;

  const offerings = await query<any[]>(
    `SELECT so.*,
            sub.code AS subject_code, sub.title AS subject_title, sub.credit_units, sub.subject_type,
            sec.section_name, sec.capacity, sec.semester_id, sec.is_archived,
            sem.school_year, sem.term, sem.status AS semester_status,
            p.first_name AS instructor_first, p.last_name AS instructor_last,
            (SELECT COUNT(DISTINCT e.enrollment_id)
             FROM enrollments e
             WHERE e.section_id = sec.section_id AND e.status = 'Enrolled') AS enrolled_count
     FROM subject_offerings so
     JOIN subjects sub ON so.subject_id = sub.subject_id
     JOIN sections sec ON so.section_id = sec.section_id
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     LEFT JOIN users u ON so.instructor_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE so.offering_id = ?`,
    [id]
  );

  if (offerings.length === 0) return json({ success: false, message: 'Offering not found.' }, 404);
  return json({ success: true, data: offerings[0] });

});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = UpdateOfferingSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const { instructor_id } = parsed.data;
  if (instructor_id) {
    await query('UPDATE subject_offerings SET instructor_id = ? WHERE offering_id = ?', [instructor_id, id]);
  }
  return json({ success: true, message: 'Offering updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  await query('DELETE FROM grades WHERE offering_id = ?', [id]);
  await query('DELETE FROM schedules WHERE offering_id = ?', [id]);
  
  // To delete assessments, we must purge all dependent tables first if CASCADE is not set
  const assessmentRows = await query<any[]>('SELECT assessment_id FROM assessments WHERE offering_id = ?', [id]);
  const assessmentIds = assessmentRows.map(r => r.assessment_id);
  
  if (assessmentIds.length > 0) {
    const placeholders = assessmentIds.map(() => '?').join(',');
    
    // 1. Delete Responses (linked via attempts)
    await query(`DELETE FROM assessment_responses WHERE attempt_id IN (SELECT attempt_id FROM assessment_attempts WHERE assessment_id IN (${placeholders}))`, assessmentIds);
    
    // 2. Delete Attempts (linked via assessment)
    await query(`DELETE FROM assessment_attempts WHERE assessment_id IN (${placeholders})`, assessmentIds);
    
    // 3. Delete Options (linked via questions)
    await query(`DELETE FROM assessment_options WHERE question_id IN (SELECT question_id FROM assessment_questions WHERE assessment_id IN (${placeholders}))`, assessmentIds);
    
    // 4. Delete Questions (linked via assessment)
    await query(`DELETE FROM assessment_questions WHERE assessment_id IN (${placeholders})`, assessmentIds);
    
    // 5. Delete Access (linked via assessment)
    await query(`DELETE FROM assessment_access WHERE assessment_id IN (${placeholders})`, assessmentIds);
    
    // 6. Finally delete assessments
    await query(`DELETE FROM assessments WHERE offering_id = ?`, [id]);
  }

  await query('DELETE FROM subject_offerings WHERE offering_id = ?', [id]);

  return json({ success: true, message: 'Offering deleted.' });
});
