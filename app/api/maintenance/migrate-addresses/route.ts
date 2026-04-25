import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const profiles = await query<any[]>('SELECT profile_id, address FROM profiles');
  const report = {
    total: profiles.length,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: [] as string[]
  };

  await transaction(async (conn) => {
    for (const p of profiles) {
      try {
        let isJson = false;
        let parsed: any = null;

        try {
          // Check if it's a JSON string
          if (p.address.trim().startsWith('{')) {
            parsed = JSON.parse(p.address);
            isJson = true;
          }
        } catch {
          isJson = false;
        }

        if (isJson && parsed && parsed.current) {
          const c = parsed.current;
          const flattened = [
            c.streetBarangay,
            c.city,
            c.province,
            c.postalCode
          ].filter(Boolean).join(', ');

          await conn.execute(
            'UPDATE profiles SET address = ? WHERE profile_id = ?',
            [flattened, p.profile_id]
          );
          report.updated++;
          report.details.push(`ID ${p.profile_id}: Flattened JSON`);
        } else {
          report.skipped++;
        }
      } catch (err: any) {
        report.errors++;
        report.details.push(`ID ${p.profile_id}: Error - ${err.message}`);
      }
    }
  });

  return json({ success: true, data: report });
});
