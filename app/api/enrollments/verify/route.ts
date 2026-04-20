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
    const [profiles] = await conn.execute(
      'SELECT * FROM profiles WHERE profile_id = ? AND applicant_status = "Pending" FOR UPDATE',
      [applicant_id]
    ) as any;
    const profile = (profiles as any[])[0];
    if (!profile) throw { status: 404, message: 'Applicant not found or already processed.' };

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
    
    // Prerequisite logic — check all offerings in this section
    const [offeringsPrereqs] = await conn.execute(
      `SELECT sub.code, sub.title FROM subject_offerings so
       JOIN subjects sub ON so.subject_id = sub.subject_id
       WHERE so.section_id = ? AND sub.prerequisite_id IS NOT NULL`,
      [section_id]
    ) as any;

    if ((offeringsPrereqs as any[]).length > 0) {
      const first = (offeringsPrereqs as any[])[0];
      throw { 
        status: 403, 
        message: `Prerequisite not met. This section contains advanced subjects like ${first.code} — ${first.title}.` 
      };
    }

    if (Number(section.enrolled_count) >= section.capacity) {
      throw { status: 409, message: 'Section is at full capacity.' };
    }

    const userId  = await generateStudentId(conn);
    const plain   = generateDefaultPassword(profile.last_name);
    const hashed  = await hashPassword(plain);

    await conn.execute(
      'INSERT INTO users (user_id, email, password_hash, role_id, must_change_password) VALUES (?, ?, ?, 3, TRUE)',
      [userId, profile.personal_email, hashed]
    );

    await conn.execute(
      'UPDATE profiles SET user_id = ?, applicant_status = "Enrolled" WHERE profile_id = ?',
      [userId, applicant_id]
    );

    const today = new Date().toISOString().slice(0, 10);
    const [enrollment] = await conn.execute(
      'INSERT INTO enrollments (user_id, section_id, status, date_enrolled) VALUES (?, ?, "Enrolled", ?)',
      [userId, section_id, today]
    ) as any;
    const enrollmentId = (enrollment as any).insertId;

    const [offerings] = await conn.execute(
      'SELECT offering_id FROM subject_offerings WHERE section_id = ?',
      [section_id]
    ) as any;

    if (offerings.length > 0) {
      for (const offering of offerings) {
        await conn.execute(
          'INSERT INTO grades (enrollment_id, offering_id) VALUES (?, ?)',
          [enrollmentId, offering.offering_id]
        );
      }
    }

    return { userId, plain, profile, sectionData: section };
  });

  const { userId, plain, profile, sectionData } = studentId as any;

  const sectionInfo = await query<any[]>(
    `SELECT s.section_name, sem.term, sem.school_year
     FROM sections s
     JOIN semesters sem ON s.semester_id = sem.semester_id
     WHERE s.section_id = ?`,
    [section_id]
  );

  const offeringsList = await query<any[]>(
    `SELECT sub.title FROM subject_offerings so
     JOIN subjects sub ON so.subject_id = sub.subject_id
     WHERE so.section_id = ?`,
    [section_id]
  );

  const subjects = offeringsList.map(o => o.title);

  const info = sectionInfo[0];
  sendEmail({
    to: { email: profile.personal_email, name: `${profile.first_name} ${profile.last_name}` },
    subject: 'AcadTrack — Enrollment Approved',
    htmlContent: buildEnrollmentEmail({
      firstName: profile.first_name,
      lastName:  profile.last_name,
      studentId: userId,
      email:     profile.personal_email,
      password:  plain,
      section:   info?.section_name  ?? '',
      subjects:  subjects,
      semester:  info ? `${info.term} ${info.school_year}` : '',
    }),
  }).catch(err => console.error('[Enrollment Email]', err));

  return json({
    success: true,
    data: { user_id: userId },
    message: 'Applicant verified and enrolled successfully.',
  }, 201);
});
