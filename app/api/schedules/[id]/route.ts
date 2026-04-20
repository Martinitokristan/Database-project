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

  const existing = await query<any[]>(
    `SELECT sch.*, so.section_id, so.instructor_id 
     FROM schedules sch
     JOIN subject_offerings so ON sch.offering_id = so.offering_id
     WHERE sch.schedule_id = ?`, 
    [id]
  );
  if (existing.length === 0) return json({ success: false, message: 'Schedule not found.' }, 404);

  const current = existing[0];
  const day_of_week = parsed.data.day_of_week ?? current.day_of_week;
  const start_time  = parsed.data.start_time  ?? current.start_time;
  const end_time    = parsed.data.end_time    ?? current.end_time;
  const room        = parsed.data.room        ?? current.room;

  // 1. Room conflict
  const roomConflict = await query<any[]>(
    `SELECT schedule_id FROM schedules
     WHERE room = ?
       AND day_of_week = ?
       AND schedule_id != ?
       AND start_time < ?
       AND end_time   > ?`,
    [room, day_of_week, id, end_time, start_time]
  );
  if (roomConflict.length > 0) {
    return json({ success: false, message: 'Schedule conflict: room is already booked at this time.' }, 409);
  }

  // 2. Instructor conflict
  const instructorConflict = await query<any[]>(
    `SELECT sch.schedule_id FROM schedules sch
     JOIN subject_offerings so ON sch.offering_id = so.offering_id
     WHERE so.instructor_id = ?
       AND sch.day_of_week  = ?
       AND sch.schedule_id != ?
       AND sch.start_time   < ?
       AND sch.end_time     > ?`,
    [current.instructor_id, day_of_week, id, end_time, start_time]
  );
  if (instructorConflict.length > 0) {
    return json({ success: false, message: 'Instructor conflict: the assigned instructor already has a class at this time.' }, 409);
  }

  // 3. Section conflict
  const sectionConflict = await query<any[]>(
    `SELECT sch.schedule_id FROM schedules sch
     JOIN subject_offerings so ON sch.offering_id = so.offering_id
     WHERE so.section_id  = ?
       AND sch.day_of_week = ?
       AND sch.schedule_id != ?
       AND sch.start_time  < ?
       AND sch.end_time    > ?`,
    [current.section_id, day_of_week, id, end_time, start_time]
  );
  if (sectionConflict.length > 0) {
    return json({ success: false, message: 'Section conflict: this section already has a class at this time.' }, 409);
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
