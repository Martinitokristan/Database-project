import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const profiles = await query<any[]>(
    `SELECT p.*, p.profile_id AS applicant_id, app.applicant_status AS status, app.applied_at,
            p.personal_email AS email, c.course_name, d.department_name
     FROM profiles p
     LEFT JOIN applications app ON app.profile_id = p.profile_id
     LEFT JOIN courses c ON p.course_id = c.course_id
     LEFT JOIN departments d ON c.dept_id = d.dept_id
     WHERE p.profile_id = ?`,
    [id]
  );

  if (profiles.length === 0) {
    return json({ success: false, message: 'Applicant not found.' }, 404);
  }

  return json({ success: true, data: profiles[0] });
});
