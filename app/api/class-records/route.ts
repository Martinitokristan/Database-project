import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const CreateItemSchema = z.object({
  offering_id: z.number().int().positive(),
  record_type: z.enum(['Activity', 'Quiz', 'Assessment', 'Exam']),
  title: z.string().min(1).max(255),
  max_score: z.number().min(0).default(100),
  record_date: z.string().min(1),
  visible_to_students: z.boolean().default(true),
});

// GET: list items for an offering
export const GET = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };

  const { searchParams } = req.nextUrl;
  const offeringId = searchParams.get('offering_id');

  if (!offeringId) throw { status: 400, message: 'offering_id is required.' };

  const role = payload.role_name.toLowerCase();

  // Faculty: only their offerings; Admin: any
  if (role === 'faculty') {
    const check = await query<any[]>(
      'SELECT offering_id FROM subject_offerings WHERE offering_id = ? AND instructor_id = ?',
      [offeringId, payload.user_id]
    );
    if (check.length === 0) throw { status: 403, message: 'Access denied.' };
  }

  const items = await query<any[]>(
    `SELECT cri.*, 
            COUNT(crs.score_id) AS scores_count,
            AVG(crs.score) AS avg_score
     FROM class_record_items cri
     LEFT JOIN class_record_scores crs ON crs.item_id = cri.item_id
     WHERE cri.offering_id = ?
     GROUP BY cri.item_id
     ORDER BY cri.record_date DESC, cri.item_id DESC`,
    [offeringId]
  );

  return json({ success: true, data: items });
});

// POST: create a new record item
export const POST = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const body = await req.json();
  const parsed = CreateItemSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const { offering_id, record_type, title, max_score, record_date, visible_to_students } = parsed.data;

  // Verify faculty owns this offering
  if (role === 'faculty') {
    const check = await query<any[]>(
      'SELECT offering_id FROM subject_offerings WHERE offering_id = ? AND instructor_id = ?',
      [offering_id, payload.user_id]
    );
    if (check.length === 0) throw { status: 403, message: 'Access denied.' };
  }

  const result: any = await query(
    `INSERT INTO class_record_items (offering_id, record_type, title, max_score, record_date, visible_to_students)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [offering_id, record_type, title, max_score, record_date, visible_to_students ? 1 : 0]
  );

  return json({ success: true, data: { item_id: result.insertId }, message: 'Record item created.' }, 201);
});
