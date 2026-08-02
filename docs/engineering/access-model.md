# Zugangsmodell

Stand: 2026-07-27. Ersetzt `roles-review-workflow.md` (Rollen, Capability-Matrix,
Review-Queue) — alle drei sind entfernt.

## Zwei Achsen, mehr nicht

| Achse | Wo | Was sie beantwortet |
|---|---|---|
| **Häkchen** | `User.portalAccess` / `studioAccess` / `brainAccess` / `familyAccess` | Welche App darf diese Adresse betreten? |
| **Welt-Zuordnung** | `WorldMembership` (ohne Rollenwert) | Welche Welt sieht sie? |

Dazu zwei Flags, die keine Achse sind:

- **`User.isOwner`** — Betrieb, Restore, Host-Steuerung, `/admin/*`. Das erste
  Konto aus `/setup` bekommt es zusammen mit allen vier Häkchen.
- **`User.aiAccess`** — darf diese Adresse die **RTX-KI** benutzen (G-KI)?

> Das Häkchen sagt, welche App. Die Welt-Zuordnung sagt, welche Welt. Sonst nichts.

## Die RTX-KI ist kein fünftes Häkchen

Der Satz oben soll gelten bleiben, deshalb sitzt `aiAccess` **neben** den vier
Häkchen und nicht in ihnen. Der Unterschied ist nicht kosmetisch:

| | Häkchen | `aiAccess` |
|---|---|---|
| Beantwortet | Welche App darf ich betreten? | Darf ich darin den RTX-Host beschäftigen? |
| Eins je | App | Konto |
| Ohne es | Ich komme nicht rein | Ich komme rein, die KI-Funktionen fehlen |

Eine KI-Route verlangt **beides**: das Häkchen der App bringt jemanden herein,
`aiAccess` lässt ihn Inferenz auslösen. Der Owner geht immer durch
(`canUseRtxAi` prüft `isOwner` zuerst) — er richtet das Flag schliesslich ein.

**Wo es durchgesetzt wird**, drei Stellen, alle zentral:

| Fläche | Mechanik |
|---|---|
| Studio-API-Routen | Pfadregel in `getRequiredAccessForApiPath` → `"ai"`. Eine Liste, keine Prüfung je Route. |
| Server Actions | `requireStudioAiActionAuth` / `requireBrainAiActionAuth` / `requireFamilyAiActionAuth`. Eine Action kennt ihren Pfad nicht und muss sich selbst melden — `apps/studio/src/lib/server-actions.test.ts` prüft statisch, dass jedes Modul mit KI-Import den Guard nennt. |
| API-Tokens | `aiAccess` reist vom Token-BESITZER mit (`ResolvedApiToken`). Ein Token ist kein Schleichweg um das Häkchen. |

Nicht aufgenommen wird, was KI-Ergebnisse bloss **liest** — Ergebnislisten,
Jobübersichten, eine erzeugte Seite. Wer etwas ansehen darf, muss es nicht
erzeugen dürfen.

**Bestandsdaten:** die Migration `20260729140000_user_ai_access` setzt das Flag
einmalig für alle Konten mit Studio-Häkchen. Grund: diese Konten benutzen die
KI heute schon; ein Vorgabewert von `false` wäre für sie keine Rechteklärung,
sondern ein Ausfall. Neue Konten bekommen nichts stillschweigend — ab hier ist
es eine Entscheidung im Command Center.

## Inhaltsregel

**Wer einer Welt zugeordnet ist, sieht alles darin.** Es gibt keine
Sichtbarkeit pro Seite, keinen Entwurfsstatus, keine Freigabe-Links und keinen
Gastmodus. Das Studio-Häkchen erreicht jede Welt, auch ohne Zuordnung — so
funktioniert die DM-Sicht.

Konsequenz, die bewusst so gewollt ist: Sobald eine Seite in einer Welt
existiert, sehen sie alle Zugeordneten. Vorbereitung, die niemand sehen soll,
passiert außerhalb von UWE — oder in einer Welt, der noch niemand zugeordnet ist.

### Die eine Ausnahme: der DM-Bereich im Wikitext

Ganze Seiten und Blöcke sind nicht mehr abstufbar, ein paar Zeilen mitten im
Text schon. Wer im Wikitext eine Marke setzt, macht daraus einen DM-Bereich:

