import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, requireAuth, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireAuth(req);
  const { searchParams } = new URL(req.url);
  const offeringId = searchParams.get('offering_id');

  if (payload.role_name === 'Admin') {
    const rows = await query<any[]>(`
      SELECT a.*,
        sec.section_name,
        sub.code AS subject_code, sub.title AS subject_title,
        CONCAT(p.last_name, ', ', p.first_name) AS created_by_name,
        (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.assessment_id) AS question_count,
        (SELECT COUNT(*) FROM assessment_attempts WHERE assessment_id = a.assessment_id AND status != 'InProgress') AS attempt_count
      FROM assessments a
      JOIN subject_offerings so ON so.offering_id = a.offering_id
      JOIN sections sec ON sec.section_id = so.section_id
      JOIN subjects sub ON sub.subject_id = so.subject_id
      JOIN users u ON u.user_id = a.created_by
      JOIN profiles p ON p.user_id = u.user_id
      ORDER BY a.created_at DESC
    `);
    const now = new Date();
    const data = rows.map(a => ({
      ...a,
      can_start: a.is_open === 1 || (
        a.open_at && new Date(a.open_at) <= now && 
        (!a.close_at || new Date(a.close_at) >= now)
      ) ? 1 : 0
    }));

    return json({ success: true, data });
  }

  if (payload.role_name === 'Faculty') {
    const params: any[] = [payload.user_id];
    let extra = '';
    if (offeringId) { extra = ' AND a.offering_id = ?'; params.push(offeringId); }
    const rows = await query<any[]>(`
      SELECT a.*,
        sec.section_name,
        sub.code AS subject_code, sub.title AS subject_title,
        (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.assessment_id) AS question_count,
        (SELECT COUNT(*) FROM assessment_attempts WHERE assessment_id = a.assessment_id AND status != 'InProgress') AS attempt_count
      FROM assessments a
      JOIN subject_offerings so ON so.offering_id = a.offering_id
      JOIN sections sec ON sec.section_id = so.section_id
      JOIN subjects sub ON sub.subject_id = so.subject_id
      WHERE a.created_by = ?${extra}
      ORDER BY a.created_at DESC
    `, params);
    
    const now = new Date();
    const data = rows.map(a => ({
      ...a,
      can_start: a.is_open === 1 || (
        a.open_at && new Date(a.open_at) <= now && 
        (!a.close_at || new Date(a.close_at) >= now)
      ) ? 1 : 0
    }));

    return json({ success: true, data });
  }

  // Student — see all published assessments they're enabled for
  const rows = await query<any[]>(`
    SELECT a.*,
      sec.section_name,
      sub.code AS subject_code, sub.title AS subject_title,
      CONCAT(p.last_name, ', ', p.first_name) AS instructor_name,
      (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.assessment_id) AS question_count,
      (SELECT attempt_id FROM assessment_attempts
        WHERE assessment_id = a.assessment_id AND user_id = ? AND status = 'InProgress'
        LIMIT 1) AS in_progress_attempt_id,
      (SELECT COUNT(*) FROM assessment_attempts
        WHERE assessment_id = a.assessment_id AND user_id = ? AND status != 'InProgress') AS attempts_taken,
      (SELECT score FROM assessment_attempts
        WHERE assessment_id = a.assessment_id AND user_id = ? AND status != 'InProgress'
        ORDER BY submitted_at DESC LIMIT 1) AS latest_score,
      (SELECT max_score FROM assessment_attempts
        WHERE assessment_id = a.assessment_id AND user_id = ? AND status != 'InProgress'
        ORDER BY submitted_at DESC LIMIT 1) AS latest_max_score
    FROM assessments a
    JOIN subject_offerings so ON so.offering_id = a.offering_id
    JOIN sections sec ON sec.section_id = so.section_id
    JOIN subjects sub ON sub.subject_id = so.subject_id
    JOIN users u ON u.user_id = a.created_by
    JOIN profiles p ON p.user_id = u.user_id
    JOIN enrollments e ON e.section_id = so.section_id AND e.user_id = ?
    LEFT JOIN assessment_access acc ON acc.assessment_id = a.assessment_id AND acc.user_id = ?
    WHERE a.status = 'Published'
      AND (acc.is_enabled = TRUE OR acc.access_id IS NULL)
    ORDER BY a.created_at DESC
  `, [payload.user_id, payload.user_id, payload.user_id, payload.user_id, payload.user_id, payload.user_id]);

  const now = new Date();
  const data = rows.map(a => ({
    ...a,
    can_start: a.is_open === 1 || (
      a.open_at && new Date(a.open_at) <= now && 
      (!a.close_at || new Date(a.close_at) >= now)
    ) ? 1 : 0
  }));

  return json({ success: true, data });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = requireRole(req, ['Faculty', 'Admin']);
  const body = await req.json();
  const { title, description, assessment_type, offering_id } = body;

  if (!title?.trim()) throw { status: 422, message: 'Title is required.' };
  if (!assessment_type) throw { status: 422, message: 'Assessment type is required.' };
  if (!offering_id) throw { status: 422, message: 'Offering ID is required.' };

  if (payload.role_name === 'Faculty') {
    const check = await query<any[]>(
      'SELECT offering_id FROM subject_offerings WHERE offering_id = ? AND instructor_id = ?',
      [offering_id, payload.user_id]
    );
    if (!check.length) throw { status: 403, message: 'You are not the instructor of this subject offering.' };
  }

  const result: any = await query(
    `INSERT INTO assessments
      (title, description, assessment_type, offering_id, created_by, status)
     VALUES (?, ?, ?, ?, ?, 'Draft')`,
    [title.trim(), description || null, assessment_type, offering_id, payload.user_id]
  );

  const rows = await query<any[]>(
    'SELECT * FROM assessments WHERE assessment_id = ?',
    [result.insertId]
  );

  return json({ success: true, data: rows[0], message: 'Assessment created.' }, 201);
});
