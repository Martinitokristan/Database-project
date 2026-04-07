import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { AdminShell } from '@/components/layout/AdminShell';
import { FacultyShell } from '@/components/layout/FacultyShell';
import { StudentShell } from '@/components/layout/StudentShell';
import { redirect } from 'next/navigation';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token   = cookieStore.get(process.env.COOKIE_NAME || 'acadtrack_token')?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload) redirect('/login');

  const role = payload.role_name.toLowerCase();

  if (role === 'admin')   return <AdminShell>{children}</AdminShell>;
  if (role === 'faculty') return <FacultyShell>{children}</FacultyShell>;
  return <StudentShell>{children}</StudentShell>;
}
