# Architektur: UWE Brain, Mail, Cloudflare und RTX-Inferenz

## Zielbild

UWE ist die einzige Oberfläche und der einzige dauerhafte Speicherort für Welt, Kampagnen, Brain-Wissen, Mail-Templates, Logs und AI-Runs.

Der alte Laptop hostet UWE und wird über Cloudflare erreichbar gemacht. Der RTX-Rechner im Heimnetz führt ausschließlich Modell-Inferenz aus. Er ist austauschbar und speichert keine UWE-Daten dauerhaft.

```txt
Internet
  ↓
Cloudflare Tunnel / uweanddragons.org
  ↓
Alter Laptop
  ├─ UWE Studio
  ├─ Player Preview
  ├─ Login/Auth
  ├─ Datenbank
  ├─ Medien/Uploads
  ├─ Mail Center
  ├─ Brain Knowledge Store
  ├─ Embeddings/Vektorindex
  ├─ Context Builder
  ├─ AI Run History
  ├─ Review/Apply/Undo
  ├─ Job Queue
  └─ Inference Client
        ↓ internes Heimnetz
      RTX-Rechner
      ├─ Ollama oder LM Studio
      ├─ lokale LLMs
      ├─ optional Embedding-Inferenz
      └─ keine dauerhafte UWE-Datenhaltung
```

## Harte Invarianten

1. UWE ist der alleinige Besitzer aller Daten.
2. Brain-Wissen wird auf dem alten Laptop gespeichert.
3. Der RTX-Rechner ist nur ein Inference Worker.
4. Der RTX-Rechner darf keine UWE-Daten dauerhaft speichern.
5. Der RTX-Rechner ist nicht öffentlich erreichbar.
6. Cloudflare zeigt nur auf UWE auf dem alten Laptop.
7. Studio/Admin ist nie anonym öffentlich erreichbar.
8. Player Preview und Studio müssen getrennte Sichtbarkeitsregeln haben.
9. KI-Ergebnisse überschreiben nie ungeprüft produktive Daten.
10. Secrets dürfen nie im Frontend landen.

## Verantwortlichkeiten

### Alter Laptop

Der alte Laptop ist der produktive UWE-Host:

- UWE Web-App
- Datenbank
- Brain Knowledge Store
- Embeddings/Vektorindex
- Mail Center
- Mail Logs
- AI Run History
- Context Builder
- Job Queue
- Backups
- Cloudflare Tunnel
- Auth/Login
- Player Preview
- Admin Dashboard

### RTX-Rechner

Der RTX-Rechner ist nur für rechenintensive KI-Ausführung zuständig:

- Ollama
- LM Studio Server
- OpenAI-compatible Local Endpoint
- lokale LLM-Inferenz
- optional Embedding-Berechnung

Er speichert dauerhaft keine UWE-Daten. UWE sendet pro Anfrage nur den benötigten Prompt und den gefilterten Kontext. Der RTX-Rechner gibt nur Modellantworten oder Embedding-Vektoren zurück.

## Datenfluss: normale KI-Anfrage

```txt
User klickt UWE-Aktion
  ↓
UWE sammelt Kontext aus eigener Datenbank
  ↓
UWE filtert DM-only / player-visible je nach Ziel
  ↓
UWE baut Prompt
  ↓
UWE speichert AiRun = pending/running
  ↓
UWE sendet Prompt an RTX-Inference-Endpoint
  ↓
RTX-Rechner berechnet Antwort
  ↓
UWE speichert Antwort im AiRun
  ↓
User prüft Ergebnis
  ↓
User übernimmt, verwirft oder bearbeitet Vorschlag
```

## Datenfluss: Embeddings

Bevorzugte Variante:

```txt
UWE wählt Text/Chunk
  ↓
UWE sendet Chunk an RTX-Rechner für Embedding-Berechnung
  ↓
RTX-Rechner berechnet Vektor
  ↓
RTX-Rechner sendet Vektor zurück
  ↓
UWE speichert Vektor im eigenen Brain Store
```

Fallback:

- kleines Embedding-Modell direkt auf dem alten Laptop
- oder Embeddings deaktivieren, aber Brain-Suche semantisch reduziert weiter betreiben

## Brain-Komponenten

### Brain Knowledge Store

Speichert dauerhaft:

- Weltwissen
- Kampagnenwissen
- Session-Zusammenfassungen
- NPC-Fakten
- Orts-Fakten
- Fraktions-Fakten
- Kanon-Fakten
- DM-only Fakten
- player-visible Fakten
- AI-generierte Zusammenfassungen
- Brain-Dokumente
- Chunks
- Embeddings
- Quellen/Links
- akzeptierte/verworfene Vorschläge

