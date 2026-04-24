import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const CreateOfferingSchema = z.object({
  subject_id:    z.number().int().positive(),
  section_id:    z.number().int().positive(),
  instructor_id: z.string().min(1),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { searchParams } = req.nextUrl;
  const sectionId    = searchParams.get('section_id');
  const subjectId    = searchParams.get('subject_id');
  const instructorId = searchParams.get('instructor_id');
  const semesterId   = searchParams.get('semester_id');

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (role === 'faculty') {
    whereClauses.push('so.instructor_id = ?');
    params.push(payload.user_id);
  } else if (instructorId) {
    whereClauses.push('so.instructor_id = ?');
    params.push(instructorId);
  }

  if (sectionId) {
    whereClauses.push('so.section_id = ?');
    params.push(sectionId);
  }
  if (subjectId) {
    whereClauses.push('so.subject_id = ?');
    params.push(subjectId);
  }
  if (semesterId) {
    whereClauses.push('sec.semester_id = ?');
    params.push(semesterId);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const offerings = await query<any[]>(
    `SELECT so.*,
            sub.code AS subject_code, sub.title AS subject_title, sub.credit_units, sub.subject_type,
            sec.section_name, sec.capacity, sec.semester_id, sec.is_archived,
            sem.school_year, sem.term, sem.status AS semester_status,
            p.first_name AS instructor_first, p.last_name AS instructor_last,
            COUNT(DISTINCT e.enrollment_id) AS enrolled_count,
            COUNT(DISTINCT sch.schedule_id) AS schedule_count,
            GROUP_CONCAT(DISTINCT CONCAT(sch.day_of_week, ' ', TIME_FORMAT(sch.start_time, '%H:%i'), '-', TIME_FORMAT(sch.end_time, '%H:%i')) SEPARATOR ', ') as schedule_details
     FROM subject_offerings so
     JOIN subjects sub ON so.subject_id = sub.subject_id
     JOIN sections sec ON so.section_id = sec.section_id
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     LEFT JOIN users u ON so.instructor_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     LEFT JOIN enrollments e ON e.section_id = sec.section_id AND e.status = 'Enrolled'
     LEFT JOIN schedules sch ON sch.offering_id = so.offering_id
     ${where}
     GROUP BY so.offering_id, sub.code, sub.title, sub.credit_units, sub.subject_type,
              sec.section_name, sec.capacity, sec.semester_id, sec.is_archived,
              sem.school_year, sem.term, sem.status,
              p.first_name, p.last_name,
              so.subject_id, so.section_id, so.instructor_id, so.created_at
     ORDER BY sem.school_year DESC, sec.section_name, sub.title`,
    params
  );

  return json({ success: true, data: offerings });
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateOfferingSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { subject_id, section_id, instructor_id } = parsed.data;

  // Check instructor is faculty
  const instructor = await query<any[]>(
    `SELECT u.user_id FROM users u JOIN roles r ON u.role_id = r.role_id
     WHERE u.user_id = ? AND r.role_name = 'Faculty'`,
    [instructor_id]
  );
  if (instructor.length === 0) {
    return json({ success: false, message: 'Instructor not found or is not a faculty member.' }, 404);
  }

  // Check uniqueness
  const existing = await query<any[]>(
    'SELECT offering_id FROM subject_offerings WHERE subject_id = ? AND section_id = ?',
    [subject_id, section_id]
  );
  if (existing.length > 0) {
    return json({ success: false, message: 'This subject is already offered in this section.' }, 409);
  }

  const result: any = await query(
    'INSERT INTO subject_offerings (subject_id, section_id, instructor_id) VALUES (?, ?, ?)',
    [subject_id, section_id, instructor_id]
  );
  const offeringId = result.insertId;

  // If there are already enrolled students, create blank grade records for this new offering
  const enrollments = await query<any[]>('SELECT enrollment_id FROM enrollments WHERE section_id = ? AND status = "Enrolled"', [section_id]);
  if (enrollments.length > 0) {
    for (const e of enrollments) {
      await query('INSERT IGNORE INTO grades (enrollment_id, offering_id) VALUES (?, ?)', [e.enrollment_id, offeringId]);
    }
  }

  return json({ success: true, data: { offering_id: offeringId }, message: 'Subject offering created.' }, 201);
});
