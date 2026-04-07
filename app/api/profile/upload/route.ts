import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { query } from '@/lib/db';
import { requireAuth, apiHandler, json } from '@/lib/middleware';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = requireAuth(req);

  const form = await req.formData();
  const file = form.get('avatar') as File | null;

  if (!file) return json({ success: false, message: 'No file provided.' }, 422);
  if (!ALLOWED.includes(file.type))
    return json({ success: false, message: 'Only JPG, PNG, WebP or GIF images are allowed.' }, 422);
  if (file.size > MAX_BYTES)
    return json({ success: false, message: 'Image must be smaller than 2 MB.' }, 422);

  const ext     = file.type.split('/')[1].replace('jpeg', 'jpg');
  const filename = `${payload.user_id}.${ext}`;
  const dir     = join(process.cwd(), 'public', 'uploads', 'avatars');
  const filepath = join(dir, filename);

  await mkdir(dir, { recursive: true });
  await writeFile(filepath, Buffer.from(await file.arrayBuffer()));

  const avatarUrl = `/uploads/avatars/${filename}`;
  await query('UPDATE profiles SET avatar_url = ? WHERE user_id = ?', [avatarUrl, payload.user_id]);

  return json({ success: true, data: { avatar_url: avatarUrl }, message: 'Avatar updated.' });
});
