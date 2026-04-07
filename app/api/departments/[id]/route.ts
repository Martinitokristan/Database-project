import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const UpdateDeptSchema = z.object({
  department_name:    z.string().min(2).max(255).optional(),
  department_head_id: z.string().nullable().optional(),
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;
  const body   = await req.json();
  const parsed = UpdateDeptSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const existing = await query<any[]>('SELECT dept_id FROM departments WHERE dept_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Department not found.' }, 404);

  const { department_name, department_head_id } = parsed.data;
  await query(
    'UPDATE departments SET department_name = COALESCE(?, department_name), department_head_id = ? WHERE dept_id = ?',
    [department_name ?? null, department_head_id !== undefined ? department_head_id : existing[0].department_head_id, id]
  );
  return json({ success: true, message: 'Department updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const existing = await query<any[]>('SELECT dept_id FROM departments WHERE dept_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Department not found.' }, 404);

  const inUse = await query<any[]>('SELECT course_id FROM courses WHERE dept_id = ? LIMIT 1', [id]);
  if (inUse.length > 0) return json({ success: false, message: 'Cannot delete: department has associated courses.' }, 409);

  await query('DELETE FROM departments WHERE dept_id = ?', [id]);
  return json({ success: true, message: 'Department deleted.' });
});
