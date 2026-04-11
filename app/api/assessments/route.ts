import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, requireAuth, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireAuth(req);
  const { searchParams } = new URL(req.url);
  const sectionId = searchParams.get('section_id');

  if (payload.role_name === 'Admin') {
    const [rows] = await pool.execute(`
      SELECT a.*,
        sec.section_name,
        sub.code AS subject_code, sub.title AS subject_title,
        CONCAT(p.last_name, ', ', p.first_name) AS created_by_name,
        (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.assessment_id) AS question_count,
        (SELECT COUNT(*) FROM assessment_attempts WHERE assessment_id = a.assessment_id AND status != 'InProgress') AS attempt_count
      FROM assessments a
      JOIN sections sec ON sec.section_id = a.section_id
      JOIN subjects sub ON sub.subject_id = sec.subject_id
      JOIN users u ON u.user_id = a.created_by
      JOIN profiles p ON p.user_id = u.user_id
      ORDER BY a.created_at DESC
    `) as any;
    return json({ success: true, data: rows });
  }

  if (payload.role_name === 'Faculty') {
    const params: any[] = [payload.user_id];
    let extra = '';
    if (sectionId) { extra = ' AND a.section_id = ?'; params.push(sectionId); }
    const [rows] = await pool.execute(`
      SELECT a.*,
        sec.section_name,
        sub.code AS subject_code, sub.title AS subject_title,
        (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.assessment_id) AS question_count,
        (SELECT COUNT(*) FROM assessment_attempts WHERE assessment_id = a.assessment_id AND status != 'InProgress') AS attempt_count
      FROM assessments a
      JOIN sections sec ON sec.section_id = a.section_id
      JOIN subjects sub ON sub.subject_id = sec.subject_id
      WHERE a.created_by = ?${extra}
      ORDER BY a.created_at DESC
    `, params) as any;
    return json({ success: true, data: rows });
  }

  // Student — see all published assessments they're enabled for
  // can_start flag indicates if they can start now (time-based check)
  // Use MySQL NOW() for consistent timezone handling
  const [rows] = await pool.execute(`
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
        ORDER BY submitted_at DESC LIMIT 1) AS latest_max_score,
      (a.is_open = TRUE OR (a.open_at <= NOW() AND (a.close_at IS NULL OR a.close_at >= NOW()))) AS can_start
    FROM assessments a
    JOIN sections sec ON sec.section_id = a.section_id
    JOIN subjects sub ON sub.subject_id = sec.subject_id
    JOIN users u ON u.user_id = a.created_by
    JOIN profiles p ON p.user_id = u.user_id
    JOIN enrollments e ON e.section_id = a.section_id AND e.user_id = ?
    LEFT JOIN assessment_access acc ON acc.assessment_id = a.assessment_id AND acc.user_id = ?
    WHERE a.status = 'Published'
      AND (acc.is_enabled = TRUE OR acc.access_id IS NULL)
    ORDER BY a.created_at DESC
  `, [payload.user_id, payload.user_id, payload.user_id, payload.user_id, payload.user_id, payload.user_id]) as any;
  return json({ success: true, data: rows });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = requireRole(req, ['Faculty', 'Admin']);
  const body = await req.json();
  const { title, description, assessment_type, section_id } = body;

  if (!title?.trim()) throw { status: 422, message: 'Title is required.' };
  if (!assessment_type) throw { status: 422, message: 'Assessment type is required.' };
  if (!section_id) throw { status: 422, message: 'Section is required.' };

  if (payload.role_name === 'Faculty') {
    const [check] = await pool.execute(
      'SELECT section_id FROM sections WHERE section_id = ? AND instructor_id = ?',
      [section_id, payload.user_id]
    ) as any;
    if (!check.length) throw { status: 403, message: 'You are not the instructor of this section.' };
  }

  const [result] = await pool.execute(
    `INSERT INTO assessments
      (title, description, assessment_type, section_id, created_by, status)
     VALUES (?, ?, ?, ?, ?, 'Draft')`,
    [title.trim(), description || null, assessment_type, section_id, payload.user_id]
  ) as any;

  const [rows] = await pool.execute(
    'SELECT * FROM assessments WHERE assessment_id = ?',
    [result.insertId]
  ) as any;

  return json({ success: true, data: rows[0], message: 'Assessment created.' }, 201);
});
