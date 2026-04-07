import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, apiHandler, json, getTokenPayload } from '@/lib/middleware';
import { z } from 'zod';

const CreateAnnouncementSchema = z.object({
  title:          z.string().min(1).max(255),
  content:        z.string().min(1),
  type:           z.enum(['General', 'Section']),
  section_id:     z.number().int().positive().nullable().optional(),
  target_role_id: z.number().int().positive().nullable().optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireAuth(req);
  const role    = payload.role_name.toLowerCase();
  const userId  = payload.user_id;
  const roleId  = payload.role_id;

  let announcements: any[];

  if (role === 'admin') {
    announcements = await query<any[]>(
      `SELECT a.*, p.first_name AS sender_first, p.last_name AS sender_last,
              sec.section_name, r.role_name AS target_role
       FROM announcements a
       JOIN users u ON a.sender_id = u.user_id
       LEFT JOIN profiles p ON p.user_id = u.user_id
       LEFT JOIN sections sec ON a.section_id = sec.section_id
       LEFT JOIN roles r ON a.target_role_id = r.role_id
       ORDER BY a.created_at DESC`
    );
  } else if (role === 'faculty') {
    announcements = await query<any[]>(
      `SELECT a.*, p.first_name AS sender_first, p.last_name AS sender_last,
              sec.section_name, r.role_name AS target_role
       FROM announcements a
       JOIN users u ON a.sender_id = u.user_id
       LEFT JOIN profiles p ON p.user_id = u.user_id
       LEFT JOIN sections sec ON a.section_id = sec.section_id
       LEFT JOIN roles r ON a.target_role_id = r.role_id
       WHERE (a.type = 'General' AND (a.target_role_id IS NULL OR a.target_role_id = ?))
          OR (a.type = 'Section' AND sec.instructor_id = ?)
       ORDER BY a.created_at DESC`,
      [roleId, userId]
    );
  } else {
    announcements = await query<any[]>(
      `SELECT a.*, p.first_name AS sender_first, p.last_name AS sender_last,
              sec.section_name, r.role_name AS target_role
       FROM announcements a
       JOIN users u ON a.sender_id = u.user_id
       LEFT JOIN profiles p ON p.user_id = u.user_id
       LEFT JOIN sections sec ON a.section_id = sec.section_id
       LEFT JOIN roles r ON a.target_role_id = r.role_id
       WHERE (a.type = 'General' AND (a.target_role_id IS NULL OR a.target_role_id = ?))
          OR (a.type = 'Section' AND a.section_id IN (
                SELECT section_id FROM enrollments WHERE user_id = ? AND status = 'Enrolled'
              ))
       ORDER BY a.created_at DESC`,
      [roleId, userId]
    );
  }

  return json({ success: true, data: announcements });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = getTokenPayload(req);
  if (!payload) throw { status: 401, message: 'Unauthenticated.' };
  const role = payload.role_name.toLowerCase();
  if (!['admin', 'faculty'].includes(role)) throw { status: 403, message: 'Access denied.' };

  const body   = await req.json();
  const parsed = CreateAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, message: 'Validation failed.', data: parsed.error.flatten() }, 422);
  }

  const { title, content, type, section_id, target_role_id } = parsed.data;

  if (type === 'Section' && !section_id) {
    return json({ success: false, message: 'section_id is required for Section announcements.' }, 422);
  }

  if (type === 'Section' && section_id && role === 'faculty') {
    const section = await query<any[]>('SELECT instructor_id FROM sections WHERE section_id = ?', [section_id]);
    if (section.length === 0 || section[0].instructor_id !== payload.user_id) {
      throw { status: 403, message: 'You can only post to your own sections.' };
    }
  }

  const result: any = await query(
    'INSERT INTO announcements (sender_id, title, content, type, section_id, target_role_id) VALUES (?, ?, ?, ?, ?, ?)',
    [payload.user_id, title, content, type, section_id ?? null, target_role_id ?? null]
  );

  /* ── In-app notifications ── */
  try {
    let recipients: { user_id: string }[] = [];

    if (type === 'Section' && section_id) {
      recipients = await query<any[]>(
        `SELECT e.user_id FROM enrollments e
         WHERE e.section_id = ? AND e.status = 'Enrolled'`,
        [section_id]
      );
    } else if (type === 'General' && target_role_id) {
      recipients = await query<any[]>(
        'SELECT user_id FROM users WHERE role_id = ? AND is_active = 1 AND user_id != ?',
        [target_role_id, payload.user_id]
      );
    } else {
      recipients = await query<any[]>(
        'SELECT user_id FROM users WHERE is_active = 1 AND user_id != ?',
        [payload.user_id]
      );
    }

    if (recipients.length > 0) {
      await Promise.all(
        recipients.map(r =>
          query(
            'INSERT INTO notifications (user_id, sender_id, title, message) VALUES (?, ?, ?, ?)',
            [r.user_id, payload.user_id, title, content.slice(0, 200)]
          )
        )
      );
    }
  } catch { /* notifications are non-critical */ }

  return json({ success: true, data: { announcement_id: result.insertId }, message: 'Announcement created.' }, 201);
});
