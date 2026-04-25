import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.COOKIE_NAME || 'acadtrack_token')?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload || payload.role_name.toLowerCase() !== 'admin') {
    redirect('/login');
  }

  return <AdminShell>{children}</AdminShell>;
}

