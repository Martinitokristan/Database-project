import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const DELETE = apiHandler(async (
  req: NextRequest,
  ctx: { params: Promise<{ id: string; userId: string }> }
) => {
  requireRole(req, ['admin']);
  const { id, userId } = await ctx.params;

  const enrollment = await query<any[]>(
    'SELECT enrollment_id FROM enrollments WHERE section_id = ? AND user_id = ?',
    [id, userId]
  );
  if (enrollment.length === 0) {
    return json({ success: false, message: 'Enrollment not found.' }, 404);
  }

  const enrollmentId = enrollment[0].enrollment_id;
  await query('DELETE FROM grades WHERE enrollment_id = ?', [enrollmentId]);
  await query('DELETE FROM enrollments WHERE enrollment_id = ?', [enrollmentId]);

  return json({ success: true, message: 'Student removed from section.' });
});
