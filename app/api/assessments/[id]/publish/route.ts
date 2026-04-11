import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Faculty', 'Admin']);

  const [aRows] = await pool.execute(
    'SELECT assessment_id, created_by, status FROM assessments WHERE assessment_id = ?', [id]
  ) as any;
  if (!aRows.length) throw { status: 404, message: 'Assessment not found.' };
  if (payload.role_name === 'Faculty' && aRows[0].created_by !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  const [qCount] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM assessment_questions WHERE assessment_id = ?', [id]
  ) as any;
  if (qCount[0].cnt === 0) {
    throw { status: 422, message: 'Cannot publish: assessment has no questions.' };
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'publish';

  const newStatus = action === 'close' ? 'Closed' : action === 'unpublish' ? 'Draft' : 'Published';
  await pool.execute('UPDATE assessments SET status = ? WHERE assessment_id = ?', [newStatus, id]);

  return json({ success: true, message: `Assessment ${newStatus.toLowerCase()}.` });
});
