import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { sendEmail, buildGradeDeadlineEmail } from '@/lib/brevo';

export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = requireRole(req, ['admin']);
  const { id }  = await ctx.params;

  const sem = await query<any[]>(
    'SELECT * FROM semesters WHERE semester_id = ?', [id]
  );
  if (sem.length === 0) return json({ success: false, message: 'Semester not found.' }, 404);
  const semester = sem[0];

  const body = await req.json().catch(() => ({}));
  const type: 'midterm' | 'final' = body.type === 'final' ? 'final' : 'midterm';

  const deadlineValue = type === 'midterm' ? semester.midterm_deadline : semester.final_deadline;
  const typeLabel     = type === 'midterm' ? 'Midterm' : 'Final';

  if (!deadlineValue) {
    return json({
      success: false,
      message: `Please set a ${typeLabel} grade deadline for this semester before notifying.`,
    }, 422);
  }

  /* ── Fetch all faculty who teach in this semester ── */
  const faculty = await query<any[]>(
    `SELECT DISTINCT u.user_id, u.email, p.first_name, p.last_name
     FROM sections s
     JOIN users u    ON u.user_id = s.instructor_id
     JOIN profiles p ON p.user_id = u.user_id
     WHERE s.semester_id = ? AND u.is_active = 1`,
    [id]
  );

  if (faculty.length === 0) {
    return json({ success: false, message: 'No faculty found with sections in this semester.' }, 404);
  }

  const deadline     = new Date(deadlineValue).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const notifTitle   = `${typeLabel} Grade Deadline – ${semester.term} ${semester.school_year}`;
  const notifMessage = `Please submit all ${typeLabel.toLowerCase()} grades by ${deadline}. Failure to meet this deadline may result in incomplete records.`;

  /* ── Insert in-app notifications for each faculty ── */
  await Promise.all(
    faculty.map(f =>
      query(
        'INSERT INTO notifications (user_id, sender_id, title, message) VALUES (?, ?, ?, ?)',
        [f.user_id, payload.user_id, notifTitle, notifMessage]
      )
    )
  );

  /* ── Send email to each faculty ── */
  const results = await Promise.allSettled(
    faculty.map(f =>
      sendEmail({
        to: { email: f.email, name: `${f.first_name} ${f.last_name}` },
        subject: notifTitle,
        htmlContent: buildGradeDeadlineEmail({
          firstName:     f.first_name,
          lastName:      f.last_name,
          term:          semester.term,
          schoolYear:    semester.school_year,
          deadlineType:  typeLabel,
          gradeDeadline: deadlineValue,
          endDate:       semester.end_date,
        }),
      })
    )
  );

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return json({
    success: true,
    message: `Notification sent to ${sent} faculty member${sent !== 1 ? 's' : ''}.${failed > 0 ? ` (${failed} failed)` : ''}`,
    data: {
      sent,
      failed,
      faculty: faculty.map(f => `${f.first_name} ${f.last_name} <${f.email}>`),
    },
  });
});
