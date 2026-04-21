import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Student']);

  const [attempt] = await pool.execute(`
    SELECT * FROM assessment_attempts
    WHERE assessment_id = ? AND user_id = ? AND status = 'InProgress'
    ORDER BY attempt_id DESC LIMIT 1
  `, [id, payload.user_id]) as any;

  if (!attempt.length) return json({ success: true, data: null });

  const att = attempt[0];
  const shuffleOrder: number[] = att.shuffle_seed ? JSON.parse(att.shuffle_seed) : [];

  const [questions] = await pool.execute(
    'SELECT question_id, question_text, question_type, points, position FROM assessment_questions WHERE assessment_id = ? ORDER BY position, question_id',
    [id]
  ) as any;

  const [options] = await pool.execute(
    'SELECT * FROM assessment_options WHERE question_id IN (SELECT question_id FROM assessment_questions WHERE assessment_id = ?)',
    [id]
  ) as any;

  const optionsByQuestion: Record<number, any[]> = {};
  for (const opt of options) {
    if (!optionsByQuestion[opt.question_id]) optionsByQuestion[opt.question_id] = [];
    optionsByQuestion[opt.question_id].push(opt);
  }

  let ordered = questions.map((q: any) => ({
    ...q,
    options: optionsByQuestion[q.question_id] || [],
  }));

  if (shuffleOrder.length) {
    const map = new Map(ordered.map((q: any) => [q.question_id, q]));
    ordered = shuffleOrder.map(qid => map.get(qid)).filter(Boolean);
  }

  const [responses] = await pool.execute(
    'SELECT question_id, response_text, selected_option_id, match_json FROM assessment_responses WHERE attempt_id = ?',
    [att.attempt_id]
  ) as any;

  return json({ success: true, data: { attempt: att, questions: ordered, responses } });
});

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Student']);

  const [aRows] = await pool.execute(`
    SELECT a.*, off.section_id
    FROM assessments a
    JOIN subject_offerings off ON off.offering_id = a.offering_id
    WHERE a.assessment_id = ? AND a.status = 'Published'
  `, [id]) as any;
  if (!aRows.length) throw { status: 404, message: 'Assessment not available.' };
  const assessment = aRows[0];

  const [enrolled] = await pool.execute(
    'SELECT enrollment_id FROM enrollments WHERE section_id = ? AND user_id = ? AND status = ?',
    [assessment.section_id, payload.user_id, 'Enrolled']
  ) as any;
  if (!enrolled.length) throw { status: 403, message: 'You are not enrolled in this section.' };

  const [access] = await pool.execute(
    'SELECT is_enabled FROM assessment_access WHERE assessment_id = ? AND user_id = ?',
    [id, payload.user_id]
  ) as any;
  if (access.length && !access[0].is_enabled) {
    throw { status: 403, message: 'You are not enabled for this assessment.' };
  }

  // Use MySQL NOW() for consistent timezone handling
  const [[{ now }]] = await pool.execute('SELECT NOW() as now') as any;
  console.log('[Attempt] Time check - now:', now, 'open_at:', assessment.open_at, 'close_at:', assessment.close_at);

  if (!assessment.is_open) {
    if (assessment.open_at && assessment.open_at > now) {
      console.log('[Attempt] Blocked - not opened yet');
      throw { status: 403, message: `Assessment opens at ${assessment.open_at}. Current server time: ${now}` };
    }
    if (assessment.close_at && assessment.close_at < now) {
      console.log('[Attempt] Blocked - already closed');
      throw { status: 403, message: 'Assessment is closed.' };
    }
  }

  const [existing] = await pool.execute(
    `SELECT attempt_id FROM assessment_attempts
     WHERE assessment_id = ? AND user_id = ? AND status = 'InProgress'`,
    [id, payload.user_id]
  ) as any;
  if (existing.length) throw { status: 409, message: 'You already have an in-progress attempt.' };

  if (!assessment.allow_retakes) {
    const [done] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM assessment_attempts
       WHERE assessment_id = ? AND user_id = ? AND status != 'InProgress'`,
      [id, payload.user_id]
    ) as any;
    if (done[0].cnt >= assessment.max_attempts) {
      throw { status: 409, message: 'You have reached the maximum number of attempts.' };
    }
  }

  const [prevAttempts] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM assessment_attempts WHERE assessment_id = ? AND user_id = ?',
    [id, payload.user_id]
  ) as any;
  const attemptNo = prevAttempts[0].cnt + 1;

  const [questions] = await pool.execute(
    'SELECT question_id FROM assessment_questions WHERE assessment_id = ? ORDER BY position, question_id',
    [id]
  ) as any;
  const qIds = questions.map((q: any) => q.question_id);

  let shuffleOrder = qIds;
  if (assessment.shuffle_questions) {
    const seed = Date.now() ^ (parseInt(payload.user_id.replace(/\D/g, '')) || 1);
    shuffleOrder = shuffle(qIds, seed);
  }

  const [attResult] = await pool.execute(
    `INSERT INTO assessment_attempts (assessment_id, user_id, attempt_no, started_at, shuffle_seed, status)
     VALUES (?, ?, ?, NOW(), ?, 'InProgress')`,
    [id, payload.user_id, attemptNo, JSON.stringify(shuffleOrder)]
  ) as any;

  const [attempt] = await pool.execute(
    'SELECT * FROM assessment_attempts WHERE attempt_id = ?', [attResult.insertId]
  ) as any;

  const [fullQuestions] = await pool.execute(
    'SELECT question_id, question_text, question_type, points, position FROM assessment_questions WHERE assessment_id = ? ORDER BY position, question_id',
    [id]
  ) as any;

  const [allOptions] = await pool.execute(
    'SELECT * FROM assessment_options WHERE question_id IN (SELECT question_id FROM assessment_questions WHERE assessment_id = ?)',
    [id]
  ) as any;

  const optsByQuestion: Record<number, any[]> = {};
  for (const opt of allOptions) {
    if (!optsByQuestion[opt.question_id]) optsByQuestion[opt.question_id] = [];
    optsByQuestion[opt.question_id].push(opt);
  }

  const qMap = new Map(fullQuestions.map((q: any) => [q.question_id, {
    ...q,
    options: optsByQuestion[q.question_id] || [],
  }]));
  const sortedQuestions = shuffleOrder.map((qid: number) => qMap.get(qid)).filter(Boolean);

  return json({ success: true, data: { attempt: attempt[0], questions: sortedQuestions, responses: [] } }, 201);
});
