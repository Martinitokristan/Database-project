import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { transaction } from '@/lib/db';

interface Response {
  question_id:       number;
  response_text?:    string;
  selected_option_id?: number;
  match_json?:       string;
}

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Student']);
  const body = await req.json();
  const { attempt_id, responses, time_spent } = body as {
    attempt_id: number;
    responses: Response[];
    time_spent: number;
  };

  const [attRows] = await pool.execute(
    `SELECT * FROM assessment_attempts
     WHERE attempt_id = ? AND assessment_id = ? AND user_id = ? AND status = 'InProgress'`,
    [attempt_id, id, payload.user_id]
  ) as any;
  if (!attRows.length) throw { status: 404, message: 'Attempt not found or already submitted.' };

  const [questions] = await pool.execute(
    'SELECT * FROM assessment_questions WHERE assessment_id = ?',
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

  let totalPoints = 0;
  let earnedPoints = 0;

  const result = await transaction(async (conn) => {
    for (const q of questions) {
      const opts    = optionsByQuestion[q.question_id] || [];
      const acc     = answersByQuestion[q.question_id] || [];
      const maxPts  = parseFloat(q.points);
      totalPoints  += maxPts;

      const resp = responses?.find(r => r.question_id === q.question_id);
      let isCorrect: boolean | null = null;
      let earned = 0;

      if (resp) {
        if (q.question_type === 'MultipleChoice') {
          const correct = opts.find((o: any) => o.is_correct);
          isCorrect = correct && resp.selected_option_id === correct.option_id;
          earned = isCorrect ? maxPts : 0;
        } else if (q.question_type === 'Identification') {
          const given = q.case_sensitive
            ? resp.response_text?.trim()
            : resp.response_text?.trim().toLowerCase();
          isCorrect = acc.some((a: any) =>
            q.case_sensitive ? a.answer_text?.trim() === given : a.answer_text?.trim().toLowerCase() === given
          );
          earned = isCorrect ? maxPts : 0;
        } else if (q.question_type === 'Matching') {
          const matchMap: Record<number, string> = resp.match_json ? JSON.parse(resp.match_json) : {};
          let correctPairs = 0;
          for (const opt of opts) {
            const given = q.case_sensitive
              ? matchMap[opt.option_id]
              : matchMap[opt.option_id]?.toLowerCase();
            const expected = q.case_sensitive
              ? opt.match_text
              : opt.match_text?.toLowerCase();
            if (given && expected && given.trim() === expected.trim()) correctPairs++;
          }
          isCorrect = opts.length > 0 && correctPairs === opts.length;
          earned = opts.length > 0 ? (correctPairs / opts.length) * maxPts : 0;
        }
      }

      earnedPoints += earned;

      await conn.execute(
        `INSERT INTO assessment_responses
           (attempt_id, question_id, response_text, selected_option_id, match_json, is_correct, points_earned)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           response_text = VALUES(response_text),
           selected_option_id = VALUES(selected_option_id),
           match_json = VALUES(match_json),
           is_correct = VALUES(is_correct),
           points_earned = VALUES(points_earned)`,
        [
          attempt_id, q.question_id,
          resp?.response_text || null,
          resp?.selected_option_id || null,
          resp?.match_json || null,
          isCorrect === null ? null : isCorrect ? 1 : 0,
          earned,
        ]
      );
    }

    await conn.execute(
      `UPDATE assessment_attempts
       SET status = 'Submitted', submitted_at = NOW(), time_spent = ?, score = ?, max_score = ?
       WHERE attempt_id = ?`,
      [time_spent || null, earnedPoints, totalPoints, attempt_id]
    );
  });

  return json({
    success: true,
    data: { score: earnedPoints, max_score: totalPoints },
    message: 'Assessment submitted successfully.',
  });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  requireRole(req, ['Faculty', 'Admin']);
  const body = await req.json();
  const { response_id, points_earned } = body;

  if (response_id === undefined) throw { status: 422, message: 'response_id required.' };

  await pool.execute(
    `UPDATE assessment_responses
     SET points_earned = ?, is_correct = ?, manually_overridden = TRUE
     WHERE response_id = ?`,
    [points_earned, points_earned > 0 ? 1 : 0, response_id]
  );

  const [attInfo] = await pool.execute(
    `SELECT ar.attempt_id, SUM(r.points_earned) AS new_score
     FROM assessment_responses ar2
     JOIN assessment_responses r ON r.attempt_id = ar2.attempt_id
     WHERE ar2.response_id = ?
     GROUP BY ar2.attempt_id`,
    [response_id]
  ) as any;

  if (attInfo.length) {
    await pool.execute(
      'UPDATE assessment_attempts SET score = ?, status = ? WHERE attempt_id = ?',
      [attInfo[0].new_score, 'Graded', attInfo[0].attempt_id]
    );
  }

  return json({ success: true, message: 'Grade overridden.' });
});
