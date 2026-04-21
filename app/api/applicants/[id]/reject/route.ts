import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const profiles = await query<any[]>(
    `SELECT p.profile_id, app.application_id, app.status AS app_status
     FROM profiles p
     LEFT JOIN applications app ON app.user_id = p.user_id
     WHERE p.profile_id = ?`,
    [id]
  );

  if (profiles.length === 0) {
    return json({ success: false, message: 'Applicant not found.' }, 404);
  }

  if (profiles[0].app_status !== 'Pending') {
    return json({ success: false, message: 'Only pending applicants can be rejected.' }, 409);
  }

  await query(
    'UPDATE applications SET status = ?, resolved_at = NOW() WHERE application_id = ?',
    ['Rejected', profiles[0].application_id]
  );

  return json({ success: true, message: 'Applicant rejected.' });
});
