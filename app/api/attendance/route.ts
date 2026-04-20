import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { requireRole, apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const AttendanceSchema = z.object({
  enrollment_id: z.number().int(),
  section_id:    z.number().int(),
  user_id:       z.string(),
  date:          z.string(),
  status:        z.enum(['Present', 'Late', 'Absent']),
});

const BulkAttendanceSchema = z.object({
  section_id: z.number().int(),
  date:       z.string(),
  status:     z.enum(['Present', 'Late', 'Absent', 'Clear']),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  requireRole(req, ['admin', 'faculty']);

  const { searchParams } = req.nextUrl;
  const sectionId = searchParams.get('section_id');
  const month = searchParams.get('month'); // 1-12
  const year = searchParams.get('year');

  if (!sectionId || !month || !year) {
    return json({ success: false, message: 'Missing parameters.' }, 400);
  }

  // 1. Get all students in the section
  const enrollments = await query<any[]>(
    `SELECT e.enrollment_id, e.user_id, p.first_name, p.last_name
     FROM enrollments e
     JOIN profiles p ON e.user_id = p.user_id
     WHERE e.section_id = ? AND e.status = 'Enrolled'
     ORDER BY p.last_name, p.first_name`,
    [sectionId]
  );

  // 2. Get attendance records for the month
  const records = await query<any[]>(
    `SELECT * FROM attendance
     WHERE section_id = ? AND MONTH(date) = ? AND YEAR(date) = ?`,
    [sectionId, month, year]
  );

  // 3. Compute Summary
  const summary = enrollments.map(e => {
    const studentRecords = records.filter(r => r.user_id === e.user_id);
    const present = studentRecords.filter(r => r.status === 'Present').length;
    const late    = studentRecords.filter(r => r.status === 'Late').length;
    const absent  = studentRecords.filter(r => r.status === 'Absent').length;
    const total   = studentRecords.length;
    // Percent calculation usually based on total school days, but here we can return counts
    return {
      user_id: e.user_id,
      full_name: `${e.last_name}, ${e.first_name}`,
      present, late, absent,
      percent: total > 0 ? Math.round(((present + late) / total) * 100) : 0
    };
  });

  return json({
    success: true,
    data: {
      students: enrollments.map(e => ({ user_id: e.user_id, full_name: `${e.last_name}, ${e.first_name}`, enrollment_id: e.enrollment_id })),
      records,
      summary
    }
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req)!;
  requireRole(req, ['admin', 'faculty']);

  const body = await req.json();

  // If bulk
  if (body.bulk) {
    const parsed = BulkAttendanceSchema.safeParse(body);
    if (!parsed.success) return json({ success: false, message: 'Validation failed.' }, 422);
    const { section_id, date, status } = parsed.data;

    const count = await transaction(async (conn) => {
      if (status === 'Clear') {
        const [res] = await conn.execute(
          'DELETE FROM attendance WHERE section_id = ? AND date = ?',
          [section_id, date]
        );
        return (res as any).affectedRows;
      }

      // Get all students
      const [rows] = await conn.execute(
        "SELECT enrollment_id, user_id FROM enrollments WHERE section_id = ? AND status = 'Enrolled'",
        [section_id]
      );
      const students = rows as any[];
      
      for (const s of students) {
        await conn.execute(
          `INSERT INTO attendance (enrollment_id, section_id, user_id, date, status, marked_by)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = ?, marked_by = ?`,
          [s.enrollment_id, section_id, s.user_id, date, status, payload.user_id, status, payload.user_id]
        );
      }
      return students.length;
    });

    return json({ success: true, message: `Updated ${count} records.`, data: { count } });
  }

  // Single record
  const parsed = AttendanceSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, message: 'Validation failed.' }, 422);

  const { enrollment_id, section_id, user_id, date, status } = parsed.data;

  await query(
    `INSERT INTO attendance (enrollment_id, section_id, user_id, date, status, marked_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = ?, marked_by = ?`,
    [enrollment_id, section_id, user_id, date, status, payload.user_id, status, payload.user_id]
  );

  return json({ success: true, message: 'Attendance saved.' });
});
