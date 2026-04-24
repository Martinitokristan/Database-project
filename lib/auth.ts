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

// Philippine Grading Scale
export const GRADE_SCALE: { min: number; grade: number }[] = [
  { min: 95, grade: 1.0 },
  { min: 90, grade: 1.1 },
  { min: 85, grade: 1.2 },
  { min: 80, grade: 1.3 },
  { min: 75, grade: 1.4 },
  { min: 70, grade: 1.5 },
  { min: 65, grade: 1.6 },
  { min: 60, grade: 1.7 },
  { min: 55, grade: 1.8 },
  { min: 50, grade: 1.9 },
  { min: 45, grade: 2.0 },
  { min: 40, grade: 2.1 },
  { min: 35, grade: 2.2 },
  { min: 30, grade: 2.5 },
  { min: 25, grade: 3.0 },
  { min: 0,  grade: 5.0 },
];

export function percentToGrade(pct: number): string {
  for (const { min, grade } of GRADE_SCALE) {
    if (pct >= min) return grade.toFixed(1);
  }
  return '5.0';
}

export function computeRemarks(
  prelim: number | null,
  midterm: number | null,
  final: number | null
): 'Passed' | 'Failed' | 'Incomplete' {
  // If neither midterm nor final has been entered, it's incomplete
  if (midterm === null && final === null) return 'Incomplete';

  // Calculate average percentage
  const avgPct = (midterm !== null && final !== null)
    ? (midterm + final) / 2
    : (midterm ?? final ?? 0);

  // Convert percentage to grade value (1.0 - 5.0)
  const gradeValue = parseFloat(percentToGrade(avgPct));

  // In the 1.0-5.0 scale, anything 3.0 or below is passing
  return gradeValue <= 3.0 ? 'Passed' : 'Failed';
}
