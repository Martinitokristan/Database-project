import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireRole(req, ['student']);

  const { searchParams } = req.nextUrl;
  const offeringId = searchParams.get('offering_id');

  // Get all visible class record items for the student's enrolled sections
  const whereClauses = ['e.user_id = ?', 'e.status = ?', 'cri.visible_to_students = 1'];
  const params: any[] = [payload.user_id, 'Enrolled'];

  if (offeringId) {
    whereClauses.push('cri.offering_id = ?');
    params.push(offeringId);
  }

  const records = await query<any[]>(
    `SELECT cri.item_id, cri.offering_id, cri.record_type, cri.title, cri.max_score, cri.record_date,
            crs.score, crs.remarks,
            sub.code AS subject_code, sub.title AS subject_title,
            sec.section_name,
            p.first_name AS instructor_first, p.last_name AS instructor_last
     FROM class_record_items cri
     JOIN subject_offerings so ON cri.offering_id = so.offering_id
     JOIN sections sec ON so.section_id = sec.section_id
     JOIN subjects sub ON so.subject_id = sub.subject_id
     JOIN enrollments e ON e.section_id = sec.section_id
     LEFT JOIN class_record_scores crs ON crs.item_id = cri.item_id AND crs.enrollment_id = e.enrollment_id
     LEFT JOIN profiles p ON p.user_id = so.instructor_id
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY cri.record_date DESC, cri.item_id DESC`,
    params
  );

  return json({ success: true, data: records });
});
