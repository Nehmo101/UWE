# Sicherheitsnotizen — KI-System (Brain, RTX Connector, Cloud)

> **Ergänzung zu [SECURITY.md](SECURITY.md)** — nicht die alleinige Source of Truth. Für Auth/API/Uploads siehe SECURITY.md; für QA-Matrix siehe [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md). Historischer Review: [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

Gilt für UWE Studio, Brain, RTX Host Connector / lokale RTX Worker und Cloud-KI.

---

## Datenschutzmodell

UWE ist **alleiniger Besitzer** aller Kampagnen- und Brain-Daten. Die Architektur trennt drei Rollen:

| Komponente | Speichert UWE-Daten? | Erreichbarkeit |
|------------|----------------------|----------------|
| **UWE Host** (Laptop) | Ja — DB, Brain, Embeddings, Mail | Über Cloudflare Tunnel / Proxy (Studio geschützt halten) |
| **RTX Host Connector / lokaler RTX Worker** (RTX-PC) | Nein — nur Inferenz-/Job-Worker | Connector outbound; direkte Worker nur Heimnetz, Token-geschützt |
| **Cloud-KI** | Nein — nur flüchtige Anfrage/Antwort | Internet |

**Grundregel:** Alles Wissen bleibt lokal in UWE. Der RTX-Rechner berechnet Text/Embeddings, speichert aber keine UWE-Inhalte dauerhaft.

---

## Cloud-Verbot für lokalen Kontext

Cloud-KI darf **niemals** folgende Daten erhalten:

- Brain-Retrieval und Wissenstexte
- Aktuelles Objekt (Seite, NPC, Ort, …)
- DnD-/World-Wissen, Kanon, Sessions
- DM-only-Inhalte, Notizen, Plot-Hinweise
- Dungeons, Fraktionen, interne UWE-Metadaten

**Erlaubt bei Cloud** ist ausschließlich der **Allgemeine Chat**: der reine Nutzer-Prompt ohne UWE-Kontext.

Die Durchsetzung erfolgt **serverseitig** (Privacy Guard / AI Router) — nicht nur in der UI. Gefährliche Kombinationen werden blockiert:

| Provider | Kontext | Ergebnis |
|----------|---------|----------|
| Cloud | Allgemeiner Chat | Erlaubt |
| Cloud | Brain / Objekt / Objekt+Brain | **Blockiert** |
| Auto | Allgemeiner Chat, RTX offline | Cloud-Fallback (wenn konfiguriert) |
| Auto | Brain / Objekt / Objekt+Brain, RTX offline | **Blockiert** — kein Cloud-Fallback |
| Lokale RTX | Brain / Objekt (RTX ready) | Erlaubt |

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
- Cloud-Provider: nur minimale Prompts senden (Allgemeiner Chat); API-Keys nie loggen

---

## Auto-Modus-Regeln

Der Modus **Auto** wählt den Provider automatisch:

1. **Allgemeiner Chat:** RTX ready → lokale RTX; RTX offline + Cloud konfiguriert → Cloud; sonst blockieren
2. **Brain, Aktuelles Objekt, Objekt + Brain:** nur lokale RTX; RTX nicht ready → **blockieren**, niemals Cloud

Diese Regeln verhindern den schwerwiegendsten Fehler: versehentliches Senden von Brain-/Weltwissen an Cloud-KI über Auto-Fallback.

---

## Bekannte Risiken

| Risiko | Mitigation |
|--------|------------|
| Lokaler RTX-Dienst öffentlich erreichbar | Nur Heimnetz; Firewall; Token; keine Portfreigabe |
| Token in Logs oder Git | `.env` in `.gitignore`; keine Token in Fehlermeldungen |
| UI-only Security | Serverseitiger Privacy Guard für alle KI-Routen |
| Auto-Fallback mit Brain-Kontext | Explizit verboten; Tests auf gefährliche Kombinationen |
| Direkte Ollama-URL öffentlich | `AI_INFERENCE_ALLOW_PUBLIC_URL=false`; private IPs |
| Cloud-API-Key-Leak | Nur `.env`; Keys nicht in DB oder Client-Responses |
| Prompt-Inhalte in Cloud-Logs (Anbieter) | Cloud nur für Allgemeinen Chat; keine Kampagnendaten senden |
| Schwacher `AUTH_SECRET` | Starker Zufallswert; Warnung im Health-Dashboard |
| Studio ohne Schutz im Internet | VPN, Cloudflare Access oder Reverse-Proxy-Auth |

Bei Sicherheitsvorfällen: [SECURITY.md](SECURITY.md) — Reporting a Vulnerability.

---

## Verwandte Dokumentation

- [README.md — KI-System](README.md#ki-system-brain--rtx)
- [docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md](docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md)
- [.env.example](.env.example)
