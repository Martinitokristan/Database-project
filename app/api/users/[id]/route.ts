import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  first_name:    z.string().min(1).optional(),
  middle_name:   z.string().nullable().optional(),
  last_name:     z.string().min(1).optional(),
  suffix:        z.string().nullable().optional(),
  gender:        z.enum(['Male', 'Female', 'Other']).optional(),
  date_of_birth: z.string().optional(),
  phone:         z.string().min(7).optional(),
  address:       z.string().min(5).optional(),
  year_level:    z.enum(['1st Year', '2nd Year', '3rd Year', '4th Year', 'Masteral', 'Doctorate', 'Irregular']).nullable().optional(),
  academic_status: z.enum(['Good Standing', 'At Risk', 'Irregular', 'Graduating']).optional(),
  section_id:    z.string().nullable().optional(),
});

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const users = await query<any[]>(
    `SELECT u.user_id, u.email, u.role_id, u.must_change_password, u.is_active, u.created_at,
            r.role_name,
            p.first_name, p.last_name, p.middle_name, p.suffix,
            p.address, p.phone, p.gender, p.date_of_birth,
            p.year_level, p.academic_status,
            e.date_enrolled, e.section_id
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     LEFT JOIN enrollments e ON e.user_id = u.user_id
       AND e.enrollment_id = (SELECT MAX(enrollment_id) FROM enrollments WHERE user_id = u.user_id)
     WHERE u.user_id = ?`,
    [id]
  );

  if (users.length === 0) {
    return json({ success: false, message: 'User not found.' }, 404);
  }

  return json({ success: true, data: users[0] });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const body   = await req.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const existing = await query<any[]>('SELECT user_id FROM users WHERE user_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'User not found.' }, 404);

  const { year_level, academic_status, section_id, ...profileFields } = parsed.data;

  // Update profile fields
  const profileColumns = Object.keys(profileFields);
  if (profileColumns.length > 0 || year_level !== undefined || academic_status !== undefined) {
    const allProfileFields: Record<string, any> = { ...profileFields };
    if (year_level !== undefined) allProfileFields.year_level = year_level;
    if (academic_status !== undefined) allProfileFields.academic_status = academic_status;
    const sets = Object.keys(allProfileFields).map(k => `${k} = ?`).join(', ');
    const vals = Object.values(allProfileFields);
    if (sets) {
      await query(`UPDATE profiles SET ${sets} WHERE user_id = ?`, [...vals, id]);
    }
  }

  // Handle section assignment logic
  if (section_id !== undefined) {
    if (section_id === null || section_id === 'none' || section_id === '') {
      await query('DELETE FROM enrollments WHERE user_id = ?', [id]);
    } else {
      const sectionNum = parseInt(section_id, 10);
      if (!isNaN(sectionNum)) {
        const existingEnrollments = await query<any[]>('SELECT enrollment_id FROM enrollments WHERE user_id = ? LIMIT 1', [id]);
        if (existingEnrollments.length > 0) {
          await query('UPDATE enrollments SET section_id = ? WHERE user_id = ?', [sectionNum, id]);
        } else {
          await query('INSERT INTO enrollments (user_id, section_id, date_enrolled) VALUES (?, ?, CURDATE())', [id, sectionNum]);
        }
      }
    }
  }

  return json({ success: true, message: 'Profile updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const users = await query<any[]>('SELECT user_id FROM users WHERE user_id = ?', [id]);
  if (users.length === 0) {
    return json({ success: false, message: 'User not found.' }, 404);
  }

  await query('UPDATE users SET is_active = FALSE WHERE user_id = ?', [id]);

  return json({ success: true, message: 'User deactivated successfully.' });
});
