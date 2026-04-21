import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin', 'faculty']);
  const { id } = await ctx.params;
  const sectionId = Number(id);

  const enrollments = await query<any[]>(
    `SELECT e.enrollment_id, e.status, e.date_enrolled,
            u.user_id, u.email,
            p.first_name, p.last_name
     FROM enrollments e
     JOIN users u ON e.user_id = u.user_id
     LEFT JOIN profiles p ON u.user_id = p.user_id
     WHERE e.section_id = ?
     ORDER BY p.last_name ASC, p.first_name ASC`,
    [sectionId]
  );

  return json({ success: true, data: enrollments });
});
