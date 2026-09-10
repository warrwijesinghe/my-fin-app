import fs from "node:fs/promises";
import crypto from "node:crypto";
import readline from "node:readline";
// Interactive setup keeps the password out of command arguments and shell history.
if(!process.stdin.isTTY)throw new Error("Run interactively to set JAD Buddhika's password.");
process.stdout.write("New password for JAD Buddhika: ");
const input=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
input._writeToOutput=()=>{};
const password=await new Promise(resolve=>input.question("",resolve));
input.close();process.stdout.write("\n");
if(!password||password.length>1024)throw new Error("Password must contain 1–1024 characters.");
const salt=crypto.randomBytes(16).toString("hex");
const hash=salt+":"+crypto.scryptSync(password,salt,64).toString("hex");
const original=await fs.readFile(".env","utf8");
const line="FIN_WIFE_PASSWORD_HASH="+hash;
const updated=/^FIN_WIFE_PASSWORD_HASH=.*$/m.test(original)?original.replace(/^FIN_WIFE_PASSWORD_HASH=.*$/m,line):original.trimEnd()+"\n"+line+"\n";
await fs.writeFile(".env",updated,{mode:0o600});
console.log("JAD Buddhika's password has been configured. Restart the app to use it.");
