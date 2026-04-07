import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const UpdateScheduleSchema = z.object({
  day_of_week: z.enum(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']).optional(),
  start_time:  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  end_time:    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  room:        z.string().min(1).max(100).optional(),
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;
  const body   = await req.json();
  const parsed = UpdateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const existing = await query<any[]>('SELECT * FROM schedules WHERE schedule_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Schedule not found.' }, 404);

  const current = existing[0];
  const day_of_week = parsed.data.day_of_week ?? current.day_of_week;
  const start_time  = parsed.data.start_time  ?? current.start_time;
  const end_time    = parsed.data.end_time    ?? current.end_time;
  const room        = parsed.data.room        ?? current.room;

  const conflicts = await query<any[]>(
    `SELECT schedule_id FROM schedules
     WHERE room = ?
       AND day_of_week = ?
       AND schedule_id != ?
       AND start_time < ?
       AND end_time   > ?`,
    [room, day_of_week, id, end_time, start_time]
  );
  if (conflicts.length > 0) {
    return json({ success: false, message: 'Schedule conflict: room is already booked at this time.' }, 409);
  }

  await query(
    'UPDATE schedules SET day_of_week = ?, start_time = ?, end_time = ?, room = ? WHERE schedule_id = ?',
    [day_of_week, start_time, end_time, room, id]
  );
  return json({ success: true, message: 'Schedule updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const existing = await query<any[]>('SELECT schedule_id FROM schedules WHERE schedule_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Schedule not found.' }, 404);

  await query('DELETE FROM schedules WHERE schedule_id = ?', [id]);
  return json({ success: true, message: 'Schedule deleted.' });
});
