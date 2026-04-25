import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Faculty', 'Admin']);

  const [aRows] = await pool.execute(
    'SELECT a.created_by, so.section_id FROM assessments a JOIN subject_offerings so ON a.offering_id = so.offering_id WHERE a.assessment_id = ?', [id]
  ) as any;
  if (!aRows.length) throw { status: 404, message: 'Assessment not found.' };
  if (payload.role_name === 'Faculty' && aRows[0].created_by !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  const sectionId = aRows[0].section_id;

  const [rows] = await pool.execute(`
    SELECT
      e.user_id,
      p.first_name, p.last_name,
      u.email,
      COALESCE(acc.is_enabled, TRUE) AS is_enabled,
      acc.access_id,
      (SELECT COUNT(*) FROM assessment_attempts att
       WHERE att.assessment_id = ? AND att.user_id = e.user_id AND att.status != 'InProgress') AS attempts_count,
      (SELECT score FROM assessment_attempts att
       WHERE att.assessment_id = ? AND att.user_id = e.user_id AND att.status != 'InProgress'
       ORDER BY att.score DESC LIMIT 1) AS best_score
    FROM enrollments e
    JOIN users u ON u.user_id = e.user_id
    JOIN profiles p ON p.user_id = e.user_id
    LEFT JOIN assessment_access acc ON acc.assessment_id = ? AND acc.user_id = e.user_id
    WHERE e.section_id = ? AND e.status = 'Enrolled'
    ORDER BY p.last_name, p.first_name
  `, [id, id, id, sectionId]) as any;

  return json({ success: true, data: rows });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const payload = requireRole(req, ['Faculty', 'Admin']);

  const [aRows] = await pool.execute(
    'SELECT a.created_by, so.section_id FROM assessments a JOIN subject_offerings so ON a.offering_id = so.offering_id WHERE a.assessment_id = ?', [id]
  ) as any;
  if (!aRows.length) throw { status: 404, message: 'Assessment not found.' };
  if (payload.role_name === 'Faculty' && aRows[0].created_by !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  const body = await req.json();
  const { user_id, is_enabled, bulk } = body;

  if (bulk === 'enable_all' || bulk === 'disable_all') {
    const sectionId = aRows[0].section_id;
    const enabled = bulk === 'enable_all' ? 1 : 0;
    const [students] = await pool.execute(
      'SELECT user_id FROM enrollments WHERE section_id = ? AND status = ?',
      [sectionId, 'Enrolled']
    ) as any;
    for (const s of students) {
      await pool.execute(
        `INSERT INTO assessment_access (assessment_id, user_id, is_enabled)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_enabled = ?`,
        [id, s.user_id, enabled, enabled]
      );
    }
    return json({ success: true, message: `All students ${bulk === 'enable_all' ? 'enabled' : 'disabled'}.` });
  }

  if (!user_id) throw { status: 422, message: 'user_id is required.' };

  await pool.execute(
    `INSERT INTO assessment_access (assessment_id, user_id, is_enabled)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE is_enabled = ?`,
    [id, user_id, is_enabled ? 1 : 0, is_enabled ? 1 : 0]
  );

  return json({ success: true, message: 'Access updated.' });
});
