const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface SendEmailOptions {
  to: { email: string; name: string };
  subject: string;
  htmlContent: string;
}

export async function sendEmail({ to, subject, htmlContent }: SendEmailOptions): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[Brevo] BREVO_API_KEY not set — email not sent.');
    return;
  }

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: {
        name:  process.env.MAIL_FROM_NAME || 'AcadTrack',
        email: process.env.MAIL_FROM     || 'noreply@acadtrack.com',
      },
      to: [to],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Brevo] Failed to send email:', err);
  }
}

export function buildGradeDeadlineEmail(opts: {
  firstName:     string;
  lastName:      string;
  term:          string;
  schoolYear:    string;
  deadlineType:  string;
  gradeDeadline: string;
  endDate:       string;
}): string {
  const deadline = new Date(opts.gradeDeadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const endDate  = new Date(opts.endDate).toLocaleDateString('en-US',  { year: 'numeric', month: 'long', day: 'numeric' });
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#2563eb;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">AcadTrack</h1>
      <p style="color:#bfdbfe;margin:4px 0 0;">Grade Submission Deadline Notice</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#1e293b;">Dear ${opts.firstName} ${opts.lastName},</h2>
      <p style="color:#475569;margin:0 0 24px;">
        This is an official reminder to submit <strong>${opts.deadlineType} grades</strong> for your sections before the deadline below.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;width:40%;">Semester</td>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.term} ${opts.schoolYear}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Semester End Date</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${endDate}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fee2e2;border:1px solid #fca5a5;font-size:13px;font-weight:700;color:#991b1b;">${opts.deadlineType} Grade Deadline</td>
          <td style="padding:10px 14px;background:#fee2e2;border:1px solid #fca5a5;font-size:13px;font-weight:700;color:#991b1b;">${deadline}</td>
        </tr>
      </table>
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#713f12;">
          ⚠️ Failure to submit ${opts.deadlineType.toLowerCase()} grades before the deadline may result in incomplete student records.
          The GWA will be computed from whatever grades are available when the semester is closed.
        </p>
      </div>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sections"
         style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
        Go to My Sections →
      </a>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        This is an automated message from AcadTrack. Do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildEnrollmentEmail(opts: {
  firstName: string;
  lastName:  string;
  studentId: string;
  email:     string;
  password:  string;
  section:   string;
  subjects:  string[];
  semester:  string;
}): string {
  const subjectsHtml = opts.subjects.map(s => `<li style="margin-bottom:4px;">${s}</li>`).join('');
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#2563eb;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">AcadTrack</h1>
      <p style="color:#bfdbfe;margin:4px 0 0;">University Management System</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#1e293b;">Welcome, ${opts.firstName}!</h2>
      <p style="color:#475569;margin:0 0 24px;">
        Your enrollment has been approved. Below are your account credentials to access the student portal.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;width:40%;">Student ID</td>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.studentId}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Email</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.email}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Temporary Password</td>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.password}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Enrolled Section</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.section}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Semester</td>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.semester}</td>
        </tr>
      </table>

      <div style="margin-bottom:24px;">
        <h3 style="font-size:14px;color:#1e293b;margin:0 0 8px;">Classes (Subject Offerings)</h3>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#475569;">
          ${subjectsHtml}
        </ul>
      </div>

      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#713f12;">
          ⚠️ You will be required to change your password on first login.
        </p>
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login"
         style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
        Login to Portal →
      </a>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        This is an automated message from AcadTrack. Do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildApprovalEmail(opts: {
  firstName:      string;
  lastName:       string;
  studentId:      string;
  acadtrackEmail: string;
  tempPassword:   string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#2563eb;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">AcadTrack</h1>
      <p style="color:#bfdbfe;margin:4px 0 0;">Application Approved</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#1e293b;">Congratulations, ${opts.firstName}!</h2>
      <p style="color:#475569;margin:0 0 24px;">
        Your application to AcadTrack University has been <strong>approved</strong>. Your student account has been created. Below are your login credentials.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;width:40%;">Student ID</td>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.studentId}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">AcadTrack Email</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.acadtrackEmail}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Temporary Password</td>
          <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.tempPassword}</td>
        </tr>
      </table>

      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#713f12;">
          ⚠️ You will be required to change your password on first login. Please keep your credentials safe and do not share them.
        </p>
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login"
         style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
        Login to Portal →
      </a>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        This is an automated message from AcadTrack. Do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildFacultyWelcomeEmail(opts: {
  firstName:    string;
  lastName:     string;
  userId:       string;
  officialEmail: string;
  tempPassword:  string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#4f46e5;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">AcadTrack</h1>
      <p style="color:#c7d2fe;margin:4px 0 0;">Welcome to Faculty Portal</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#1e293b;">Welcome, Professor ${opts.lastName}!</h2>
      <p style="color:#475569;margin:0 0 24px;">
        Your faculty account has been created successfully. You can now use the following credentials to access the portal and manage your classes.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;width:40%;">Faculty ID</td>
          <td style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;font-family:monospace;">${opts.userId}</td>
        </tr>
        <tr>
          <td style="padding:12px;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Official Email</td>
          <td style="padding:12px;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;">${opts.officialEmail}</td>
        </tr>
        <tr>
          <td style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Temporary Password</td>
          <td style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#111827;">${opts.tempPassword}</td>
        </tr>
      </table>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#1e40af;">
          💡 <strong>Security Tip:</strong> You will be required to change your password immediately upon your first login.
        </p>
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login"
         style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;box-shadow:0 4px 6px rgba(79, 70, 229, 0.2);">
        Access Faculty Portal →
      </a>
    </div>
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        &copy; 2026 AcadTrack University Management System. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
}

