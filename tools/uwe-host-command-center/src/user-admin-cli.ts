import fs from "node:fs";
import path from "node:path";

import {
  createAuthService,
  createPrismaClient,
  createUserService,
  hashPassword,
} from "@uwe/database/server";

// Minimal .env loader (no dotenv dependency): populate DATABASE_URL/BRAIN_DATABASE_URL
// from the monorepo-root .env for keys not already set, so the CLI talks to the
// same host database as the running apps.
function loadEnvFromRoot(): void {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFromRoot();

type UserRole = "owner" | "admin" | "dm" | "player" | "readonly" | "guest";

/**
 * User/owner administration CLI for the UWE Command Center. Lets the desktop app
 * provision the owner and every other user without the Studio web UI — the
 * Command Center invokes this over stdout JSON (see command_center.rs). Secrets
 * (passwords) are passed on stdin, never as process arguments.
 *
 * Actions:
 *   list                      → { ok, users: [...] }
 *   create   (stdin JSON)     → { ok, user }      body: { displayName, email, password, role }
 *   set-password (stdin JSON) → { ok }            body: { id, password }
 *   delete <id>               → { ok, deletedId }
 */

const VALID_ROLES: readonly UserRole[] = ["owner", "admin", "dm", "player"];

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main(): Promise<void> {
  const action = process.argv[2] ?? "list";
  const db = createPrismaClient();
  const auth = createAuthService(db);
  const users = createUserService(db);
  let result: unknown;

  try {
    switch (action) {
      case "list": {
        result = { ok: true, users: await users.listUsers() };
        break;
      }
      case "create": {
        const input = JSON.parse(await readStdin()) as {
          displayName?: string;
          email?: string;
          password?: string;
          role?: string;
        };
        const displayName = input.displayName?.trim();
        const email = input.email?.trim().toLowerCase();
        const role = (input.role ?? "player") as UserRole;
        if (!displayName) throw new Error("Anzeigename ist erforderlich.");
        if (!email) throw new Error("E-Mail ist erforderlich.");
        if (!input.password || input.password.length < 8)
          throw new Error("Passwort muss mindestens 8 Zeichen haben.");
        if (!VALID_ROLES.includes(role)) throw new Error(`Ungültige Rolle: ${role}`);
        if (await db.user.findFirst({ where: { email } }))
          throw new Error(`Es existiert bereits ein Benutzer mit ${email}.`);
        const user = await auth.createUser({ displayName, email, password: input.password, role });
        result = { ok: true, user };
        break;
      }
      case "set-password": {
        const input = JSON.parse(await readStdin()) as { id?: string; password?: string };
        if (!input.id) throw new Error("Benutzer-ID ist erforderlich.");
        if (!input.password || input.password.length < 8)
          throw new Error("Passwort muss mindestens 8 Zeichen haben.");
        await db.user.update({
          where: { id: input.id },
          data: { passwordHash: await hashPassword(input.password) },
        });
        result = { ok: true };
        break;
      }
      case "delete": {
        const id = process.argv[3];
        if (!id) throw new Error("Benutzer-ID ist erforderlich.");
        const target = await db.user.findUnique({ where: { id }, select: { role: true } });
        if (!target) throw new Error("Benutzer nicht gefunden.");
        // Never leave the deployment without an owner.
        if (target.role === "owner") {
          const owners = await db.user.count({ where: { role: "owner" } });
          if (owners <= 1) throw new Error("Der letzte Owner kann nicht gelöscht werden.");
        }
        // Clear login sessions first, then the user (sessions FK-reference the user).
        await db.session.deleteMany({ where: { userId: id } });
        await db.user.delete({ where: { id } });
        result = { ok: true, deletedId: id };
        break;
      }
      default:
        throw new Error(`Unbekannte Aktion: ${action}`);
    }
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    await db.$disconnect();
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main();
