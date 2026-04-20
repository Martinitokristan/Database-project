import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { requireRole, apiHandler, json, getTokenPayload } from '@/lib/middleware';

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req)!;
  requireRole(req, ['admin', 'faculty']);

  const { id } = await ctx.params;
  const offeringId = Number(id);

  // 1. Verify offering exists
  const offerings = await query<any[]>('SELECT instructor_id FROM subject_offerings WHERE offering_id = ?', [offeringId]);
  if (offerings.length === 0) return json({ success: false, message: 'Offering not found.' }, 404);

  // 2. Faculty ownership check
  if (payload.role_name.toLowerCase() === 'faculty') {
    if (offerings[0].instructor_id !== payload.user_id) {
      throw { status: 403, message: 'Access denied. You do not own this subject offering.' };
    }
  }

  // 3. Finalize grades for this specific offering
  const affected = await transaction(async (conn) => {
    const [res] = await conn.execute(
      `UPDATE grades g
       SET g.is_finalized = TRUE, g.finalized_at = NOW()
       WHERE g.offering_id = ?`,
      [offeringId]
    );
    return (res as any).affectedRows;
  });

  return json({
    success: true,
    message: `Successfully finalized grades for ${affected} students.`,
    data: { affected_rows: affected }
  });
});