```
Der Hauptmann empfängt euch freundlich.

:::dm Der wahre Verräter
Roderick arbeitet für die Gegenseite. Er verrät die Gruppe in Sitzung 4.
:::

Danach geht ihr weiter Richtung Hafen.
```

**Wer liest ihn:** wer das **Studio**-Häkchen trägt — plus der Owner, auch ohne
Häkchen. Die Welt-Zuordnung reicht ausdrücklich *nicht*; Studio ist die DM-App,
und DM ist, wer dort hinein darf. Die Vorschau als Spieler fällt heraus, genau
dafür ist sie da. Regel: `canReadDmSections` in `packages/auth/src/permissions.ts`.

**Wie es durchgesetzt wird** — der Bereich wird nicht ausgeblendet, sondern
serverseitig aus dem Text geschnitten, bevor irgendetwas gerendert oder
verschickt wird:

| Fläche | Stelle |
|---|---|
| Blöcke auf jedem Lesepfad (Seite, Graph, Backlinks) | `filterBlocksForViewer` |
| Kurzbeschreibung der Seite | `getPageForViewer`, `listPagesForViewer` |
| Gerendertes HTML (zweites Netz) | `AuthService.renderBlockContentForViewer` |
| Suche — Treffer *und* Ausschnitt | `searchForAuthContext` |
| Spieler-APIs / Export | `sanitizeForPlayer` |

**Fail-closed:** Eine öffnende Marke ohne `:::` macht den gesamten Rest des
Blocks zum DM-Bereich. Ein vergessener Abschluss verschweigt zu viel, nie zu
wenig. Verschachtelung gibt es nicht — das erste `:::` schließt.

**Bearbeitung durch Spieler:** Am eigenen Charakterbogen dürfen Spieler
Textblöcke ändern (`canEditPlayerCharacterBlock`). Sie haben den geschnittenen
Stand bekommen, würden also beim Speichern die DM-Notiz löschen. Deshalb hängt
`preserveDmSections` die gespeicherten Bereiche wieder an; selbst gesetzte
Marken aus so einer Eingabe werden verworfen.

Was **kein** DM-Bereich ist: Seitentitel, Tags, Aliase, Dateinamen von Assets.
Die Marke wirkt in Block-Inhalten und in der Kurzbeschreibung — sonst nirgends.

Parser und Schnitt: `packages/auth/src/dm-section.ts`. Der Kasten, den der DM
im Studio sieht, entsteht in `renderContentHtml` (`packages/database/src/page-service.ts`)
und wird in `apps/studio/app/wiki.css` gestaltet — im Portal gibt es dafür
bewusst keine Regel, weil dort nie etwas ankommt.

## Wo die Regeln im Code stehen

| Frage | Code |
|---|---|
| Darf die Adresse diese App öffnen? | `packages/auth/src/area-access.ts` |
| Darf sie die RTX-KI benutzen? | `packages/auth/src/area-access.ts` → `canUseRtxAi` / `requireRtxAi` |
| Darf die Session diese Studio-Route? | `getRequiredAccessForApiPath` / `getRequiredAccessForPagePath` + `satisfiesStudioRouteAccess` |
| Darf dieser Kontext den Welt-Inhalt lesen? | `packages/auth/src/permissions.ts` → `canViewWorldContent` |
| Darf sie den DM-Bereich im Wikitext lesen? | `packages/auth/src/permissions.ts` → `canReadDmSections` |
| Darf dieser Nutzer *diese* Welt lesen? | `packages/auth/src/security/authz.ts` → `canReadWorld`, `scopeFromAccessContext` |

`scopeFromAccessContext` ist tragend: Es übernimmt eine Zuordnung nur dann,
wenn sie zu *dieser* Welt gehört. Ohne diese Prüfung läse ein Mitglied von
Welt A auch Welt B — die Welt-Grenze ist die einzige verbliebene Inhaltsregel.

## Wo die Häkchen gesetzt werden

Command Center → **Zugänge** (`apps/rtx-connector-client`, Panel `UsersPanel`).
Dort steht neben den vier App-Häkchen auch **RTX-KI** — beim Owner fest
angehakt und nicht abwählbar, weil `isOwner` ohnehin vorgeht und ein
wirkungsloses Häkchen eine Lüge wäre.
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
