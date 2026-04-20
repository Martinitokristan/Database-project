import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params;

  const schedules = await query<any[]>(
    `SELECT sch.* 
     FROM schedules sch
     JOIN subject_offerings so ON sch.offering_id = so.offering_id
     WHERE so.section_id = ? 
     ORDER BY FIELD(sch.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), sch.start_time`,
    [id]
  );

  return json({ success: true, data: schedules });
});