### Context Builder

Sammelt und filtert Kontext für eine Aufgabe.

Muss beachten:

- Ziel der Aktion
- aktuelles Objekt
- Welt/Kampagne/Session
- Sichtbarkeit: DM-only, player-visible, public
- Token-/Längenbudget
- Relevanz
- Kanon-Wichtigkeit
- Quelle/Vertrauensgrad

### Inference Client

Spricht mit:

- Ollama
- LM Studio
- OpenAI-compatible Local Endpoint
- MockProvider für Tests
- optional Cloud-Provider später

Muss können:

- Healthcheck
- Modellliste abrufen, falls möglich
- Timeout Handling
- Offline-Status
- Retry-Strategie für ungefährliche Requests
- verständliche Fehler
- keine App-Crashes bei RTX offline

### AI Run History

Speichert:

- ID
- Zeitpunkt
- Nutzer/Quelle
- Aktion/Cookbook
- Provider
- Modell
- Status
- System Prompt
- User Prompt
- verwendeter Kontext
- Ergebnis
- Fehler
- Dauer
- Token Usage, falls vorhanden
- Zielobjekt
- erzeugte Patches/Vorschläge
- Apply/Discard Status

### Review/Apply/Undo

KI-Ausgaben sind zuerst Vorschläge.

Aktionen:

- übernehmen
- teilweise übernehmen
- bearbeiten und übernehmen
- verwerfen
- erneut generieren
- exportieren/kopieren

Vor produktiven Änderungen sollte ein ChangeLog oder Snapshot erzeugt werden.

## Mail Center

Mail ist Pflichtmodul, nicht späterer Bonus.

### Outbound zuerst

Version 1 braucht nur ausgehende Mails:

- SMTP-Konfiguration
- Testmail
- Mail-Templates
- Empfängergruppen, z. B. Spieler
- Session-Recap-Mail
- Handout-Mail
- Player-Preview-Link-Mail
- Mail Logs
- Fehleranzeige

### Später optional

- eingehende Mails
- Antwort-Import als Raw Input
- Terminabstimmungen
- automatisierte Kampagnenmails

## Cloudflare-Regeln

Cloudflare darf nur UWE auf dem alten Laptop öffentlich verfügbar machen.

Empfohlen:

```txt
Internet → Cloudflare Tunnel → Alter Laptop/UWE
```

Nicht erlaubt:

```txt
Internet → Cloudflare → RTX-Rechner/Ollama
```

Studio muss Login erzwingen. Optional kann Cloudflare Access zusätzlich vor UWE geschaltet werden.

## Offline-Verhalten

### RTX-Rechner offline

UWE bleibt nutzbar:

- Studio läuft
- Player Preview läuft
- Mail läuft
- Brain-Wissen ist lesbar
- Kontextsuche kann abhängig vom Index weitergehen
- KI-Aktionen zeigen `Brain offline`
- Jobs bleiben pending oder schlagen kontrolliert fehl

### Mail fehlerhaft

UWE bleibt nutzbar:

- Mail Center zeigt Fehlerstatus
- Mail Jobs werden nicht still verschluckt
- Testmail liefert klare Diagnose

### Cloudflare Tunnel offline

UWE bleibt lokal erreichbar, aber nicht öffentlich.

## Sicherheitsregeln

- API Keys und SMTP Passwörter nur serverseitig speichern.
- Keine Secrets ins Frontend serialisieren.
- Logs müssen Secrets maskieren.
- Player Preview darf keine DM-only Daten sehen.
- Mail an Spieler darf keine DM-only Daten enthalten, außer explizit bestätigt.
- Brain-Kontext muss Sichtbarkeit respektieren.
- RTX-Endpunkt nur im Heimnetz zulassen.
- Keine Portfreigabe für Ollama/LM Studio ins Internet.

## Minimaler Produktionsdurchbruch

Die erste harte Zielversion ist erreicht, wenn:

- UWE auf altem Laptop läuft.
- UWE über Cloudflare erreichbar ist.
- Studio Login hat.
- Mail Test funktioniert.
- Brain-Wissen lokal bei UWE gespeichert wird.
- UWE erkennt RTX-Brain online/offline.
- UWE kann einen Testprompt an RTX senden.
- AI Run wird gespeichert.
- RTX offline crasht UWE nicht.
