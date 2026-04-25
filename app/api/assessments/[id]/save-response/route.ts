import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Student']);
  const body = await req.json();
  const { attempt_id, question_id, response_text, selected_option_id, match_json } = body;

  const [att] = await pool.execute(
    `SELECT attempt_id FROM assessment_attempts
     WHERE attempt_id = ? AND assessment_id = ? AND user_id = ? AND status = 'InProgress'`,
    [attempt_id, id, payload.user_id]
  ) as any;
  if (!att.length) throw { status: 404, message: 'Attempt not found.' };

  await pool.execute(
    `INSERT INTO assessment_responses (attempt_id, question_id, response_text, selected_option_id, match_json)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       response_text = VALUES(response_text),
       selected_option_id = VALUES(selected_option_id),
       match_json = VALUES(match_json)`,
    [attempt_id, question_id, response_text || null, selected_option_id || null, match_json || null]
  );

  return json({ success: true, message: 'Response saved.' });
});
