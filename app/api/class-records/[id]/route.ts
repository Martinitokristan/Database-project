import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const UpdateItemSchema = z.object({
  record_type: z.enum(['Activity', 'Quiz', 'Assessment', 'Exam']).optional(),
  title: z.string().min(1).max(255).optional(),
  max_score: z.number().min(0).optional(),
  record_date: z.string().optional(),
  visible_to_students: z.boolean().optional(),
});

const SaveScoresSchema = z.object({
  scores: z.array(z.object({
    enrollment_id: z.number().int().positive(),
    score: z.number().min(0).nullable(),
  })),
});

// GET: get item details + all student scores
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };

  const { id } = await ctx.params;
  const itemId = Number(id);
  if (isNaN(itemId)) throw { status: 400, message: 'Invalid ID.' };

  const items = await query<any[]>(
    `SELECT cri.*, so.instructor_id, so.section_id,
            sub.code AS subject_code, sub.title AS subject_title,
            sec.section_name
     FROM class_record_items cri
     JOIN subject_offerings so ON cri.offering_id = so.offering_id
     JOIN subjects sub ON so.subject_id = sub.subject_id
     JOIN sections sec ON so.section_id = sec.section_id
     WHERE cri.item_id = ?`,
    [itemId]
  );
  if (items.length === 0) throw { status: 404, message: 'Record item not found.' };

  const item = items[0];
  const role = payload.role_name.toLowerCase();
  if (role === 'faculty' && item.instructor_id !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  // Get all enrolled students with their scores
  const students = await query<any[]>(
    `SELECT e.enrollment_id, e.user_id,
            p.first_name, p.last_name,
            crs.score_id, crs.score, crs.remarks
     FROM enrollments e
     JOIN users u ON e.user_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     LEFT JOIN class_record_scores crs ON crs.enrollment_id = e.enrollment_id AND crs.item_id = ?
     WHERE e.section_id = ? AND e.status = 'Enrolled'
     ORDER BY p.last_name, p.first_name`,
    [itemId, item.section_id]
  );

  return json({ success: true, data: { ...item, students } });
});

// PUT: update item details
export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params;
  const itemId = Number(id);

  const body = await req.json();

  // Check if this is a scores update
  if (body.scores) {
    const parsed = SaveScoresSchema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
    }

    // Verify ownership
    const items = await query<any[]>(
      `SELECT cri.offering_id, so.instructor_id FROM class_record_items cri
       JOIN subject_offerings so ON cri.offering_id = so.offering_id WHERE cri.item_id = ?`,
      [itemId]
    );
    if (items.length === 0) throw { status: 404, message: 'Not found.' };
    if (role === 'faculty' && items[0].instructor_id !== payload.user_id) {
      throw { status: 403, message: 'Access denied.' };
    }

    // Upsert scores
    for (const s of parsed.data.scores) {
      await query(
        `INSERT INTO class_record_scores (item_id, enrollment_id, score)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score)`,
        [itemId, s.enrollment_id, s.score]
      );
    }

    return json({ success: true, message: 'Scores saved.' });
  }

  // Otherwise update item metadata
  const parsed = UpdateItemSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const items = await query<any[]>(
    `SELECT cri.offering_id, so.instructor_id FROM class_record_items cri
     JOIN subject_offerings so ON cri.offering_id = so.offering_id WHERE cri.item_id = ?`,
    [itemId]
  );
  if (items.length === 0) throw { status: 404, message: 'Not found.' };
  if (role === 'faculty' && items[0].instructor_id !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  const sets: string[] = [];
  const params: any[] = [];
  if (parsed.data.title !== undefined) { sets.push('title = ?'); params.push(parsed.data.title); }
  if (parsed.data.record_type !== undefined) { sets.push('record_type = ?'); params.push(parsed.data.record_type); }
  if (parsed.data.max_score !== undefined) { sets.push('max_score = ?'); params.push(parsed.data.max_score); }
  if (parsed.data.record_date !== undefined) { sets.push('record_date = ?'); params.push(parsed.data.record_date); }
  if (parsed.data.visible_to_students !== undefined) { sets.push('visible_to_students = ?'); params.push(parsed.data.visible_to_students ? 1 : 0); }

  if (sets.length > 0) {
    params.push(itemId);
    await query(`UPDATE class_record_items SET ${sets.join(', ')} WHERE item_id = ?`, params);
  }

  return json({ success: true, message: 'Record item updated.' });
});

// DELETE: remove item + all related scores (cascade)
export const DELETE = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const { id } = await ctx.params;
  const itemId = Number(id);

  const items = await query<any[]>(
    `SELECT cri.offering_id, so.instructor_id FROM class_record_items cri
     JOIN subject_offerings so ON cri.offering_id = so.offering_id WHERE cri.item_id = ?`,
    [itemId]
  );
  if (items.length === 0) throw { status: 404, message: 'Not found.' };
  if (role === 'faculty' && items[0].instructor_id !== payload.user_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  await query('DELETE FROM class_record_items WHERE item_id = ?', [itemId]);

  return json({ success: true, message: 'Record item deleted.' });
});
