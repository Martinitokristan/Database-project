import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const BulkSaveSchema = z.object({
  offering_id: z.number().int().positive(),
  scores: z.array(z.object({
    item_id: z.number().int().positive(),
    enrollment_id: z.number().int().positive(),
    score: z.number().min(0).nullable(),
  })),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };

  const { searchParams } = req.nextUrl;
  const offeringId = searchParams.get('offering_id');

  if (!offeringId) throw { status: 400, message: 'offering_id is required.' };

  const role = payload.role_name.toLowerCase();

  if (role === 'faculty') {
    const check = await query<any[]>(
      'SELECT section_id FROM subject_offerings WHERE offering_id = ? AND instructor_id = ?',
      [offeringId, payload.user_id]
    );
    if (check.length === 0) throw { status: 403, message: 'Access denied.' };
  }

  const offerings = await query<any[]>('SELECT section_id FROM subject_offerings WHERE offering_id = ?', [offeringId]);
  if (offerings.length === 0) throw { status: 404, message: 'Offering not found' };
  const sectionId = offerings[0].section_id;

  const students = await query<any[]>(
    `SELECT e.enrollment_id, e.user_id, p.first_name, p.last_name
     FROM enrollments e
     JOIN users u ON e.user_id = u.user_id
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE e.section_id = ? AND e.status = 'Enrolled'
     ORDER BY p.last_name, p.first_name`,
    [sectionId]
  );

  const items = await query<any[]>(
    `SELECT * FROM class_record_items WHERE offering_id = ? ORDER BY record_date ASC, item_id ASC`,
    [offeringId]
  );

  const scoresResult = await query<any[]>(
    `SELECT crs.item_id, crs.enrollment_id, crs.score
     FROM class_record_scores crs
     JOIN class_record_items cri ON crs.item_id = cri.item_id
     WHERE cri.offering_id = ?`,
    [offeringId]
  );

  const scoresMap: Record<number, Record<number, number | null>> = {};
  students.forEach(s => {
    scoresMap[s.enrollment_id] = {};
    items.forEach(i => {
      scoresMap[s.enrollment_id][i.item_id] = null;
    });
  });

  scoresResult.forEach(row => {
    if (scoresMap[row.enrollment_id]) {
      scoresMap[row.enrollment_id][row.item_id] = row.score;
    }
  });

  return json({ success: true, data: { students, items, scoresMap } });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const body = await req.json();
  const parsed = BulkSaveSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const { offering_id, scores } = parsed.data;

  if (role === 'faculty') {
    const check = await query<any[]>(
      'SELECT section_id FROM subject_offerings WHERE offering_id = ? AND instructor_id = ?',
      [offering_id, payload.user_id]
    );
    if (check.length === 0) throw { status: 403, message: 'Access denied.' };
  }

  // Bulk upsert scores
  for (const s of scores) {
    await query(
      `INSERT INTO class_record_scores (item_id, enrollment_id, score)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE score = VALUES(score)`,
      [s.item_id, s.enrollment_id, s.score]
    );
  }

  return json({ success: true, message: 'Scores saved successfully.' });
});
