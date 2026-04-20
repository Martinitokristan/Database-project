import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireAuth(req);

  const [aRows] = await pool.execute(
    'SELECT a.assessment_id, a.created_by, a.show_results, so.section_id FROM assessments a JOIN subject_offerings so ON a.offering_id = so.offering_id WHERE a.assessment_id = ?', [id]
  ) as any;
  if (!aRows.length) throw { status: 404, message: 'Assessment not found.' };
  const assessment = aRows[0];

  if (payload.role_name === 'Student') {
    if (!assessment.show_results) throw { status: 403, message: 'Results are not yet released.' };
    
    // Get attempts
    const [attempts] = await pool.execute(
      'SELECT * FROM assessment_attempts WHERE assessment_id = ? AND user_id = ? AND status != ? ORDER BY attempt_no DESC',
      [id, payload.user_id, 'InProgress']
    ) as any;

    // Get responses for all attempts
    const attemptIds = attempts.map((a: any) => a.attempt_id);
    let responses: any[] = [];
    if (attemptIds.length > 0) {
      const placeholders = attemptIds.map(() => '?').join(',');
      const [respRows] = await pool.execute(
        `SELECT r.*, q.question_text, q.question_type, q.points 
         FROM assessment_responses r 
         JOIN assessment_questions q ON q.question_id = r.question_id
         WHERE r.attempt_id IN (${placeholders})`,
        attemptIds
      ) as any;
      responses = respRows;
    }

    // Group responses by attempt_id
    const responsesByAttempt: Record<number, any[]> = {};
    for (const r of responses) {
      if (!responsesByAttempt[r.attempt_id]) responsesByAttempt[r.attempt_id] = [];
      responsesByAttempt[r.attempt_id].push(r);
    }

    const parsed = attempts.map((a: any) => ({
      ...a,
      responses: responsesByAttempt[a.attempt_id] || [],
    }));
    return json({ success: true, data: parsed });
  }

  if (payload.role_name === 'Faculty' && assessment.created_by !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  // Get all attempts for faculty
  const [rows] = await pool.execute(
    `SELECT att.attempt_id, att.user_id, att.attempt_no, att.started_at, att.submitted_at,
            att.time_spent, att.score, att.max_score, att.status,
            p.first_name, p.last_name, u.email
     FROM assessment_attempts att
     JOIN users u ON u.user_id = att.user_id
     JOIN profiles p ON p.user_id = att.user_id
     WHERE att.assessment_id = ? AND att.status != ?
     ORDER BY p.last_name, p.first_name, att.attempt_no`,
    [id, 'InProgress']
  ) as any;

  // Get all responses for these attempts
  const attemptIds = rows.map((r: any) => r.attempt_id);
  let responses: any[] = [];
  if (attemptIds.length > 0) {
    const placeholders = attemptIds.map(() => '?').join(',');
    const [respRows] = await pool.execute(
      `SELECT r.*, q.question_text, q.question_type, q.points 
       FROM assessment_responses r 
       JOIN assessment_questions q ON q.question_id = r.question_id
       WHERE r.attempt_id IN (${placeholders})`,
      attemptIds
    ) as any;
    responses = respRows;
  }

  // Group responses by attempt_id
  const responsesByAttempt: Record<number, any[]> = {};
  for (const r of responses) {
    if (!responsesByAttempt[r.attempt_id]) responsesByAttempt[r.attempt_id] = [];
    responsesByAttempt[r.attempt_id].push(r);
  }

  const parsed = rows.map((r: any) => ({
    ...r,
    responses: responsesByAttempt[r.attempt_id] || [],
  }));
  return json({ success: true, data: parsed });
});
