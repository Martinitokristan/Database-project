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

  const currentFormat = [current_address.streetBarangay, current_address.city, current_address.province, current_address.postalCode].filter(Boolean).join(', ');
  let homeFormat = '';
  if (home_address && home_address.streetBarangay) {
    homeFormat = [home_address.streetBarangay, home_address.city, home_address.province, home_address.postalCode].filter(Boolean).join(', ');
  }
  const addressStr = homeFormat && homeFormat !== currentFormat ? `${currentFormat} (Current) / ${homeFormat} (Home)` : currentFormat;

  const existing = await query<any[]>('SELECT profile_id FROM profiles WHERE personal_email = ?', [email]);
  if (existing.length > 0) {
    return json({ success: false, message: 'An application with this email already exists.' }, 409);
  }

  const existingUser = await query<any[]>('SELECT user_id FROM users WHERE email = ?', [email]);
  if (existingUser.length > 0) {
    return json({ success: false, message: 'An account with this email already exists.' }, 409);
  }

  try {
    const newProfileId = await transaction(async (conn) => {
      const [result] = await conn.execute(
        `INSERT INTO profiles (user_id, first_name, middle_name, last_name, suffix, address, phone, gender, date_of_birth, personal_email, course_id)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [first_name, middle_name ?? null, last_name, suffix ?? null, addressStr, phone, gender, date_of_birth, email, course_id]
      );
      
      const insertId = (result as any).insertId;

      await conn.execute(
        `INSERT INTO applications (profile_id, course_id, applicant_status, applied_at) VALUES (?, ?, 'Pending', NOW())`,
        [insertId, course_id]
      );

      return insertId;
    });

    return json({ success: true, data: { applicant_id: newProfileId }, message: 'Application submitted successfully.' }, 201);
  } catch (error) {
    console.error('Error submitting application:', error);
    return json({ success: false, message: 'Failed to submit application. Please try again.' }, 500);
  }
});

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const page   = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit  = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20') || 20));
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
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const totalRes = await query<any[]>(
    `SELECT COUNT(*) AS total 
     FROM profiles p
     JOIN applications app ON app.profile_id = p.profile_id
     ${where}`,
    params
  );

  const total = Number(totalRes[0]?.total || 0);

  return json({ success: true, data: { applicants, total, page, limit } });
});
