import { NextRequest } from 'next/server';
import { transaction, query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { generateStudentId, generateDefaultPassword, hashPassword } from '@/lib/auth';
import { sendEmail, buildApprovalEmail } from '@/lib/brevo';

/**
 * Generate a unique acadtrack email: firstname.lastname@acadtrack.edu.ph
 * If duplicate, append a number: firstname.lastname2@acadtrack.edu.ph
 */
async function generateAcadtrackEmail(
  conn: any,
  firstName: string,
  lastName: string
): Promise<string> {
  const base = `${firstName.toLowerCase().trim()}.${lastName.toLowerCase().trim()}`;
  const domain = 'acadtrack.edu.ph';
  let candidate = `${base}@${domain}`;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [rows] = await conn.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [candidate]
    );
    if ((rows as any[]).length === 0) break;
    counter++;
    candidate = `${base}${counter}@${domain}`;
  }

  return candidate;
}

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  // Fetch the profile inside a transaction
  const result = await transaction(async (conn) => {
    const [profiles] = await conn.execute(
      'SELECT * FROM profiles WHERE profile_id = ? AND applicant_status = "Pending" FOR UPDATE',
      [id]
    ) as any;
    const profile = (profiles as any[])[0];
    if (!profile) throw { status: 404, message: 'Applicant not found or already processed.' };

    // Generate acadtrack email
    const acadtrackEmail = await generateAcadtrackEmail(conn, profile.first_name, profile.last_name);

    // Generate student ID and temporary password
    const userId = await generateStudentId(conn);
    const tempPassword = generateDefaultPassword(profile.last_name);
    const hashedPassword = await hashPassword(tempPassword);

    // Create user account
    await conn.execute(
      'INSERT INTO users (user_id, email, password_hash, role_id, must_change_password) VALUES (?, ?, ?, 3, TRUE)',
      [userId, acadtrackEmail, hashedPassword]
    );

    // Update profile: link to user, update status
    await conn.execute(
      'UPDATE profiles SET user_id = ?, applicant_status = "Enrolled" WHERE profile_id = ?',
      [userId, id]
    );

    return {
      userId,
      acadtrackEmail,
      tempPassword,
      personalEmail: profile.personal_email,
      firstName: profile.first_name,
      lastName: profile.last_name,
    };
  });

  // Send email notification to the student's personal email (fire-and-forget)
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
    data: {
      user_id: result.userId,
      acadtrack_email: result.acadtrackEmail,
    },
    message: 'Applicant approved. Account created and email sent.',
  });
});
