import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const profiles = await query<any[]>(
    'SELECT * FROM profiles WHERE profile_id = ? AND applicant_status IS NOT NULL',
    [id]
  );

  if (profiles.length === 0) {
    return json({ success: false, message: 'Applicant not found.' }, 404);
  }

  if (profiles[0].applicant_status !== 'Pending') {
    return json({ success: false, message: 'Only pending applicants can be rejected.' }, 409);
  }

  await query(
    'UPDATE profiles SET applicant_status = "Rejected" WHERE profile_id = ?',
    [id]
  );

  return json({ success: true, message: 'Applicant rejected.' });
});
