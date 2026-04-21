import { NextRequest } from 'next/server';
import { verifyToken, TokenPayload } from './auth';

const COOKIE_NAME = process.env.COOKIE_NAME || 'acadtrack_token';

export function getTokenPayload(req: NextRequest): TokenPayload | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  return verifyToken(cookie);
}

export function requireAuth(req: NextRequest): TokenPayload {
  const payload = getTokenPayload(req);
  if (!payload) {
    throw { status: 401, message: 'Unauthenticated.' };
  }
  return payload;
}

export function requireRole(
  req: NextRequest,
  roles: string[]
): TokenPayload {
  const payload = requireAuth(req);
  const roleName = payload.role_name.toLowerCase();
  if (!roles.map(r => r.toLowerCase()).includes(roleName)) {
    throw { status: 403, message: 'Access denied.' };
  }
  return payload;
}

export function json(
  data: { success: boolean; data?: any; message?: string },
  status = 200
) {
  return Response.json(data, { status });
}

export function apiHandler(
  fn: (req: NextRequest, ctx?: any) => Promise<Response>
) {
  return async (req: NextRequest, ctx?: any): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err: any) {
      if (err?.status) {
        return json({ success: false, message: err.message }, err.status);
      }
      console.error('[API ERROR]', err);
      return json({ success: false, message: 'Internal server error.' }, 500);
    }
  };
}

