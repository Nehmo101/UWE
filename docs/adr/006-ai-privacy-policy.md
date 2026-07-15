# ADR 006: KI- und Privacy-Policy für D&D und Personal Brain

## Status

Accepted — 2026-07-15

## Kontext

UWE unterscheidet allgemeinen Chat, D&D-/World-Kontext und persönliche
Brain-Inhalte. Ältere Dokumente beschrieben alle Brain-Kontexte als
cloud-verboten. Die maßgebliche W0-Atlas-Policy in
[SECURITY.md](../../SECURITY.md) erlaubt dagegen D&D-Kontext nach
administrativer Gateway-Policy, während `personal_brain` unveränderlich lokal
bleibt.

## Entscheidung

Es gilt folgende verbindliche Policy:

| Kontext | Cloud-Regel |
|---|---|
| `general_chat` | Cloud ist zulässig; es wird kein UWE-Kontext beigefügt. |
| `brain` | Konfigurierbar nach administrativer D&D-Gateway-Policy; Default `CLOUD_ALLOWED`, lokale RTX bevorzugt. |
| `current_object` | Wie `brain`. |
| `current_object_plus_brain` | Wie `brain`. |
| `personal_brain` | Niemals Cloud; hart local-only, owner-only und nicht konfigurierbar. |
| Sonstige private Brain-Inhalte | Niemals Cloud, auch nicht über allgemeine oder D&D-Contracts. |

Vor jeder Cloud-Route gelten serverseitig diese Schritte:

1. Der Context Contract wird eindeutig als allgemein, D&D oder privat
   klassifiziert; unbekannte oder gemischte Kontexte werden abgelehnt.
2. `personal_brain` und private Brain-Payloads werden hart abgelehnt, bevor ein
   Cloud-Provider gewählt oder aufgerufen werden kann.
3. `dm_only` wird vollständig aus D&D-Kontext entfernt, bevor Cloud-Routing
   stattfindet. Es darf ebenso wenig Portal oder Export erreichen.
4. Die administrative Gateway-Policy wird geprüft. W0 verwendet für
   D&D-Weltkontext standardmäßig `CLOUD_ALLOWED`; `CLOUD_FORBIDDEN` und der
   Datenschutzmodus können Cloud-Routing weiter einschränken.
5. Der verbleibende Kontext wird auf das für die Aufgabe nötige Minimum
   reduziert.

KI-Ausgaben verändern niemals automatisch Canon, Welt- oder Brain-Daten. Sie
werden als Vorschlag behandelt und erst nach explizitem Review und Apply
übernommen. Publish ist eine zusätzliche bewusste Studio-Aktion.

Bei Widersprüchen ist `SECURITY.md` die operative Security-Quelle; diese ADR
fixiert das Architekturziel. Die begleitenden Privacy-Dokumente müssen auf
diese beiden Quellen verweisen.

## Konsequenzen

- D&D-Cloud-Fallback ist absichtlich möglich, wenn die Gateway-Policy ihn
  erlaubt und der bereinigte Kontext kein `dm_only` enthält.
- Ein Ausfall lokaler Inferenz darf `personal_brain` niemals in die Cloud
  umleiten; der Vorgang bleibt lokal ausstehend oder schlägt sicher fehl.
- Context Contracts, Router, Jobs und Tests müssen persönliche und D&D-Payloads
  typisiert trennen.
- Privacy-Tests müssen sowohl den harten Personal-Brain-Block als auch das
  Entfernen von `dm_only` vor Cloud-Routing nachweisen.
- Provider-, Nutzungs- und Fehlerlogs dürfen keine privaten Payloads oder
  unnötigen D&D-Kontext enthalten.

## Alternativen

- **Alle D&D-Kontexte hart local-only:** verworfen, weil dies der
  owner-genehmigten W0-Atlas-Gateway-Policy widerspricht.
- **`personal_brain` administrativ konfigurierbar:** verworfen; die lokale
  Grenze ist eine nicht verhandelbare Invariante.
- **Automatisches Apply bei hoher Modellkonfidenz:** verworfen, weil KI-Ausgaben
  ohne menschliches Review keine autoritative Quelle sind.
