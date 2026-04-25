import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host:     process.env.DB_HOST!,
  port:     Number(process.env.DB_PORT!) || 3306,
  database: process.env.DB_NAME!,
  user:     process.env.DB_USER!,
  password: process.env.DB_PASS!,
  ssl:      process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: true,
  } : undefined,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 seconds
  connectTimeout: 10000, // 10 seconds
  maxIdle: 10,
  idleTimeout: 20000,
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
});

export async function query<T = any>(
  sql: string,
  values?: any[]
): Promise<T> {
  let retries = 3;
  while (retries > 0) {
    try {
      const [rows] = await pool.execute(sql, values);
      return rows as T;
    } catch (err: any) {
      if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        retries--;
        if (retries === 0) throw err;
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Query failed after max retries');
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
