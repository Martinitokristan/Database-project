import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, apiHandler, json } from '@/lib/middleware';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  first_name:    z.string().min(1).max(100).optional(),
  middle_name:   z.string().max(100).nullable().optional(),
  last_name:     z.string().min(1).max(100).optional(),
  suffix:        z.string().max(20).nullable().optional(),
  address:       z.string().min(1).optional(),
  phone:         z.string().min(1).max(20).optional(),
  gender:        z.enum(['Male', 'Female', 'Other']).optional(),
  date_of_birth: z.string().optional(),
});

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = requireAuth(req);
  const { id }  = await ctx.params;

  if (payload.user_id !== id && payload.role_name.toLowerCase() !== 'admin') {
    throw { status: 403, message: 'Access denied.' };
  }

  const profiles = await query<any[]>(
    `SELECT p.*, u.email, u.role_id, r.role_name
     FROM profiles p
     LEFT JOIN users u ON p.user_id = u.user_id
     LEFT JOIN roles r ON u.role_id = r.role_id
     WHERE p.user_id = ?`,
    [id]
  );

  if (profiles.length === 0) {
    return json({ success: false, message: 'Profile not found.' }, 404);
  }

  return json({ success: true, data: profiles[0] });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = requireAuth(req);
  const { id }  = await ctx.params;

  if (payload.user_id !== id && payload.role_name.toLowerCase() !== 'admin') {
    throw { status: 403, message: 'Access denied.' };
  }

  const body   = await req.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const fields = parsed.data;
  const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values     = Object.values(fields);

  if (setClauses === '') {
    return json({ success: false, message: 'No fields to update.' }, 422);
  }

  await query(
    `UPDATE profiles SET ${setClauses} WHERE user_id = ?`,
    [...values, id]
  );

  return json({ success: true, message: 'Profile updated successfully.' });
});
