# Zugangsmodell

Stand: 2026-07-27. Ersetzt `roles-review-workflow.md` (Rollen, Capability-Matrix,
Review-Queue) — alle drei sind entfernt.

## Zwei Achsen, mehr nicht

| Achse | Wo | Was sie beantwortet |
|---|---|---|
| **Häkchen** | `User.portalAccess` / `studioAccess` / `brainAccess` / `familyAccess` | Welche App darf diese Adresse betreten? |
| **Welt-Zuordnung** | `WorldMembership` (ohne Rollenwert) | Welche Welt sieht sie? |

Dazu ein Flag, das keine Achse ist: **`User.isOwner`** — Betrieb, Restore,
Host-Steuerung, `/admin/*`. Das erste Konto aus `/setup` bekommt das Owner-Flag
und alle vier Häkchen.

> Das Häkchen sagt, welche App. Die Welt-Zuordnung sagt, welche Welt. Sonst nichts.

## Inhaltsregel

**Wer einer Welt zugeordnet ist, sieht alles darin.** Es gibt keine
Sichtbarkeit pro Seite, keinen Entwurfsstatus, keine Freigabe-Links und keinen
Gastmodus. Das Studio-Häkchen erreicht jede Welt, auch ohne Zuordnung — so
funktioniert die DM-Sicht.

Konsequenz, die bewusst so gewollt ist: Sobald eine Seite in einer Welt
existiert, sehen sie alle Zugeordneten. Vorbereitung, die niemand sehen soll,
passiert außerhalb von UWE — oder in einer Welt, der noch niemand zugeordnet ist.

## Wo die Regeln im Code stehen

| Frage | Code |
|---|---|
| Darf die Adresse diese App öffnen? | `packages/auth/src/area-access.ts` |
| Darf die Session diese Studio-Route? | `getRequiredAccessForApiPath` / `getRequiredAccessForPagePath` + `satisfiesStudioRouteAccess` |
| Darf dieser Kontext den Welt-Inhalt lesen? | `packages/auth/src/permissions.ts` → `canViewWorldContent` |
| Darf dieser Nutzer *diese* Welt lesen? | `packages/auth/src/security/authz.ts` → `canReadWorld`, `scopeFromAccessContext` |

`scopeFromAccessContext` ist tragend: Es übernimmt eine Zuordnung nur dann,
wenn sie zu *dieser* Welt gehört. Ohne diese Prüfung läse ein Mitglied von
Welt A auch Welt B — die Welt-Grenze ist die einzige verbliebene Inhaltsregel.

## Wo die Häkchen gesetzt werden

Command Center → **Zugänge** (`apps/rtx-connector-client`, Panel `UsersPanel`).
Backend ist `tools/uwe-host-command-center/src/user-admin-cli.ts` mit den
Aktionen `list` / `create` / `update` / `set-password` / `delete`. Es gibt keine
Selbstregistrierung: Konten legt nur der Owner an.

Der Studio-Bereich `/admin/users` kann dasselbe über die Weboberfläche — er
zieht in Schritt 5 ins Command Center um.

## Login

Jeder Einstieg prüft das Häkchen, nicht nur die App dahinter:

| Route | Prüfung |
|---|---|
| `apps/studio/app/api/auth/login` | `canAccessStudio` |
| `apps/portal/app/api/auth/login` | `canAccessPortal` |
| `apps/landing/app/api/auth/enter` | je nach `target`: Portal / Studio / Brain |

Brain hat kein eigenes Login-Formular; es kommt über die Landing herein und
prüft auf jeder Route zusätzlich `canEnterBrain`.
