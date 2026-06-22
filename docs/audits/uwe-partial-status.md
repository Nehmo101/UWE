# UWE Partial-Status Audit

Stand: 2026-06-22 (Repo-Commit `31e7ea1`, Branch `cursor/orchestrator-audit-mail-portal-6d11`)

Kurzüberblick über die geprüften Bereiche. **Fertig** = im Code vollständig und konsistent; **Partial** = vorhanden, aber Lücken; **Fehlt** = nicht oder nur Platzhalter.

| Bereich | Aktueller Stand im Code | Partial / fehlt / fertig | Fehlende konkrete Schritte | Betroffene Dateien | Tests/Checks |
|---------|-------------------------|--------------------------|----------------------------|--------------------|--------------|
| **1. Navigation / Submenüs** | `AppShell`/`StudioShell`/`AdminShell`/`PortalShell` in `@uwe/shared-ui`; Navigation pro Seite dupliziert, kein `worlds/[slug]/layout.tsx` | **Partial** | `WorldModuleShell` einführen; `worldNavItems` auf allen Welt-Seiten nutzen; Mobile Bottom Nav auf Welt-Unterseiten; Admin-Sidebar nach Rollen filtern; Dashboard-Link auf `/studio` | `apps/studio/src/lib/admin-sidebar-nav.ts`, `world-nav.ts`, `components/WorldModuleShell.tsx`, Welt-Routen unter `apps/studio/app/worlds/` | Manuell: Mobile + Desktop Welt-Navigation |
| **2. Admin-Bereich** | `/admin` mit `AdminShell`, RBAC via `requireAdminAccess`; Mega-Liste in `adminSidebarNav` | **Partial** | Mail Portal unter Admin bündeln; fehlende Nav-Einträge (`/admin/reviews`, `/admin/ai-gateway`); DM sieht Admin-Links auf `/today` | `apps/studio/app/admin/`, `admin-sidebar-nav.ts`, `AdminModuleShell.tsx` | `pnpm test:security` (Studio route guards) |
| **3. Welten im Portal erzeugen** | `POST /api/worlds` + `CreateWorldForm` auf `/auth/worlds` für Owner/Admin | **Fertig** (Admin) | Studio-UI zeigt Formular allen Studio-Nutzern (API blockiert DM) — Rollen-Gate in UI | `apps/portal/app/auth/worlds/page.tsx`, `apps/studio/app/worlds/page.tsx`, `world-creation-service.ts` | `apps/portal` API + UI manuell |
| **4. Login / Landing / Reset / 2FA** | Gemeinsame Auth-Komponenten in `@uwe/shared-ui`; APIs gespiegelt Studio+Portal | **Partial** | Portal Account-Seiten nutzen Legacy-`auth-page` statt `AuthPageLayout`; SMTP nötig für Reset-E-Mail in Prod | `packages/shared-ui/src/auth/`, `apps/*/app/login/`, `route-policy.ts` | `e2e/studio-password-reset.spec.ts`; `pnpm test:security` |
| **5. UI-Overlaps / Buttons** | `Button`-Komponente mit Varianten; Theme-Swatch-Fix (`.uwe-theme-picker-dot`) | **Partial** | `.uwe-inline-actions` fehlte im CSS (Buttons ohne Layout); weitere Mobile-Breakpoints spot-check | `packages/shared-ui/src/uwe.css`, `uwe-visual-polish.css`, `Button.tsx` | Visuell Desktop/Mobile |
| **6. Cloudflare-Integration** | ENV (`CLOUDFLARE_TUNNEL`, `CLOUDFLARE_ACCESS_ENABLED`), Proxy-Status in `getSystemStatus`, Admin-Status-UI | **Partial** | Kein Live-Access/Tunnel-Verify; `cloudflared` nicht im Host-Setup; Doku für empfohlene Policies | `packages/auth/src/runtime-config.ts`, `admin/status/page.tsx`, `docs/cloudflare-access.md` | `pnpm test`; Admin `/admin/status` |
| **7. Host-Setup-Script** | `setup-uwe-host.sh` idempotent; `--quick`, `--repair`, `--fresh`, `--healthcheck` | **Partial** | Alias `--reset`/`--full-reinstall` fehlte; kein Cloudflare-Prozess-Check | `deploy/scripts/setup-uwe-host.sh`, `scripts/uwe-host-status.sh` | `scripts/selfhost.test.ts` |
| **8. README / Doku** | README mit Docker-Quickstart; `docs/cloudflare-access.md`, `daily-admin-os.md` | **Partial** | Neustart nach Reboot, Cloudflare+Services-Zusammenspiel, Mail Portal | `README.md`, `docs/deployment-hardening.md` | `pnpm docs:check` |
| **9. Admin Mail Portal** | Mail Center (`/mail`) für SMTP/Templates; `MailAccount`, `MailInboxMessage`, `MailDraft` in DB; IMAP-Sync in `@uwe/mail` | **Partial → in Arbeit** | Dediziertes Admin Mail Portal mit Priorisierung, KI-Vorschlägen, Audit; APIs unter `/api/admin/mail/*` | `packages/database/src/mail-*`, `apps/studio/app/admin/mail/`, Migration `20260622140000_mail_portal` | `mail-priority-service.test.ts`, Admin-Mail-API-Smoke |

## Bewusste Annahmen

- **Mail OAuth (Gmail/Outlook):** Schema-Felder vorbereitet; erste Version nutzt Generic IMAP/SMTP + Provider-Presets (Host/Port).
- **KI-Priorisierung:** Regelbasiert + optionaler Inference-Aufruf; kein Auto-Send, kein Auto-Löschen.
- **Welt-Layout-Refactor:** Vollständige Migration aller 31 Welt-Routen auf `WorldModuleShell` erfolgt schrittweise (Dashboard + Nav-Kanon zuerst).

## Nächste empfohlene Schritte (nach diesem PR)

1. Restliche Welt-Routen auf `WorldModuleShell` migrieren.
2. Portal Auth-Account auf `AuthPageLayout` vereinheitlichen.
3. `cloudflared` Health in Host-Setup und Hardware-Cockpit.
4. Gmail/Outlook OAuth-Flows.
5. Mail+Kalender+Tasks-Verknüpfung (Odysseus-Inspiration).
