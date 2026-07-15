# Sicherheitsnotizen — KI-System (Brain, RTX Connector, Cloud)

> **Ergänzung zu [SECURITY.md](SECURITY.md)** — nicht die alleinige Source of Truth. Für Auth/API/Uploads siehe SECURITY.md; für QA-Matrix siehe [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md). Historischer Review: [docs/security/SECURITY_REVIEW.md](docs/security/SECURITY_REVIEW.md).

> Für Cloud-Kontext gilt ausschließlich die aktuelle
> [W0-Atlas-Policy in SECURITY.md](SECURITY.md#cloud-ai-context-boundaries),
> architektonisch fixiert in
> [ADR 006](docs/adr/006-ai-privacy-policy.md): `personal_brain` und private
> Brain-Inhalte sind hart local-only; D&D-Kontext ist konfigurierbar und hat
> den Default `CLOUD_ALLOWED`, nachdem `dm_only` entfernt wurde.

Gilt für UWE Studio, Brain, RTX Host Connector / lokale RTX Worker und Cloud-KI.

---

## Datenschutzmodell

UWE ist **alleiniger Besitzer** aller Kampagnen- und Brain-Daten. Die Architektur trennt drei Rollen:

| Komponente | Speichert UWE-Daten? | Erreichbarkeit |
|------------|----------------------|----------------|
| **UWE Host** (Laptop) | Ja — DB, Brain, Embeddings, Mail | Studio/Portal optional über Tunnel/Proxy; Brain nur lokal/LAN |
| **RTX Host Connector / lokaler RTX Worker** (RTX-PC) | Nein — nur Inferenz-/Job-Worker | Connector outbound; direkte Worker nur Heimnetz, Token-geschützt |
| **Cloud-KI** | Keine UWE-Source-of-Truth; verarbeitet nur policy-konformen, minimierten Kontext | Internet |

**Grundregel:** Die persistente Source of Truth bleibt lokal in UWE. Der
RTX-Rechner berechnet Text/Embeddings, speichert aber keine UWE-Inhalte
dauerhaft. D&D-Kontext darf nach Gateway-Policy vorübergehend durch Cloud-KI
verarbeitet werden; private Brain-Inhalte niemals.

---

## Cloud-Regeln für Kontext

Cloud-KI darf **niemals** folgende Daten erhalten:

- `personal_brain`, Personal-Brain-Retrieval oder andere private Brain-Inhalte
- alle als `dm_only` klassifizierten Inhalte, einschließlich interner Notizen und Plot-Hinweise
- interne Metadaten, die nicht für die konkrete D&D-Aufgabe erforderlich sind

**Erlaubt bei Cloud** sind allgemeiner Chat ohne UWE-Kontext sowie D&D-/World-
Kontext, wenn die administrative Gateway-Policy dies zulässt. Vor dem Routing
werden `dm_only` und unnötige Metadaten entfernt.

Die Durchsetzung erfolgt **serverseitig** (Privacy Guard / AI Router) — nicht nur in der UI. Gefährliche Kombinationen werden blockiert:

| Provider | Kontext | Ergebnis |
|----------|---------|----------|
| Cloud | Allgemeiner Chat | Erlaubt |
| Cloud | D&D-Brain / Objekt / Objekt+Brain | Nach Gateway-Policy, Default `CLOUD_ALLOWED` |
| Cloud | `personal_brain` / private Brain-Inhalte | **Immer blockiert** |
| Auto | Allgemeiner Chat, RTX offline | Cloud-Fallback (wenn konfiguriert) |
| Auto | D&D-Brain / Objekt / Objekt+Brain, RTX offline | Cloud-Fallback nur bei `CLOUD_ALLOWED` |
| Auto | `personal_brain`, RTX offline | **Blockiert** — kein Cloud-Fallback |
| Lokale RTX | D&D- oder Personal-Brain-Kontext (RTX ready) | Erlaubt |

---

## RTX nicht öffentlich exposen

Der RTX Host Connector arbeitet outbound und braucht keinen öffentlichen Port. Direkte RTX Worker, Ollama oder LM Studio dürfen ebenfalls **nicht** über das Internet erreichbar sein:

- Kein Port-Forwarding am Router auf den RTX-PC
- Kein Cloudflare-Tunnel zu Ollama, LM Studio oder direkten RTX Worker-Endpunkten
- Keine Bindung an `0.0.0.0` ohne Firewall — bevorzugt private LAN-IP
- Nur der UWE-Host im Heimnetz spricht mit direkten Worker-Endpunkten

Cloudflare leitet **nur** an UWE weiter, nicht an lokale RTX-Dienste.

---

## Token verwenden

- `RTX_SERVICE_TOKEN` muss **lang/zufällig** sein, wenn ein direkter RTX Worker-Endpunkt genutzt wird
- Connector-Tokens werden im Studio erzeugt und vom RTX Host Connector outbound verwendet
- Token nur in `.env` auf Server/RTX-PC — **nie** in Git, Frontend, URLs oder Logs
- Jeder Request an sensible direkte Worker-Endpunkte erfordert `Authorization: Bearer <token>`
- Fehlender oder falscher Token → Request abgelehnt

Zusätzlich: `STUDIO_API_TOKEN` für sensible Studio-APIs, wenn UWE aus untrusted Netzen erreichbar sein könnte.

---

## Keine Promptlogs

Standardmäßig **keine** dauerhafte Speicherung von Prompts oder Antworten auf dem RTX-PC:

- `LOG_PROMPTS=false` (Standard, falls ein Worker diese Option kennt)
- Debug-Logging nur bewusst und kurzzeitig aktivieren
- Keine Brain-Daten, Tokens oder vollständige Prompts in Anwendungs- oder Reverse-Proxy-Logs
- Cloud-Provider: nur policy-konformen, minimierten D&D-Kontext ohne `dm_only`
  senden; private Brain-Inhalte und Zugangsdaten nie senden oder loggen

---

## Auto-Modus-Regeln

Der Modus **Auto** wählt den Provider automatisch:

1. **Allgemeiner Chat:** RTX ready → lokale RTX; RTX offline + Cloud konfiguriert → Cloud; sonst blockieren
2. **D&D-Brain, Aktuelles Objekt, Objekt + Brain:** lokale RTX bevorzugt; RTX nicht ready → Cloud nur bei `CLOUD_ALLOWED`, nachdem `dm_only` entfernt wurde
3. **`personal_brain` und private Brain-Inhalte:** nur lokale RTX; RTX nicht ready → **blockieren**, niemals Cloud

Diese Regeln verhindern den schwerwiegendsten Fehler: versehentliches Senden
privater Brain-Inhalte oder von `dm_only` an Cloud-KI über Auto-Fallback.

---

## Bekannte Risiken

| Risiko | Mitigation |
|--------|------------|
| Lokaler RTX-Dienst öffentlich erreichbar | Nur Heimnetz; Firewall; Token; keine Portfreigabe |
| Token in Logs oder Git | `.env` in `.gitignore`; keine Token in Fehlermeldungen |
| UI-only Security | Serverseitiger Privacy Guard für alle KI-Routen |
| Auto-Fallback mit falsch klassifiziertem Kontext | Harte Sperre für `personal_brain`, `dm_only`-Filter und Policy-Tests |
| Direkte Ollama-URL öffentlich | `AI_INFERENCE_ALLOW_PUBLIC_URL=false`; private IPs |
| Cloud-API-Key-Leak | Nur `.env`; Keys nicht in DB oder Client-Responses |
| Prompt-Inhalte in Cloud-Logs (Anbieter) | D&D-Cloud-Nutzung nur nach Policy und minimiert; niemals private Brain-Inhalte oder `dm_only` senden |
| Schwacher `AUTH_SECRET` | Starker Zufallswert; Warnung im Health-Dashboard |
| Studio ohne Schutz im Internet | VPN, Cloudflare Access oder Reverse-Proxy-Auth |

Bei Sicherheitsvorfällen: [SECURITY.md](SECURITY.md) — Reporting a Vulnerability.

---

## Verwandte Dokumentation

- [README.md — KI-System](README.md#ki-system-brain--rtx)
- [SECURITY.md — Cloud AI Context Boundaries](SECURITY.md#cloud-ai-context-boundaries)
- [ADR 006 — KI- und Privacy-Policy](docs/adr/006-ai-privacy-policy.md)
- [docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md](docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md)
- [.env.example](.env.example)
