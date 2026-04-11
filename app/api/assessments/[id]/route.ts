import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, requireRole, apiHandler, json } from '@/lib/middleware';

async function getAssessment(id: number, userId: string, roleName: string) {
  const [rows] = await pool.execute(`
    SELECT a.*,
      sec.section_name, sec.instructor_id,
      sub.code AS subject_code, sub.title AS subject_title,
      (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.assessment_id) AS question_count
    FROM assessments a
    JOIN sections sec ON sec.section_id = a.section_id
    JOIN subjects sub ON sub.subject_id = sec.subject_id
    WHERE a.assessment_id = ?
  `, [id]) as any;
  if (!rows.length) throw { status: 404, message: 'Assessment not found.' };
  const a = rows[0];
  if (roleName === 'Faculty' && a.created_by !== userId) {
    throw { status: 403, message: 'Access denied.' };
  }
  return a;
}

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const payload = requireAuth(req);
    const assessment = await getAssessment(Number(id), payload.user_id, payload.role_name);

    // Fetch questions
    const [questions] = await pool.execute(
      'SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY position, question_id',
      [id]
    ) as any;

    // Fetch options for all questions
    const [options] = await pool.execute(
      'SELECT * FROM assessment_options WHERE question_id IN (SELECT question_id FROM assessment_questions WHERE assessment_id = ?)',
      [id]
    ) as any;

    // Fetch answers for all questions
    const [answers] = await pool.execute(
      'SELECT * FROM assessment_answers WHERE question_id IN (SELECT question_id FROM assessment_questions WHERE assessment_id = ?)',
      [id]
    ) as any;

    // Group options and answers by question_id
    const optionsByQuestion: Record<number, any[]> = {};
    for (const opt of options) {
      if (!optionsByQuestion[opt.question_id]) optionsByQuestion[opt.question_id] = [];
      optionsByQuestion[opt.question_id].push(opt);
    }

    const answersByQuestion: Record<number, any[]> = {};
    for (const ans of answers) {
      if (!answersByQuestion[ans.question_id]) answersByQuestion[ans.question_id] = [];
      answersByQuestion[ans.question_id].push(ans);
    }

    // Build final question objects
    const parsed = questions.map((q: any) => ({
      ...q,
      options: optionsByQuestion[q.question_id] || [],
      answers: answersByQuestion[q.question_id] || [],
    }));

    return json({ success: true, data: { ...assessment, questions: parsed } });
  } catch (err) {
    console.error('[GET /api/assessments/:id]', err);
    throw err;
  }
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const payload = requireRole(req, ['Faculty', 'Admin']);
    await getAssessment(Number(id), payload.user_id, payload.role_name);
    const body = await req.json();

    console.log('[PUT /api/assessments/:id] Updating assessment:', id, body);

    const {
      title, description, assessment_type, timer_minutes, per_question_timer,
      shuffle_questions, shuffle_choices, allow_retakes, max_attempts,
      assessment_password, open_at, close_at, is_open, show_results,
    } = body;

    await pool.execute(`
      UPDATE assessments SET
        title = ?, description = ?, assessment_type = ?,
        timer_minutes = ?, per_question_timer = ?,
        shuffle_questions = ?, shuffle_choices = ?,
        allow_retakes = ?, max_attempts = ?,
        assessment_password = ?, open_at = ?, close_at = ?,
        is_open = ?, show_results = ?
      WHERE assessment_id = ?
    `, [
      title, description || null, assessment_type,
      timer_minutes || null, per_question_timer || null,
      shuffle_questions ? 1 : 0, shuffle_choices ? 1 : 0,
      allow_retakes ? 1 : 0, max_attempts || 1,
      assessment_password || null, open_at || null, close_at || null,
      is_open ? 1 : 0, show_results ? 1 : 0,
      id,
    ]);

    const [rows] = await pool.execute('SELECT * FROM assessments WHERE assessment_id = ?', [id]) as any;
    console.log('[PUT /api/assessments/:id] Assessment updated successfully');
    return json({ success: true, data: rows[0], message: 'Assessment updated.' });
  } catch (err) {
    console.error('[PUT /api/assessments/:id] Error:', err);
    throw err;
  }
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Faculty', 'Admin']);
  const assessment = await getAssessment(Number(id), payload.user_id, payload.role_name);

  if (assessment.status !== 'Draft') {
    throw { status: 409, message: 'Only Draft assessments can be deleted.' };
  }

  await pool.execute('DELETE FROM assessments WHERE assessment_id = ?', [id]);
  return json({ success: true, message: 'Assessment deleted.' });
});
