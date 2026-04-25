import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { json } from '@/lib/middleware';

export const GET = async (req: NextRequest) => {
  try {
    const res = await query(`
      DELETE p FROM profiles p
      LEFT JOIN applications app ON app.profile_id = p.profile_id
      WHERE app.application_id IS NULL AND p.personal_email IS NOT NULL AND p.user_id IS NULL
    `);

    // Also check what applications exist
    const apps = await query("SELECT * FROM applications LIMIT 10");
    const profiles = await query("SELECT profile_id, personal_email FROM profiles WHERE user_id IS NULL LIMIT 10");

    return json({ success: true, data: { deleted: res, apps, profiles, host: process.env.DB_HOST } });
  } catch (err: any) {
    return json({ success: false, message: err.message });
  }
};
