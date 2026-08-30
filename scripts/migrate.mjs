import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const connection = await mysql.createConnection(url);
try {
  await connection.query("CREATE TABLE IF NOT EXISTS `_fin_migrations` (`name` VARCHAR(191) NOT NULL PRIMARY KEY, `appliedAt` DATETIME(3) NOT NULL)");
  const [applied] = await connection.query("SELECT `name` FROM `_fin_migrations`");
  const done = new Set(applied.map((item) => item.name));
  const migrationDir = path.join(process.cwd(), "prisma", "migrations");
  const migrationNames = (await fs.readdir(migrationDir)).sort();
  for (const name of migrationNames) {
    if (done.has(name)) continue;
    const file = path.join(migrationDir, name, "migration.sql");
    const sql = await fs.readFile(file, "utf8");
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean)) await connection.query(statement);
    await connection.execute("INSERT INTO `_fin_migrations` (`name`, `appliedAt`) VALUES (?, NOW(3))", [name]);
    console.log(`Applied ${name}`);
  }
} finally {
  await connection.end();
}
