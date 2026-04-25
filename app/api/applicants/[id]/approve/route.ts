import { NextRequest } from 'next/server';
import { transaction, query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { generateStudentId, generateDefaultPassword, hashPassword } from '@/lib/auth';
import { sendEmail, buildApprovalEmail } from '@/lib/brevo';

async function generateAcadtrackEmail(conn: any, firstName: string, lastName: string): Promise<string> {
  const base = `${firstName.toLowerCase().trim()}.${lastName.toLowerCase().trim()}`;
  const domain = 'acadtrack.edu.ph';
  let candidate = `${base}@${domain}`;
  let counter = 1;
  while (true) {
    const [rows] = await conn.execute('SELECT user_id FROM users WHERE email = ?', [candidate]);
    if ((rows as any[]).length === 0) break;
    counter++;
    candidate = `${base}${counter}@${domain}`;
  }
  return candidate;
}

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const result = await transaction(async (conn) => {
    // Fetch profile — status now lives in applications table
    const [profiles] = await conn.execute(
      `SELECT p.*, app.application_id, app.applicant_status AS app_status
       FROM profiles p
       LEFT JOIN applications app ON app.profile_id = p.profile_id
       WHERE p.profile_id = ?
       FOR UPDATE`,
      [id]
    ) as any;
    const profile = (profiles as any[])[0];
    if (!profile) throw { status: 404, message: 'Applicant not found.' };
    if (profile.app_status && profile.app_status !== 'Pending') {
      throw { status: 409, message: 'Applicant has already been processed.' };
    }

    const acadtrackEmail = await generateAcadtrackEmail(conn, profile.first_name, profile.last_name);
    const userId = await generateStudentId(conn);
    const tempPassword = generateDefaultPassword(profile.last_name);
    const hashedPassword = await hashPassword(tempPassword);

    await conn.execute(
      'INSERT INTO users (user_id, email, password_hash, role_id, must_change_password) VALUES (?, ?, ?, 3, TRUE)',
      [userId, acadtrackEmail, hashedPassword]
    );

    // Link profile AND application to new user
    await conn.execute('UPDATE profiles SET user_id = ? WHERE profile_id = ?', [userId, id]);

    if (profile.application_id) {
      await conn.execute(
        'UPDATE applications SET user_id = ?, applicant_status = ?, updated_at = NOW() WHERE application_id = ?',
        [userId, 'Enrolled', profile.application_id]
      );
    } else {
      await conn.execute(
        'INSERT INTO applications (user_id, profile_id, course_id, applicant_status, updated_at) VALUES (?, ?, ?, ?, NOW())',
        [userId, id, profile.course_id, 'Enrolled']
      );
    }

    return { userId, acadtrackEmail, tempPassword, personalEmail: profile.personal_email, firstName: profile.first_name, lastName: profile.last_name };
  });

  sendEmail({
    to: { email: result.personalEmail, name: `${result.firstName} ${result.lastName}` },
    subject: 'AcadTrack — Your Application Has Been Approved!',
    htmlContent: buildApprovalEmail({
      firstName:      result.firstName,
      lastName:       result.lastName,
      studentId:      result.userId,
      acadtrackEmail: result.acadtrackEmail,
      tempPassword:   result.tempPassword,
    }),
  }).catch(err => console.error('[Approval Email]', err));

  return json({
    success: true,
    data: { user_id: result.userId, acadtrack_email: result.acadtrackEmail },
    message: 'Applicant approved. Account created and email sent.',
  });
});
