import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, getTokenPayload } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin', 'faculty']);

  const { searchParams } = req.nextUrl;
  const sectionId = searchParams.get('section_id');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  if (!sectionId || !month || !year) {
    return new Response('Missing parameters', { status: 400 });
  }

  // Get records
  const results = await query<any[]>(
    `SELECT a.date, a.status, p.first_name, p.last_name, p.user_id
     FROM attendance a
     JOIN profiles p ON a.user_id = p.user_id
     WHERE a.section_id = ? AND MONTH(a.date) = ? AND YEAR(a.date) = ?
     ORDER BY p.last_name, p.first_name, a.date`,
    [sectionId, month, year]
  );

  // Group by student
  const students: Record<string, any> = {};
  const dates = new Set<string>();

  for (const r of results) {
    const key = r.user_id;
    if (!students[key]) {
      students[key] = {
        id: key,
        name: `${r.last_name}, ${r.first_name}`,
        attendance: {}
      };
    }
    const dStr = new Date(r.date).getDate().toString();
    students[key].attendance[dStr] = r.status;
    dates.add(dStr);
  }

  const sortedDates = Array.from(dates).sort((a, b) => Number(a) - Number(b));

  // Build CSV
  let csv = `Student ID,Name,${sortedDates.join(',')}\n`;
  for (const id in students) {
    const s = students[id];
    let row = `${s.id},"${s.name}"`;
    for (const d of sortedDates) {
      row += `,${s.attendance[d] || ''}`;
    }
    csv += row + '\n';
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="attendance-${sectionId}-${year}-${month}.csv"`
    }
  });
});
