import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const UpdateSectionSchema = z.object({
  section_name: z.string().min(1).max(100).optional(),
  year_level:   z.enum(['1st Year','2nd Year','3rd Year','4th Year','Masteral','Doctorate','Irregular']).optional(),
  capacity:     z.number().int().min(1).optional(),
  is_archived:  z.boolean().optional(),
  semester_id:  z.number().int().positive().optional(),
});

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params;

  const sections = await query<any[]>(
    `SELECT sec.*,
            sem.school_year, sem.term, sem.status AS semester_status,
            COUNT(DISTINCT e.enrollment_id) AS enrolled_count
     FROM sections sec
     JOIN semesters sem ON sec.semester_id = sem.semester_id
     LEFT JOIN enrollments e ON e.section_id = sec.section_id AND e.status = 'Enrolled'
     WHERE sec.section_id = ?
     GROUP BY sec.section_id, sem.school_year, sem.term, sem.status,
              sec.section_name, sec.semester_id, sec.year_level_id, sec.capacity, sec.is_archived, sec.created_at`,
    [id]
  );

  if (sections.length === 0) return json({ success: false, message: 'Section not found.' }, 404);

  // Faculty access check — must have an offering in this section
  if (role === 'faculty') {
    const offering = await query<any[]>(
      'SELECT offering_id FROM subject_offerings WHERE section_id = ? AND instructor_id = ? LIMIT 1',
      [id, payload.user_id]
    );
    if (offering.length === 0) throw { status: 403, message: 'Access denied.' };
  }

  // Fetch subject offerings for this section
  const offerings = await query<any[]>(
    `SELECT so.offering_id, so.subject_id, so.instructor_id,
            sub.code AS subject_code, sub.title AS subject_title, sub.credit_units,
            p.first_name AS instructor_first, p.last_name AS instructor_last
     FROM subject_offerings so
     JOIN subjects sub ON so.subject_id = sub.subject_id
     JOIN users u ON so.instructor_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE so.section_id = ?
     ORDER BY sub.title`,
    [id]
  );

  return json({ success: true, data: { ...sections[0], offerings } });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;
  const body   = await req.json();
  const parsed = UpdateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const existing = await query<any[]>('SELECT section_id FROM sections WHERE section_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Section not found.' }, 404);

  const { year_level, ...otherFields } = parsed.data;
  const updateData: Record<string, any> = { ...otherFields };

  if (year_level !== undefined) {
    if (year_level === null) {
      updateData.year_level_id = null;
    } else {
      const ylRes = await query<any[]>('SELECT year_level_id FROM year_levels WHERE level_name = ?', [year_level]);
      if (ylRes.length > 0) updateData.year_level_id = ylRes[0].year_level_id;
    }
  }

  const setClauses = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
  const values     = Object.values(updateData);
  if (!setClauses) return json({ success: false, message: 'No fields to update.' }, 422);

  await query(`UPDATE sections SET ${setClauses} WHERE section_id = ?`, [...values, id]);
  return json({ success: true, message: 'Section updated.' });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(req, ['admin']);
  const { id } = await ctx.params;

  const existing = await query<any[]>('SELECT section_id FROM sections WHERE section_id = ?', [id]);
  if (existing.length === 0) return json({ success: false, message: 'Section not found.' }, 404);

  const inUse = await query<any[]>('SELECT enrollment_id FROM enrollments WHERE section_id = ? LIMIT 1', [id]);
  if (inUse.length > 0) return json({ success: false, message: 'Cannot delete: section has active enrollments.' }, 409);

  // Cascade: delete schedules → subject_offerings → section
  await query('DELETE sch FROM schedules sch JOIN subject_offerings so ON sch.offering_id = so.offering_id WHERE so.section_id = ?', [id]);
  await query('DELETE FROM subject_offerings WHERE section_id = ?', [id]);
  await query('DELETE FROM sections WHERE section_id = ?', [id]);
  return json({ success: true, message: 'Section deleted.' });
});
