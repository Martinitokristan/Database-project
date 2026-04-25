import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, requireAuth, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const CreateSemesterSchema = z.object({
  school_year:    z.string().min(4).max(20),
  term:           z.string().min(2).max(50),
  start_date:     z.string().min(1),
  end_date:       z.string().min(1),
  midterm_deadline: z.string().optional().nullable(),
  final_deadline:   z.string().optional().nullable(),
  status:           z.enum(['Active', 'Inactive', 'Closed']).default('Inactive'),
});

export const GET = apiHandler(async (req: NextRequest) => {
  requireAuth(req);
  const semesters = await query<any[]>(
    'SELECT * FROM semesters ORDER BY start_date DESC'
  );
  return json({ success: true, data: semesters });
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateSemesterSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { school_year, term, start_date, end_date, midterm_deadline, final_deadline, status } = parsed.data;

  if (status === 'Active') {
    await query('UPDATE semesters SET status = "Inactive" WHERE status = "Active"');
  }

  const result: any = await query(
    'INSERT INTO semesters (school_year, term, start_date, end_date, midterm_deadline, final_deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [school_year, term, start_date, end_date, midterm_deadline ?? null, final_deadline ?? null, status]
  );
  return json({ success: true, data: { semester_id: result.insertId }, message: 'Semester created.' }, 201);
});
