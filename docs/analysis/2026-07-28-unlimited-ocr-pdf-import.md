# Bewertung: Baidu Unlimited-OCR für den PDF→Kampagne-Import

**Entscheidungsdokument** · 2026-07-28 · Basis: `main` @ `c644e39` · Status: **Bewertung, keine Umsetzung**

> **Update 2026-08: umgesetzt.** Beide Stufen aus §6 sind gebaut — `@uwe/pdf-ocr`
> (Textlayer-Prüfung, Rendern, Seitenplanung, Marker, Figuren-Cropping), der
> Kampagnen-Import läuft im Job-Runner über `vision_extract`, und der Family-
> Scan-Eingang nutzt dasselbe Dokumenten-OCR. Modellwahl über den `vision`-Slot
> (Command Center → Modelle), Default `frob/unlimited-ocr:q8_0`. Details:
> [docs/engine-connector.md](../engine-connector.md) („Document OCR").

Geprüfte Frage: Wäre eine Integration von [baidu/Unlimited-OCR](https://github.com/baidu/Unlimited-OCR)
für PDF-Importe in UWE sinnvoll — speziell für PDF → Kampagne?

**Kurzantwort: Ja — aber nicht als neues Feature.** UWE hat den PDF→Kampagne-Importer bereits
vollständig. Der Gewinn läge im Austausch eines einzigen Schritts: der Textgewinnung. Und der
größere Teil dieses Gewinns kommt nicht vom OCR, sondern von der **Layout-Treue**.

---

## 1. Was UWE heute schon hat

Der Importer ist ausgeliefert und vollständig:

| Baustein | Datei |
|---|---|
| Reines Extraktions-Package | `packages/pdf-campaign-import/src/` — chunker, prompt, parser, dedupe, preview, page-mapper, fit-chat |
| Orchestrierung + DB-Write | `apps/studio/app/import-campaign-actions.ts` (313 Z.) |
| Upload bis 300 MB | `apps/studio/app/api/import/campaign-pdf-upload/route.ts` |
| UI + Fortschritt | `apps/studio/app/import/CampaignPdfImportPanel.tsx` |
| Konzeptdoku | [`docs/engineering/pdf-campaign-import-plan.md`](../engineering/pdf-campaign-import-plan.md) |

**Ablauf heute:** PDF → `extractPdfText` → `chunkPdfText` (6 000 Zeichen) → pro Chunk
`routeAiRequest` mit `providerMode: "local_engine"` → `parseCampaignEntities` → Preview →
ausgewählte Entitäten als `Page` mit `visibility: "dm_only"` unter der Kampagne. Rückrollbar
über `captureImportCentralExecute`.

Das Konzeptdokument schließt OCR ausdrücklich aus:

> *"Left out of MVP: OCR for scanned PDFs; D&D statblock/mechanics schemas (free-text `body` only)"*

Genau diese Lücke ist der Gegenstand dieser Bewertung.

---

## 2. Die eigentliche Lücke — zwei Probleme, nicht eins

### Problem A (offensichtlich): Scans scheitern hart

`packages/database/src/pdf-text-extract.ts` liest ausschließlich den Textlayer via `pdf-parse`
und wirft sonst ab (Z. 41–45):

> *"Kein Text in der PDF gefunden. Bitte gescanntes PDF mit OCR oder Markdown-Export nutzen."*

Gescannte Abenteuerbände, fotografierte Handouts, alte Fan-Module — alle nicht importierbar.

### Problem B (wichtiger, weniger sichtbar): Layout-Zerstörung bei PDFs *mit* Textlayer

Abenteuerbände sind zweispaltig, mit Seitenkästen, Vorlesetext-Boxen, Statblock-Tabellen und
Zufallstabellen. `pdf-parse` liefert daraus flachen Text in kaputter Lesereihenfolge — Spalten
werden ineinander verschränkt, Kästen mitten in Fließtext eingeschoben, Tabellen zu Wortsalat.

Der Chunker schneidet diesen Matsch anschließend **blind alle 6 000 Zeichen**
(`chunker.ts`, `MAX_CHUNK_CHARS`). Ergebnis: ein NPC-Name landet in Chunk 3, sein Statblock in
Chunk 4, ein Kasten-Satz mitten in einer Raumbeschreibung. Die lokale KI bekommt pro Chunk ein
Fragment ohne Kontextgrenzen und soll daraus saubere Entitäten bilden.

**Das ist der Kern der Bewertung:** Die Qualitätsgrenze des Imports liegt heute in der
**Extraktion**, nicht im lokalen Modell. Ein stärkeres LLM hinter `routeAiRequest` würde daran
nichts ändern — es bekäme denselben Matsch.

---

## 3. Was Unlimited-OCR ist

| | |
|---|---|
| Herausgeber / Datum | Baidu, 22.06.2026 |
| Lizenz | **MIT — inklusive Gewichte** |
| Größe | 3,3 Mrd. Parameter MoE, ~500 Mio. aktiv |
| VRAM | ~7,3 GB bf16 · INT4 ~1,8 GB · Ollama-Q8 4,0 GB |
| Kontext | 32 768 Token |
| Herkunft | Weiterentwicklung von DeepSeek-OCR; R-SWA hält den KV-Cache beim Generieren konstant |
| Benchmark | OmniDocBench v1.5: **93,23 %** (+6,22 ggü. DeepSeek-OCR), v1.6: 93,92 % — SOTA unter offenen Modellen; 35 % schneller bei 6 000 Tokens |

Gebaut ist es für genau diesen Anwendungsfall: **One-shot Multi-Page-Parsing** ganzer PDFs,
mit Layout, Tabellen, korrekter Lesereihenfolge und `<|det|>typ [bbox]<|/det|>`-Markern für
Abbildungen.

---

## 4. Warum es architektonisch gut zu UWE passt

Das ist der stärkste Teil der Bewertung: Die Infrastruktur ist **bereits vorhanden**.

- **Capability `vision_local` existiert** — Label wörtlich *"Lokale Vision/OCR"*
  (`packages/connector/src/capabilities.ts:28`)
- **Job-Typ `vision_extract` existiert** — GPU-Lane, Priorität 40
  (`packages/connector/src/job-types.ts:81`)
- **Executor existiert** — Ollama `/api/chat` mit `messages[].images`
  (`tools/uwe-engine-connector/src/executors.ts`); Default heute `llava`
- **Host-Wrapper existiert** — `runConnectorVisionExtract`
  (`packages/ai-brain/src/router/providers/connectorQueueProvider.ts:188`)
- **Das Muster ist erprobt** — `packages/scan-inbox` fährt exakt diesen Weg: PDF-Textlayer,
  sonst Connector-Vision, `ocrEngine: "vision_llm"`, Poll-on-demand über
  `applyConnectorJobResult` (`scan-service.ts:157`)

Zwei Punkte senken den Aufwand erheblich — beide stehen gegen die naheliegende Erwartung:

### 4.1 Kein Docker nötig

Die offizielle vLLM-Variante läuft nur über ein eigenes Docker-Image
(`vllm/vllm-openai:unlimited-ocr`), die Architektur ist noch in keinem stabilen pip-Wheel. Das
würde gegen die UWE-Regel **"kein Docker"** laufen.

Braucht es aber nicht: llama.cpp hat die Architektur mit **Build 168 (01.07.2026, PR #24969)**
mainline übernommen, und das Modell liegt fertig als **`frob/unlimited-ocr:q8_0`** (4,0 GB,
32K Kontext, Text + Bild) auf Ollama. Damit ist es schlicht ein **Modellname im bestehenden
Executor** — keine neue Serving-Infrastruktur, kein SGLang, kein Container.

### 4.2 Kein neuer Rasterizer nötig

Die naheliegende Annahme ist, hier fehle pdfjs-dist, mupdf oder poppler. Das stimmt nicht:

- **`pdf-parse@2.4.5`** — bereits Dependency von `packages/database` *und* `apps/studio` —
  hat `getScreenshot()` (Seiten → Rasterbild, mit `scale`/`width`, Ausgabe als Buffer oder
  Base64) sowie `getImage()` für eingebettete Bilder.
- **`downscaleImageForVision`** (`packages/assets/src/image-processing.ts`, sharp) macht
  daraus fertig ≤1 600 px JPEG für den Vision-Pfad.

Die Kette PDF → Bild → `vision_extract` ist damit **ohne neue Abhängigkeit** vollständig.

### 4.3 Privacy bleibt unangetastet

Läuft auf dem Maschinenraum-Host, MIT-Gewichte, kein Cloud-Provider. `AiProviderMode` kennt ohnehin nur
noch `"local_engine"` — Cloud-Provider sind aus dem Router entfernt. Die Regel *"jede KI-Aktion
über den Maschinenraum-Host"* bleibt erfüllt.

---

## 5. Ehrliche Gegenrechnung

- **Durchsatz.** 300 DPI rastern + VLM-Dekodierung ≈ Sekunden pro Seite, bei
  `LANE_CONCURRENCY.gpu = 1`. Ein 250-Seiten-Band wird ein Job von Minuten bis Stunden. Das
  aktuelle 300-MB-Limit impliziert genau solche Bücher. Der heutige Pfad läuft **synchron in
  der Server Action** — das trägt dann nicht mehr, es bräuchte den `Job`-Runner
  (`apps/studio/src/lib/job-executor.ts`).
- **Transport.** Die Connector-Queue trägt Base64-JSON. Eine Seite bei 1 600 px JPEG sind
  ~200–400 KB Base64; ein ganzes Buch geht so nicht als ein Payload durch. Es müsste seiten-
  oder batchweise laufen. (`file_cache` ist als Capability reserviert, hat aber keinen
  Executor — laut `docs/engine-connector.md` bewusst deaktiviert.)
- **Maschinenraum-Abhängigkeit verdoppelt sich.** Heute braucht der Import Maschinenraum einmal (LLM), mit OCR
  zweimal. Der Textlayer-Pfad muss als schneller Weg erhalten bleiben, nicht ersetzt werden.
- **Ollama-Aktualität.** `frob/unlimited-ocr` braucht ein Ollama auf llama.cpp ≥ Build 168;
  ältere Builds laden es nicht. Braucht einen Preflight-Check statt einer kryptischen
  Ladefehlermeldung.
- **Capability-Erkennung.** `VISION_MODEL_PATTERNS`
  (`tools/uwe-engine-connector/src/local-capabilities.ts:193`) kennt nur llava, minicpm-v,
  qwen2.5-vl, moondream, bakllava, llama3.2-vision — `unlimited-ocr` matcht keines davon.
  Es rettet nur `model.capabilities?.includes("vision")` (Z. 206), falls Ollama die Capability
  meldet. Ein Ein-Zeilen-Risiko — aber es würde **still** fehlschlagen: der Connector meldet
  `vision_local` dann gar nicht erst.
- **Halluzination.** Geringer als heute, weil dokumenten-trainiert statt allgemeines VLM — aber
  nicht null, besonders bei schlechten Scans. Preview + Einzelauswahl + Undo decken das bereits ab.

---

## 6. Empfehlung

**Sinnvoll — aber als gezielter Austausch des Extraktionsschritts hinter der bestehenden
Pipeline, nicht als neues Feature.** In zwei Stufen:

### Stufe 1 — OCR-Fallback

`extractPdfText` bekommt einen optionalen Fallback: kein oder dünner Textlayer → Seiten rastern
→ `vision_extract` mit Unlimited-OCR. Macht gescannte Abenteuer **überhaupt erst importierbar**.
Kleiner Eingriff, unmittelbar sichtbarer Nutzen.

### Stufe 2 — der eigentliche Qualitätssprung

OCR als *primärer* Pfad mit layout-treuem Markdown. Erst dann zahlt sich das Modell wirklich aus:

- Der Chunker kann an **echten Überschriften und Abschnitten** schneiden statt blind alle
  6 000 Zeichen — die KI bekommt zusammenhängende Einheiten statt Fragmente.
- **Statblock- und Zufallstabellen überleben** die Extraktion.
- `<|det|>`-Bounding-Boxes liefern **Karten und Abbildungen**, die über `@uwe/assets` an die
  erzeugten Seiten gehängt werden könnten.

### Betriebsmodell

Modellname als **Setting in den Studio-Settings mit Host-Sync**, nach dem Muster aus
`CLAUDE.md` → [`docs/engineering/self-service-config.md`](../engineering/self-service-config.md).
Einziger manueller Host-Schritt bleibt einmalig:

```bash
ollama pull frob/unlimited-ocr:q8_0
```

### Vorbedingung vor jeder Umsetzung

**Auf dem Maschinenraum-Host `ollama pull` ausführen und eine Testseite durch `vision_extract` schicken.**
Wenn das Modell dort nicht sauber lädt oder der Connector `vision_local` nicht meldet (siehe
Abschnitt 5), ist die ganze Rechnung hinfällig. Das ist in 15 Minuten geklärt — bevor
irgendein Code entsteht.

---

## 7. Nebenbefunde

Beim Lesen des Importers aufgefallen, **unabhängig von OCR** — hier nur festgehalten, damit
sie nicht verloren gehen:

1. **Slug-Kollision über Kampagnengrenzen.** `Page` hat `@@unique([worldId, slug])`, aber
   `executeImportCampaignPdfJobAction` prüft `pickUniqueSlug` nur gegen die Slugs *der
   Kampagne*. Ein Titel, den es in einer anderen Kampagne derselben Welt schon gibt, läuft in
   einen DB-Constraint-Fehler statt in die Suffix-Logik.
2. **Positionsgebundene Item-Auswahl.** Execute selektiert über `"ent-" + index` gegen das
   gespeicherte `previewPayload` — an die exakte Array-Reihenfolge gekoppelt.
3. **Widersprüchliche Upload-Limits.** Die Asset-Route prüft gegen 50 MB,
   `validateUploadInput` danach gegen 25 MB (effektiv gilt 25); dazu 10 MB für
   Markdown-Content, 10 MB für Central-PDF-Base64 und 300 MB für Kampagnen-PDFs.

---

## Quellen

- [baidu/Unlimited-OCR](https://github.com/baidu/Unlimited-OCR) — Repo, MIT
- [HyperAI: Baidu Releases Unlimited OCR](https://hyper.ai/en/stories/896c32c8cf649dc179e249b10e47d840) — Release, Benchmarks
- [vLLM Recipes: baidu/Unlimited-OCR](https://recipes.vllm.ai/baidu/Unlimited-OCR) — 3B, 32K Kontext
- [Spheron: VRAM-Bedarf ~7 GB](https://www.spheron.network/tools/gpu-recommender/baidu/Unlimited-OCR/)
- [Ollama: frob/unlimited-ocr](https://ollama.com/frob/unlimited-ocr) — Q8_0 4,0 GB / F16 6,7 GB
- [llama.cpp Issue #25009](https://github.com/ggml-org/llama.cpp/issues/25009) — Architektur-Support
- [Unlimited-OCR-GGUF](https://huggingface.co/sahilchachra/Unlimited-OCR-GGUF) — Quants + mmproj
