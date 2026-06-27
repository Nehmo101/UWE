# AI Troubleshooting

## RTX nicht erreichbar

**Symptom:** „Lokale RTX-Inference ist nicht erreichbar“

1. RTX-Laptop eingeschaltet?
2. Direkter Runner-Endpunkt korrekt (`AI_INFERENCE_BASE_URL`, LAN-IP, nicht localhost vom Server)?
3. Falls ein separater RTX-Worker genutzt wird: `RTX_BASE_URL` und `RTX_SERVICE_TOKEN` gemeinsam gesetzt?
4. Firewall: Port von Ollama/LM Studio oder des expliziten RTX-Workers im Heimnetz erreichbar?
5. `/admin/status` oder Cookbook → RTX Health prüfen

## Cloud-Fallback funktioniert nicht

1. Master-Admin: Cloud-Fallback aktiviert? (`/admin/ai-gateway`)
2. Routing-Modus ≠ `LOCAL_ONLY`?
3. Privacy-Regel für Kategorie = `CLOUD_ALLOWED`?
4. Cloud-Provider mit API-Key konfiguriert?
5. User hat `cloudFallbackAllowed` (wenn nicht DM/Owner)?

## „KI nicht freigeschaltet“

User braucht Grant vom Master-Admin:

1. `/admin/ai-gateway` → User-Freigaben
2. User-ID eintragen, Features aktivieren
3. Optional: Cloud-Fallback pro User

## Budget überschritten

- Tages-/Monatslimit in Gateway-Konfiguration prüfen
- Usage Logs: `/admin/ai-gateway?scope=usage`
- Limits erhöhen oder auf `null` setzen (unbegrenzt)

## KI systemweit deaktiviert

Routing-Modus = `DISABLED` → auf `LOCAL_THEN_CLOUD` setzen.

## Secrets im Frontend

API-Keys werden **nie** zurückgegeben — nur `hasApiKey: true/false`.

Wenn Keys sichtbar: Bug melden, `pnpm secret:scan` ausführen.

## Tests

```bash
pnpm --filter @uwe/database test
pnpm --filter @uwe/ai-brain test
pnpm test:security
```

Fallback-Test in UI: `/admin/ai-gateway` → „Fallback-Test ausführen“
