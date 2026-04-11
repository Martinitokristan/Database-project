import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { transaction } from '@/lib/db';

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Faculty', 'Admin']);
  const body = await req.json();
  const { question_text, question_type, points, case_sensitive, options, answers } = body;

  if (!question_text?.trim()) throw { status: 422, message: 'Question text is required.' };
  if (!question_type) throw { status: 422, message: 'Question type is required.' };

  const [aRows] = await pool.execute(
    'SELECT assessment_id, created_by, status FROM assessments WHERE assessment_id = ?', [id]
  ) as any;
  if (!aRows.length) throw { status: 404, message: 'Assessment not found.' };
  if (payload.role_name === 'Faculty' && aRows[0].created_by !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  const [posRow] = await pool.execute(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM assessment_questions WHERE assessment_id = ?', [id]
  ) as any;
  const position = posRow[0].next_pos;

  const result = await transaction(async (conn) => {
    const [qResult] = await conn.execute(
      `INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, position, case_sensitive)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, question_text.trim(), question_type, points || 1, position, case_sensitive ? 1 : 0]
    ) as any;
    const questionId = qResult.insertId;

    if (question_type === 'Identification' && Array.isArray(answers)) {
      for (const ans of answers) {
        if (ans?.trim()) {
          await conn.execute(
            'INSERT INTO assessment_answers (question_id, answer_text) VALUES (?, ?)',
            [questionId, ans.trim()]
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
            [questionId, opt.option_text.trim(), opt.is_correct ? 1 : 0, opt.match_text || null, i]
          );
        }
      }
    }

    return questionId;
  });

  const [rows] = await pool.execute(
    'SELECT * FROM assessment_questions WHERE question_id = ?', [result]
  ) as any;
  return json({ success: true, data: rows[0], message: 'Question added.' }, 201);
});
