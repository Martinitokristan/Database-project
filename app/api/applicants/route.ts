import { NextRequest } from 'next/server';
import { transaction, query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const AddressSchema = z.object({
  province:        z.string().min(1),
  city:            z.string().min(1),
  postalCode:      z.string().min(1),
  streetBarangay:  z.string().min(1),
});

const OptionalAddressSchema = z.object({
  province:        z.string().optional().default(''),
  city:            z.string().optional().default(''),
  postalCode:      z.string().optional().default(''),
  streetBarangay:  z.string().optional().default(''),
}).optional().nullable();

const CreateApplicantSchema = z.object({
  email:           z.string().email(),
  course_id:       z.number().int().positive(),
  first_name:      z.string().min(1).max(100),
  middle_name:     z.string().max(100).optional().nullable(),
  last_name:       z.string().min(1).max(100),
  suffix:          z.string().max(20).optional().nullable(),
  current_address: AddressSchema,
  home_address:    OptionalAddressSchema,
  phone:           z.string().min(1).max(11),
  gender:          z.enum(['Male', 'Female', 'Other']),
  date_of_birth:   z.string().min(1),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body   = await req.json();
  const parsed = CreateApplicantSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const {
    email, course_id, first_name, middle_name, last_name, suffix,
    current_address, home_address, phone, gender, date_of_birth,
  } = parsed.data;

  const addressJson = JSON.stringify({ current: current_address, home: home_address ?? null });

  const existing = await query<any[]>('SELECT profile_id FROM profiles WHERE personal_email = ?', [email]);
  if (existing.length > 0) {
    return json({ success: false, message: 'An application with this email already exists.' }, 409);
  }

  const existingUser = await query<any[]>('SELECT user_id FROM users WHERE email = ?', [email]);
  if (existingUser.length > 0) {
    return json({ success: false, message: 'An account with this email already exists.' }, 409);
  }

  const [result] = await query(
    `INSERT INTO profiles (user_id, first_name, middle_name, last_name, suffix, address, phone, gender, date_of_birth, year_level, academic_status, personal_email, course_id)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, '1st Year', 'Good Standing', ?, ?)`,
    [first_name, middle_name ?? null, last_name, suffix ?? null, addressJson, phone, gender, date_of_birth, email, course_id]
  ) as any;

  const newProfileId = result.insertId;

  // Create the application record in the applications table
  await query(
    `INSERT INTO applications (profile_id, course_id, applicant_status, applied_at) VALUES (?, ?, 'Pending', NOW())`,
    [newProfileId, course_id]
  );

  return json({ success: true, data: { applicant_id: newProfileId }, message: 'Application submitted successfully.' }, 201);
});

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const page   = parseInt(searchParams.get('page') || '1');
  const limit  = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  // Join profiles with applications table instead of relying on removed columns
  let whereClauses: string[] = ['app.application_id IS NOT NULL'];
  let params: any[] = [];

  if (status) {
    whereClauses.push('app.applicant_status = ?');
    params.push(status);
  }

  const where = `WHERE ${whereClauses.join(' AND ')}`;

  const applicants = await query<any[]>(
    `SELECT p.*, p.profile_id AS applicant_id, app.applicant_status AS status, app.applied_at, app.application_id,
            p.personal_email AS email, c.course_name,
            u.user_id, sec.section_name,
            (SELECT GROUP_CONCAT(sub2.code SEPARATOR ', ') 
             FROM subject_offerings so2 
             JOIN subjects sub2 ON so2.subject_id = sub2.subject_id 
             WHERE so2.section_id = sec.section_id) AS subjects_summary
     FROM profiles p
     LEFT JOIN applications app ON app.profile_id = p.profile_id
     LEFT JOIN courses c ON p.course_id = c.course_id
     LEFT JOIN users u ON u.user_id = p.user_id
     LEFT JOIN enrollments e ON e.user_id = u.user_id AND e.status = 'Enrolled'
     LEFT JOIN sections sec ON e.section_id = sec.section_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [{ total }] = await query<any[]>(
    `SELECT COUNT(*) AS total 
     FROM profiles p
     LEFT JOIN applications app ON app.profile_id = p.profile_id
     ${where}`,
    params
  );

  return json({ success: true, data: { applicants, total, page, limit } });
});
