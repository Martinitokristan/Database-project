import { NextRequest } from 'next/server';
import { transaction, query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const CreateApplicantSchema = z.object({
  email:       z.string().email(),
  course_id:   z.number().int().positive(),
  first_name:  z.string().min(1).max(100),
  middle_name: z.string().max(100).optional().nullable(),
  last_name:   z.string().min(1).max(100),
  suffix:      z.string().max(20).optional().nullable(),
  address:     z.string().min(1),
  phone:       z.string().min(1).max(20),
  gender:      z.enum(['Male', 'Female', 'Other']),
  date_of_birth: z.string().min(1),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body   = await req.json();
  const parsed = CreateApplicantSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const { email, course_id, first_name, middle_name, last_name, suffix, address, phone, gender, date_of_birth } = parsed.data;

  const existing = await query<any[]>('SELECT applicant_id FROM applicants WHERE email = ?', [email]);
  if (existing.length > 0) {
    return json({ success: false, message: 'An application with this email already exists.' }, 409);
  }

  const existingUser = await query<any[]>('SELECT user_id FROM users WHERE email = ?', [email]);
  if (existingUser.length > 0) {
    return json({ success: false, message: 'An account with this email already exists.' }, 409);
  }

  const applicantId = await transaction(async (conn) => {
    const today = new Date().toISOString().slice(0, 10);
    const [result] = await conn.execute(
      'INSERT INTO applicants (email, course_id, status, applied_at) VALUES (?, ?, "Pending", ?)',
      [email, course_id, today]
    ) as any;
    const newApplicantId = result.insertId;

    await conn.execute(
      `INSERT INTO profiles (applicant_id, first_name, middle_name, last_name, suffix, address, phone, gender, date_of_birth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newApplicantId, first_name, middle_name ?? null, last_name, suffix ?? null, address, phone, gender, date_of_birth]
    );

    return newApplicantId;
  });

  return json({ success: true, data: { applicant_id: applicantId }, message: 'Application submitted successfully.' }, 201);
});

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const page   = parseInt(searchParams.get('page') || '1');
  const limit  = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  let whereClauses = [];
  let params: any[] = [];

  if (status) {
    whereClauses.push('a.status = ?');
    params.push(status);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const applicants = await query<any[]>(
    `SELECT a.*, c.course_name, p.first_name, p.last_name, p.middle_name, p.gender, p.phone
     FROM applicants a
     LEFT JOIN courses c ON a.course_id = c.course_id
     LEFT JOIN profiles p ON p.applicant_id = a.applicant_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [{ total }] = await query<any[]>(
    `SELECT COUNT(*) AS total FROM applicants a ${where}`,
    params
  );

  return json({ success: true, data: { applicants, total, page, limit } });
});
