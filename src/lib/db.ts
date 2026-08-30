import mysql, { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

const globalForDb = global as unknown as { pool?: mysql.Pool };

export const pool = globalForDb.pool ?? mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 8,
  decimalNumbers: true,
  dateStrings: true,
});

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export async function rows<T extends RowDataPacket>(sql: string, values: unknown[] = []) {
  const [result] = await pool.execute<T[]>(sql, values);
  return result;
}

export async function execute(sql: string, values: unknown[] = []) {
  const [result] = await pool.execute<ResultSetHeader>(sql, values);
  return result;
}

export async function transaction<T>(work: (connection: PoolConnection) => Promise<T>) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
