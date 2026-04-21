import { NextRequest } from 'next/server';
import { transaction } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';
import { sendEmail, buildFacultyWelcomeEmail } from '@/lib/brevo';
import { z } from 'zod';

const CreateFacultySchema = z.object({
  first_name:     z.string().min(1).max(100),
  middle_name:    z.string().max(100).optional().nullable(),
  last_name:      z.string().min(1).max(100),
  email:          z.string().email(),
  personal_email: z.string().email(),
  gender:         z.enum(['Male', 'Female', 'Other']),
  date_of_birth:  z.string().min(1),
  phone:          z.string().length(11, 'Phone must be exactly 11 digits'),
  address:        z.string().min(1),
  temp_password:  z.string().min(8),
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateFacultySchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const {
    first_name, middle_name, last_name, email,
    personal_email, gender, date_of_birth, phone,
    address, temp_password
  } = parsed.data;

  const result = await transaction(async (conn) => {
    const year = new Date().getFullYear();
    const [rows] = await conn.execute(
      'SELECT COUNT(*) AS cnt FROM users WHERE user_id LIKE ?',
      [`${year}-%`]
    ) as any;
    const count  = rows[0].cnt;
    const padded = String(count + 1).padStart(4, '0');
    const newUserId = `${year}-${padded}`;

    const hashed = await hashPassword(temp_password);

    await conn.execute(
      'INSERT INTO users (user_id, email, password_hash, role_id, must_change_password) VALUES (?, ?, ?, 2, TRUE)',
      [newUserId, email, hashed]
    );

    await conn.execute(
      `INSERT INTO profiles (user_id, first_name, middle_name, last_name, address, phone, gender, date_of_birth, personal_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newUserId, first_name, middle_name ?? null, last_name, address, phone, gender, date_of_birth, personal_email]
    );

    return { user_id: newUserId };
  });

  // Background sending of email
  sendEmail({
    to: { email: personal_email, name: `${first_name} ${last_name}` },
    subject: 'Welcome to AcadTrack - Your Faculty Account is Ready',
    htmlContent: buildFacultyWelcomeEmail({
      firstName: first_name,
      lastName: last_name,
      userId: result.user_id,
      officialEmail: email,
      tempPassword: temp_password,
    }),
  }).catch(err => console.error('[FacultyAPI] Email failed:', err));

  return json({
    success: true,
    data: { user_id: result.user_id },
    message: 'Faculty member created and welcome email sent.'
  }, 201);
});

