import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const COOKIE_NAME = process.env.COOKIE_NAME || 'acadtrack_token';

export function proxy(req: NextRequest) {
  const raw     = req.cookies.get(COOKIE_NAME)?.value;
  const payload = raw ? verifyToken(raw) : null;
  const path    = req.nextUrl.pathname;

  const publicPaths  = ['/', '/login', '/apply', '/api/auth/login', '/api/applicants', '/api/courses', '/api/semesters'];
  const isPublic     = publicPaths.some(p => path === p || path.startsWith(p));
  const isApiRoute   = path.startsWith('/api/');
  const isStaticFile = path.startsWith('/_next/') || path === '/favicon.ico';

  if (isStaticFile) return NextResponse.next();

  if (isApiRoute && !isPublic && !payload) {
    return NextResponse.json({ success: false, message: 'Unauthenticated.' }, { status: 401 });
  }

  if (!isApiRoute) {
    if (!payload && !isPublic) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (payload?.must_change_password && path !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password', req.url));
    }

    if (payload) {
      const role = payload.role_name.toLowerCase();

      if (path === '/login' || path === '/') {
        if (role === 'admin')   return NextResponse.redirect(new URL('/dashboard', req.url));
        if (role === 'faculty') return NextResponse.redirect(new URL('/home', req.url));
        if (role === 'student') return NextResponse.redirect(new URL('/home', req.url));
      }

      const adminOnlyPaths = ['/dashboard', '/students', '/faculty', '/departments', '/courses', '/subjects', '/enrollments'];
      const isAdminOnly = adminOnlyPaths.some(p => path === p || path.startsWith(p + '/'));
      if (isAdminOnly && role !== 'admin') {
        return NextResponse.redirect(new URL('/login', req.url));
      }

      const studentOnlyPaths = ['/schedule'];
      const isStudentOnly = studentOnlyPaths.some(p => path === p || path.startsWith(p + '/'));
      if (isStudentOnly && role !== 'student') {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
