import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { transaction } from '@/lib/db';

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string; qid: string }> }) => {
  const { id, qid } = await ctx.params;
  const payload = requireRole(req, ['Faculty', 'Admin']);

  const [aRows] = await pool.execute(
    'SELECT created_by FROM assessments WHERE assessment_id = ?', [id]
  ) as any;
  if (!aRows.length) throw { status: 404, message: 'Assessment not found.' };
  if (payload.role_name === 'Faculty' && aRows[0].created_by !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  const body = await req.json();
  const { question_text, question_type, points, case_sensitive, options, answers } = body;

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE assessment_questions
       SET question_text = ?, question_type = ?, points = ?, case_sensitive = ?
       WHERE question_id = ? AND assessment_id = ?`,
      [question_text, question_type, points || 1, case_sensitive ? 1 : 0, qid, id]
    );

    await conn.execute('DELETE FROM assessment_answers WHERE question_id = ?', [qid]);
    await conn.execute('DELETE FROM assessment_options WHERE question_id = ?', [qid]);

    if (question_type === 'Identification' && Array.isArray(answers)) {
      for (const ans of answers) {
        if (ans?.trim()) {
          await conn.execute(
            'INSERT INTO assessment_answers (question_id, answer_text) VALUES (?, ?)',
            [qid, ans.trim()]
          );
        }
      }
    }

    if ((question_type === 'MultipleChoice' || question_type === 'Matching') && Array.isArray(options)) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt?.option_text?.trim()) {
          await conn.execute(
            `INSERT INTO assessment_options (question_id, option_text, is_correct, match_text, position)
             VALUES (?, ?, ?, ?, ?)`,
            [qid, opt.option_text.trim(), opt.is_correct ? 1 : 0, opt.match_text || null, i]
          );
        }
      }
    }
  });

  return json({ success: true, message: 'Question updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string; qid: string }> }) => {
  const { id, qid } = await ctx.params;
  const payload = requireRole(req, ['Faculty', 'Admin']);

  const [aRows] = await pool.execute(
    'SELECT created_by FROM assessments WHERE assessment_id = ?', [id]
  ) as any;
  if (!aRows.length) throw { status: 404, message: 'Assessment not found.' };
  if (payload.role_name === 'Faculty' && aRows[0].created_by !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  await pool.execute(
    'DELETE FROM assessment_questions WHERE question_id = ? AND assessment_id = ?', [qid, id]
  );
  return json({ success: true, message: 'Question deleted.' });
});
