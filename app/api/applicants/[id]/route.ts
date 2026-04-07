import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const applicants = await query<any[]>(
    `SELECT a.*, c.course_name, d.department_name,
            p.first_name, p.last_name, p.middle_name, p.suffix,
            p.address, p.phone, p.gender, p.date_of_birth
     FROM applicants a
     LEFT JOIN courses c ON a.course_id = c.course_id
     LEFT JOIN departments d ON c.dept_id = d.dept_id
     LEFT JOIN profiles p ON p.applicant_id = a.applicant_id
     WHERE a.applicant_id = ?`,
    [id]
  );

  if (applicants.length === 0) {
    return json({ success: false, message: 'Applicant not found.' }, 404);
  }

  return json({ success: true, data: applicants[0] });
});
