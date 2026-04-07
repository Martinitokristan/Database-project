import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host:     process.env.DB_HOST!,
  port:     Number(process.env.DB_PORT!) || 3306,
  database: process.env.DB_NAME!,
  user:     process.env.DB_USER!,
  password: process.env.DB_PASS!,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

export async function query<T = any>(
  sql: string,
  values?: any[]
): Promise<T> {
  const [rows] = await pool.execute(sql, values);
  return rows as T;
}

export async function transaction<T>(
  callback: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export default pool;
