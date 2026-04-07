import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const UpdateSubjectSchema = z.object({
  course_id:    z.number().int().positive().optional(),
  code:         z.string().min(1).max(50).optional(),
  title:        z.string().min(2).max(255).optional(),
  credit_units: z.number().int().min(1).optional(),
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;
  const body   = await req.json();
  const parsed = UpdateSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const existing = await query<any[]>('SELECT subject_id FROM subjects WHERE subject_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Subject not found.' }, 404);

  if (parsed.data.code) {
    const codeCheck = await query<any[]>(
      'SELECT subject_id FROM subjects WHERE code = ? AND subject_id != ?',
      [parsed.data.code, id]
    );
    if (codeCheck.length > 0) return json({ success: false, message: 'Subject code already in use.' }, 409);
  }

  const fields = parsed.data;
  const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values     = Object.values(fields);
  if (!setClauses) return json({ success: false, message: 'No fields to update.' }, 422);

  await query(`UPDATE subjects SET ${setClauses} WHERE subject_id = ?`, [...values, id]);
  return json({ success: true, message: 'Subject updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const existing = await query<any[]>('SELECT subject_id FROM subjects WHERE subject_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Subject not found.' }, 404);

  const inUse = await query<any[]>('SELECT section_id FROM sections WHERE subject_id = ? LIMIT 1', [id]);
  if (inUse.length > 0) return json({ success: false, message: 'Cannot delete: subject has associated sections.' }, 409);

  await query('DELETE FROM subjects WHERE subject_id = ?', [id]);
  return json({ success: true, message: 'Subject deleted.' });
});
