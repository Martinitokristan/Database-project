import { NextRequest } from 'next/server';
import { transaction, query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { generateStudentId, generateDefaultPassword, hashPassword } from '@/lib/auth';
import { sendEmail, buildEnrollmentEmail } from '@/lib/brevo';
import { z } from 'zod';

const VerifySchema = z.object({
  applicant_id: z.number().int().positive(),
  section_id:   z.number().int().positive(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { applicant_id, section_id } = parsed.data;

  const studentId = await transaction(async (conn) => {
    const [apps] = await conn.execute(
      'SELECT * FROM applicants WHERE applicant_id = ? AND status = "Pending" FOR UPDATE',
      [applicant_id]
    ) as any;
    const applicant = (apps as any[])[0];
    if (!applicant) throw { status: 404, message: 'Applicant not found or already processed.' };

    const [sections] = await conn.execute(
      `SELECT s.*, COUNT(e.enrollment_id) AS enrolled_count
       FROM sections s
       LEFT JOIN enrollments e ON e.section_id = s.section_id AND e.status = "Enrolled"
       WHERE s.section_id = ?
       GROUP BY s.section_id
       FOR UPDATE`,
      [section_id]
    ) as any;
    const section = (sections as any[])[0];
    if (!section) throw { status: 404, message: 'Section not found.' };
    if (Number(section.enrolled_count) >= section.capacity) {
      throw { status: 409, message: 'Section is at full capacity.' };
    }

    const [profiles] = await conn.execute(
      'SELECT * FROM profiles WHERE applicant_id = ?',
      [applicant_id]
    ) as any;
    const profile = (profiles as any[])[0];
    if (!profile) throw { status: 404, message: 'Applicant profile not found.' };

    const userId  = await generateStudentId(conn);
    const plain   = generateDefaultPassword(profile.last_name);
    const hashed  = await hashPassword(plain);

    await conn.execute(
      'INSERT INTO users (user_id, email, password_hash, role_id, must_change_password) VALUES (?, ?, ?, 3, TRUE)',
      [userId, applicant.email, hashed]
    );

    await conn.execute(
      'UPDATE profiles SET user_id = ?, applicant_id = NULL WHERE applicant_id = ?',
      [userId, applicant_id]
    );

    const today = new Date().toISOString().slice(0, 10);
    const [enrollment] = await conn.execute(
      'INSERT INTO enrollments (user_id, section_id, status, date_enrolled) VALUES (?, ?, "Enrolled", ?)',
      [userId, section_id, today]
    ) as any;
    const enrollmentId = (enrollment as any).insertId;

    await conn.execute(
      'INSERT INTO grades (enrollment_id) VALUES (?)',
      [enrollmentId]
    );

    await conn.execute(
      'UPDATE applicants SET status = "Enrolled" WHERE applicant_id = ?',
      [applicant_id]
    );

    return { userId, plain, profile, sectionData: section };
  });

  const { userId, plain, profile, sectionData } = studentId as any;

  const sectionInfo = await query<any[]>(
    `SELECT s.section_name, sub.title AS subject_title,
            sem.term, sem.school_year
     FROM sections s
     JOIN subjects sub ON s.subject_id = sub.subject_id
     JOIN semesters sem ON s.semester_id = sem.semester_id
     WHERE s.section_id = ?`,
    [section_id]
  );

  const applicantRow = await query<any[]>(
    'SELECT email FROM applicants WHERE applicant_id = ?',
    [applicant_id]
  );

  const info = sectionInfo[0];
  sendEmail({
    to: { email: applicantRow[0]?.email, name: `${profile.first_name} ${profile.last_name}` },
    subject: 'AcadTrack — Enrollment Approved',
    htmlContent: buildEnrollmentEmail({
      firstName: profile.first_name,
      lastName:  profile.last_name,
      studentId: userId,
      email:     applicantRow[0]?.email,
      password:  plain,
      section:   info?.section_name  ?? '',
      subject:   info?.subject_title ?? '',
      semester:  info ? `${info.term} ${info.school_year}` : '',
    }),
  }).catch(err => console.error('[Enrollment Email]', err));

  return json({
    success: true,
    data: { user_id: userId },
    message: 'Applicant verified and enrolled successfully.',
  }, 201);
});
