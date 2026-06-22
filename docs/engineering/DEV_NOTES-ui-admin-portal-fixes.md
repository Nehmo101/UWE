# UI / Admin / Portal Fixes — Technische Analyse

## Root Causes

### Theme-Karten Überlappung
- `.uwe-theme-swatch` in `packages/shared-ui/src/uwe.css` doppelt definiert: Preset-Cards (Zeile ~144) und ThemePicker-Dots (Zeile ~3575).
- Zweite Definition überschreibt die erste → Preset-Buttons rendern als kleine Kreise.
- **Fix:** ThemePicker-Dots auf `.uwe-theme-picker-dot` umbenennen.

### Portal Settings Checkboxen
- Native `<label className="uwe-checkbox">` ohne Toggle-Layout → große Haken-Buttons, schlechte Ausrichtung.
- **Fix:** `.uwe-setting-toggle-row` Komponente/CSS — Label links, Toggle rechts.

### 2FA „API-Route nicht gefunden“
- Studio-Middleware blockiert unbekannte APIs mit 404 (`packages/auth/src/security/middleware.ts`).
- Portal listet `/api/auth/two-factor/*` in `PORTAL_SESSION_API_ROUTES`; Studio nur `/verify` in `PUBLIC_STUDIO_API_ROUTES`.
- Manage-Routen (`/api/auth/two-factor`, `/setup`, `/activate`, `/disable`, `/change-password`) fehlen in Studio-Policy.
- **Fix:** `STUDIO_SESSION_API_ROUTES` analog zu Portal.

### Studio-Warnung „ohne Login“
- `getProductionSafetyWarnings()` pusht bedingungslos `production:studio-exposure` mit severity `critical`.
- Titel irreführend — UWE hat Session-Login; gemeint ist Netzwerk-Schutz.
- **Fix:** `assessStudioSecurity()` nutzen — OK/info/warning/critical nach Konfiguration.

### Welten aus Portal
- `createWorld()` existiert in Repository, aber keine REST-Route/UI.
- **Fix:** `WorldCreationService` + `POST /api/worlds` (Studio + Portal), Portal-UI nur für Owner/Admin.

### Cloudflare/Proxy-Status
- Bisher nur ENV-Heuristiken (`TRUST_PROXY`, `CLOUDFLARE_TUNNEL`).
- **Fix:** `CLOUDFLARE_ACCESS_ENABLED`, Pfad-ENV (`STUDIO_PATH`, `PORTAL_PATH`), URL-Auflösung in Admin-Status.
