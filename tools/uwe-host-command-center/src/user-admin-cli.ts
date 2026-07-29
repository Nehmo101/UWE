import {
  createAuthService,
  createPrismaClient,
  createUserService,
  hashPassword,
} from "@uwe/database/server";

import { loadEnvFromRoot, readStdin } from "./cli-env";

loadEnvFromRoot();

/**
 * Access administration CLI for the UWE Command Center — the „Zugänge" surface.
 * Lets the desktop app provision the owner and every other address without the
 * Studio web UI; the Command Center invokes this over stdout JSON (see
 * command_center.rs). Secrets (passwords) are passed on stdin, never as process
 * arguments.
 *
 * Per address there are four checkboxes — Portal, Studio, Brain, Family — plus
 * the owner flag. The role enum is gone (Notiz Lasse, 2026-07-26).
 *
 * Dazu kommt `ai`: darf diese Adresse die RTX-KI benutzen (G-KI)? Das ist
 * KEIN fünftes App-Häkchen — die vier sagen, welche App jemand betreten darf,
 * `ai` sagt, ob er darin die lokale Inferenz auslösen darf. Es wird deshalb
 * getrennt gelesen und nicht in die Häkchen-Schleife gemischt.
 *
 * Actions:
 *   list                      → { ok, users: [...] }
 *   create   (stdin JSON)     → { ok, user }      body: { displayName, email, password,
 *                                                          portal, studio, brain, family, ai, isOwner }
 *   update   (stdin JSON)     → { ok, user }      body: { id, displayName, email, status,
 *                                                          portal, studio, brain, family, ai, isOwner }
 *   set-password (stdin JSON) → { ok }            body: { id, password }
 *   delete <id>               → { ok, deletedId }
 */

const AREAS = ["portal", "studio", "brain", "family"] as const;
type Area = (typeof AREAS)[number];

interface AreaInput {
  portal?: unknown;
  studio?: unknown;
  brain?: unknown;
  family?: unknown;
  /** RTX-KI. Kein App-Häkchen — siehe Modulkopf. */
  ai?: unknown;
}

/**
 * Reads the four checkboxes plus the AI flag. `undefined` means „leave as is"
 * on update — deshalb kein `?? false`: ein Update, das `ai` nicht mitschickt,
 * darf es nicht stillschweigend abschalten.
 */
function readAreas(input: AreaInput): Partial<Record<`${Area}Access` | "aiAccess", boolean>> {
  const out: Partial<Record<`${Area}Access` | "aiAccess", boolean>> = {};
  for (const area of AREAS) {
    const value = input[area];
    if (value !== undefined) {
      out[`${area}Access`] = value === true;
    }
  }
  if (input.ai !== undefined) {
    out.aiAccess = input.ai === true;
  }
  return out;
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
        const input = JSON.parse(await readStdin()) as AreaInput & {
          displayName?: string;
          email?: string;
          password?: string;
          isOwner?: boolean;
        };
        const displayName = input.displayName?.trim();
        const email = input.email?.trim().toLowerCase();
        if (!displayName) throw new Error("Anzeigename ist erforderlich.");
        if (!email) throw new Error("E-Mail ist erforderlich.");
        if (!input.password || input.password.length < 8)
          throw new Error("Passwort muss mindestens 8 Zeichen haben.");
        if (await db.user.findFirst({ where: { email } }))
          throw new Error(`Es existiert bereits ein Benutzer mit ${email}.`);
        const areas = readAreas(input);
        const user = await auth.createUser({
          displayName,
          email,
          password: input.password,
          isOwner: input.isOwner === true,
          ...areas,
        });
        result = { ok: true, user };
        break;
      }
      case "update": {
        const input = JSON.parse(await readStdin()) as AreaInput & {
          id?: string;
          displayName?: string;
          email?: string;
          isOwner?: boolean;
          status?: "invited" | "active" | "disabled";
        };
        if (!input.id) throw new Error("Benutzer-ID ist erforderlich.");
        const current = await db.user.findUnique({
          where: { id: input.id },
          select: { isOwner: true },
        });
        if (!current) throw new Error("Benutzer nicht gefunden.");
        // Never take the owner flag off the last owner.
        if (input.isOwner === false && current.isOwner) {
          const owners = await db.user.count({ where: { isOwner: true } });
          if (owners <= 1) throw new Error("Der letzte Owner kann nicht herabgestuft werden.");
        }
        if (input.email) {
          const email = input.email.trim().toLowerCase();
          const clash = await db.user.findFirst({ where: { email, NOT: { id: input.id } } });
          if (clash) throw new Error(`Es existiert bereits ein Benutzer mit ${email}.`);
        }
        const updated = await users.updateUser(input.id, {
          displayName: input.displayName?.trim() || undefined,
          email: input.email?.trim().toLowerCase(),
          isOwner: input.isOwner,
          status: input.status,
          ...readAreas(input),
        });
        if (!updated) throw new Error("Benutzer konnte nicht aktualisiert werden.");
        result = { ok: true, user: updated };
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
        const target = await db.user.findUnique({ where: { id }, select: { isOwner: true } });
        if (!target) throw new Error("Benutzer nicht gefunden.");
        // Never leave the deployment without an owner.
        if (target.isOwner) {
          const owners = await db.user.count({ where: { isOwner: true } });
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
