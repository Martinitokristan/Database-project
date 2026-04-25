import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { json } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    const a = await query('DESCRIBE assessments');
    const s = await query('DESCRIBE schedules');
    const g = await query('DESCRIBE grades');
    const so = await query('DESCRIBE subject_offerings');
    return json({ success: true, assessments: a, schedules: s, grades: g, subject_offerings: so });
  } catch (err: any) {
    return json({ success: false, message: err.message });
  }
}
