import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const UpdateSemesterSchema = z.object({
  school_year:    z.string().min(4).max(20).optional(),
  term:           z.string().min(2).max(50).optional(),
  start_date:     z.string().optional(),
  end_date:       z.string().optional(),
  midterm_deadline: z.string().nullable().optional(),
  final_deadline:   z.string().nullable().optional(),
  status:           z.enum(['Active', 'Inactive', 'Closed']).optional(),
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;
  const body   = await req.json();
  const parsed = UpdateSemesterSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const existing = await query<any[]>('SELECT semester_id FROM semesters WHERE semester_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Semester not found.' }, 404);

  if (parsed.data.status === 'Active') {
    await query('UPDATE semesters SET status = "Inactive" WHERE status = "Active" AND semester_id != ?', [id]);
  }
  if (parsed.data.status === 'Closed') {
    await query('UPDATE semesters SET status = "Inactive" WHERE status = "Active" AND semester_id != ?', [id]);
  }

  const fields = parsed.data;
  const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values     = Object.values(fields);
  if (!setClauses) return json({ success: false, message: 'No fields to update.' }, 422);

  await query(`UPDATE semesters SET ${setClauses} WHERE semester_id = ?`, [...values, id]);
  return json({ success: true, message: 'Semester updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const existing = await query<any[]>('SELECT semester_id FROM semesters WHERE semester_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Semester not found.' }, 404);

  const inUse = await query<any[]>('SELECT section_id FROM sections WHERE semester_id = ? LIMIT 1', [id]);
  if (inUse.length > 0) return json({ success: false, message: 'Cannot delete: semester has associated sections.' }, 409);

  await query('DELETE FROM semesters WHERE semester_id = ?', [id]);
  return json({ success: true, message: 'Semester deleted.' });
});
