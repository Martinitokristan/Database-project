import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET  = process.env.JWT_SECRET!;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface TokenPayload {
  user_id:              string;
  role_id:              number;
  role_name:            string;
  must_change_password: boolean;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function generateStudentId(conn: any): Promise<string> {
  const year = new Date().getFullYear();
  const [rows] = await conn.execute(
    'SELECT COUNT(*) AS cnt FROM users WHERE user_id LIKE ?',
    [`${year}-%`]
  );
  const count  = (rows as any[])[0].cnt;
  const padded = String(count + 1).padStart(4, '0');
  return `${year}-${padded}`;
}

export function generateDefaultPassword(lastName: string): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let pass = '';
  for (let i = 0; i < 6; i++) {
    pass += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 3; i++) {
    pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return pass;
}

export function computeRemarks(
  prelim: number | null,
  midterm: number | null,
  final: number | null
): 'Passed' | 'Failed' | 'Incomplete' {
  // Average is based on midterm and final only
  if (midterm === null || final === null) return 'Incomplete';
  const avg = (midterm + final) / 2;
  return avg <= 3.0 ? 'Passed' : 'Failed';
}
