import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const UpdateCourseSchema = z.object({
  dept_id:     z.number().int().positive().optional(),
  course_name: z.string().min(2).max(255).optional(),
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;
  const body   = await req.json();
  const parsed = UpdateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const existing = await query<any[]>('SELECT course_id FROM courses WHERE course_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Course not found.' }, 404);

  const { dept_id, course_name } = parsed.data;
  await query(
    'UPDATE courses SET dept_id = COALESCE(?, dept_id), course_name = COALESCE(?, course_name) WHERE course_id = ?',
    [dept_id ?? null, course_name ?? null, id]
  );
  return json({ success: true, message: 'Course updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const existing = await query<any[]>('SELECT course_id FROM courses WHERE course_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Course not found.' }, 404);

  const inUse = await query<any[]>('SELECT subject_id FROM subjects WHERE course_id = ? LIMIT 1', [id]);
  if (inUse.length > 0) return json({ success: false, message: 'Cannot delete: course has associated subjects.' }, 409);

  await query('DELETE FROM courses WHERE course_id = ?', [id]);
  return json({ success: true, message: 'Course deleted.' });
});
