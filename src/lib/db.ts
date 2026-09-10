import mysql, { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { currentOwner } from "./auth";
import { scopeSelect, type ReadScope } from "./access";

const globalForDb = global as unknown as { pool?: mysql.Pool };

export const pool = globalForDb.pool ?? mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 8,
  decimalNumbers: true,
  dateStrings: true,
});

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export async function rows<T extends RowDataPacket>(sql: string, values: unknown[] = [], scope: ReadScope = "private") {
  if (sql.trim() === "SELECT 1") { const [result] = await pool.execute<T[]>(sql); return result; }
  const [result] = await pool.execute<T[]>(scopeSelect(sql, await currentOwner(), scope), values);
  return result;
}

export async function householdRows<T extends RowDataPacket>(sql: string, values: unknown[] = []) { return rows<T>(sql, values, "household"); }
export async function cashRows<T extends RowDataPacket>(sql: string, values: unknown[] = []) { return rows<T>(sql, values, "cash"); }
export async function sharedRows<T extends RowDataPacket>(sql: string, values: unknown[] = []) { return rows<T>(sql, values, "shared"); }
// Payment account names are shared only inside the authenticated family entry flow.
// This deliberately returns no balances or transaction history.
export async function familyPaymentAccounts<T extends RowDataPacket>() {
  await currentOwner();
  const [result] = await pool.execute<T[]>("SELECT id,name,type,owner,isSharedCash FROM Account WHERE isActive=1 ORDER BY owner,name");
  return result;
}

export async function execute(sql: string, values: unknown[] = []) {
  const [result] = await pool.execute<ResultSetHeader>(sql, values);
  return result;
}

// Shared master records must preserve either person's history. Return only a
// usage flag, never the other owner's financial rows or amounts.
export async function masterRecordInUse(entity: "PROJECT" | "CATEGORY" | "TASK" | "PARTY", id: string) {
  await currentOwner();
  const field = {PROJECT:"projectId", CATEGORY:"categoryId", TASK:"taskId", PARTY:"partyId"}[entity];
  const extra = entity === "CATEGORY" ? " OR EXISTS(SELECT 1 FROM Item WHERE categoryId=?) OR EXISTS(SELECT 1 FROM ExpenseLine WHERE categoryId=?)" : "";
  const [result] = await pool.execute<RowDataPacket[]>(`SELECT EXISTS(SELECT 1 FROM FinancialTransaction WHERE ${field}=?)${extra} AS used`,entity === "CATEGORY" ? [id,id,id] : [id]);
  return Boolean(result[0].used);
}

export async function transaction<T>(work: (connection: PoolConnection) => Promise<T>, scope: ReadScope = "private") {
  const owner = await currentOwner();
  const connection = await pool.getConnection();
  const scoped = new Proxy(connection, { get(target, key) {
    if (key === "execute") return async (sql: string, values: unknown[] = []) => {
      if (!/^\s*SELECT\b/i.test(sql)) return target.execute(sql, values as any);
      // Lock base rows explicitly: an outer FOR UPDATE does not guarantee a lock
      // inside a derived SELECT on every supported MySQL optimizer/version.
      // Discard raw results; only the scoped query may return data to application code.
      if (/\bFOR UPDATE\b/i.test(sql)) await target.execute(sql, values as any);
      return target.execute(scopeSelect(sql, owner, scope), values as any);
    };
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  }});
  try {
    await connection.beginTransaction();
    const result = await work(scoped);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
