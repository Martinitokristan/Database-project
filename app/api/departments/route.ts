import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const CreateDeptSchema = z.object({
  department_name:    z.string().min(2).max(255),
  department_head_id: z.string().nullable().optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const departments = await query<any[]>(
    `SELECT d.*, p.first_name, p.last_name
     FROM departments d
     LEFT JOIN users u ON d.department_head_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     ORDER BY d.department_name`
  );
  return json({ success: true, data: departments });
});

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);
  const body   = await req.json();
  const parsed = CreateDeptSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }
  const { department_name, department_head_id } = parsed.data;
  const result: any = await query(
    'INSERT INTO departments (department_name, department_head_id) VALUES (?, ?)',
    [department_name, department_head_id ?? null]
  );
  return json({ success: true, data: { dept_id: result.insertId }, message: 'Department created.' }, 201);
});
