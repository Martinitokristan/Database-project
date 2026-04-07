import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const CreateScheduleSchema = z.object({
  section_id:  z.number().int().positive(),
  day_of_week: z.enum(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),
  start_time:  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time:    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  room:        z.string().min(1).max(100),
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { section_id, day_of_week, start_time, end_time, room } = parsed.data;

  const conflicts = await query<any[]>(
    `SELECT schedule_id FROM schedules
     WHERE room = ?
       AND day_of_week = ?
       AND start_time < ?
       AND end_time   > ?`,
    [room, day_of_week, end_time, start_time]
  );
  if (conflicts.length > 0) {
    return json({ success: false, message: 'Schedule conflict: room is already booked at this time.' }, 409);
  }

  const result: any = await query(
    'INSERT INTO schedules (section_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)',
    [section_id, day_of_week, start_time, end_time, room]
  );
  return json({ success: true, data: { schedule_id: result.insertId }, message: 'Schedule created.' }, 201);
});
