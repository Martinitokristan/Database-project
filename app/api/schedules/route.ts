import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const CreateScheduleSchema = z.object({
  offering_id: z.number().int().positive(),
  day_of_week: z.enum(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),
  start_time:  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time:    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  room:        z.string().min(1).max(100),
  start_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };

  const { searchParams } = req.nextUrl;
  const offeringId = searchParams.get('offering_id');
  const sectionId  = searchParams.get('section_id');

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (offeringId) {
    whereClauses.push('sch.offering_id = ?');
    params.push(offeringId);
  }
  if (sectionId) {
    whereClauses.push('so.section_id = ?');
    params.push(sectionId);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const schedules = await query<any[]>(
    `SELECT sch.*,
            so.subject_id, so.section_id, so.instructor_id,
            sub.code AS subject_code, sub.title AS subject_title,
            sec.section_name,
            p.first_name AS instructor_first, p.last_name AS instructor_last
     FROM schedules sch
     JOIN subject_offerings so ON sch.offering_id = so.offering_id
     JOIN subjects sub ON so.subject_id = sub.subject_id
     JOIN sections sec ON so.section_id = sec.section_id
     JOIN users u ON so.instructor_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     ${where}
     ORDER BY FIELD(sch.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), sch.start_time`,
    params
  );

  return json({ success: true, data: schedules });
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { offering_id, day_of_week, start_time, end_time, room, start_date, end_date } = parsed.data;

  // Resolve offering → section_id + instructor_id for conflict checks
  const offering = await query<any[]>(
    'SELECT section_id, instructor_id FROM subject_offerings WHERE offering_id = ?',
    [offering_id]
  );
  if (offering.length === 0) {
    return json({ success: false, message: 'Subject offering not found.' }, 404);
  }
  const { section_id, instructor_id } = offering[0];

  // 1. Room conflict
  const roomConflict = await query<any[]>(
    `SELECT sch.schedule_id FROM schedules sch
     WHERE sch.room = ?
       AND sch.day_of_week = ?
       AND sch.start_time < ?
       AND sch.end_time   > ?`,
    [room, day_of_week, end_time, start_time]
  );
  if (roomConflict.length > 0) {
    return json({ success: false, message: `Room conflict: ${room} is already booked at this time on ${day_of_week}.` }, 409);
  }

  // 2. Instructor conflict
  const instructorConflict = await query<any[]>(
    `SELECT sch.schedule_id FROM schedules sch
     JOIN subject_offerings so ON sch.offering_id = so.offering_id
     WHERE so.instructor_id = ?
       AND sch.day_of_week  = ?
       AND sch.start_time   < ?
       AND sch.end_time     > ?`,
    [instructor_id, day_of_week, end_time, start_time]
  );
  if (instructorConflict.length > 0) {
    return json({ success: false, message: `Instructor conflict: the assigned instructor already has a class at this time on ${day_of_week}.` }, 409);
  }

  // 3. Section conflict
  const sectionConflict = await query<any[]>(
    `SELECT sch.schedule_id FROM schedules sch
     JOIN subject_offerings so ON sch.offering_id = so.offering_id
     WHERE so.section_id  = ?
       AND sch.day_of_week = ?
       AND sch.start_time  < ?
       AND sch.end_time    > ?`,
    [section_id, day_of_week, end_time, start_time]
  );
  if (sectionConflict.length > 0) {
    return json({ success: false, message: `Section conflict: this section already has a class at this time on ${day_of_week}.` }, 409);
  }

  const result: any = await query(
    'INSERT INTO schedules (offering_id, day_of_week, start_time, end_time, room, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [offering_id, day_of_week, start_time, end_time, room, start_date || null, end_date || null]
  );
  return json({ success: true, data: { schedule_id: result.insertId }, message: 'Schedule created.' }, 201);
});
