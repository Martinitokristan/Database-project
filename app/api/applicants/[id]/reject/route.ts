import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const applicants = await query<any[]>(
    'SELECT * FROM applicants WHERE applicant_id = ?',
    [id]
  );

  if (applicants.length === 0) {
    return json({ success: false, message: 'Applicant not found.' }, 404);
  }

  if (applicants[0].status !== 'Pending') {
    return json({ success: false, message: 'Only pending applicants can be rejected.' }, 409);
  }

  await query(
    'UPDATE applicants SET status = "Rejected" WHERE applicant_id = ?',
    [id]
  );

  return json({ success: true, message: 'Applicant rejected.' });
});
