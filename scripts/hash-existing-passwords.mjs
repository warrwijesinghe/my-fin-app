import crypto from "node:crypto";
import fs from "node:fs/promises";

const file = ".env";
const original = await fs.readFile(file, "utf8");
function hash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
const plain = original.match(/^FIN_APP_PASSWORD=(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, "");
if (!plain) throw new Error("FIN_APP_PASSWORD is missing; no conversion was made.");
const line = `FIN_APP_PASSWORD_HASH=${hash(plain)}`;
const withoutPlain = original.replace(/^FIN_APP_PASSWORD=.*\r?\n?/m, "");
const updated = /^FIN_APP_PASSWORD_HASH=.*$/m.test(withoutPlain)
  ? withoutPlain.replace(/^FIN_APP_PASSWORD_HASH=.*$/m, line)
  : `${withoutPlain.trimEnd()}\n${line}\n`;
await fs.writeFile(file, updated, { mode: 0o600 });
console.log("Your password has been converted to a salted hash.");
