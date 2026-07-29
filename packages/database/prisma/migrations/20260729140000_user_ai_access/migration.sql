-- Wer darf die RTX-KI benutzen (G-KI).
--
-- KEIN fuenftes App-Haekchen. Die vier vorhandenen sagen, welche App eine
-- Adresse betreten darf; dieses Feld sagt, ob sie darin die lokale Inferenz
-- ausloesen darf. Der Owner braucht es nicht — `is_owner` geht immer vor.
--
-- ZUR DATENUEBERNAHME, und das ist die eine Entscheidung dieser Migration:
-- Der Spaltenvorgabewert ist 0 (neue Konten bekommen nichts stillschweigend,
-- wie bei den vier Haekchen auch). Bestandskonten mit Studio-Haekchen
-- benutzen die KI aber HEUTE schon — fuer sie waere ein Vorgabewert von 0
-- keine Rechteklaerung, sondern ein Ausfall: die Funktion, die gestern lief,
-- waere nach dem Deploy weg, ohne dass jemand etwas geaendert hat.
--
-- Deshalb wird der Ist-Zustand einmalig festgeschrieben: wer Studio darf,
-- behaelt die KI. Ab hier ist es eine bewusste Entscheidung des Owners, nicht
-- mehr ein Nebeneffekt des Studio-Haekchens. Wer weniger will, nimmt das
-- Haekchen im Command Center wieder weg.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "ai_access" BOOLEAN NOT NULL DEFAULT false;

-- Bestandsuebernahme (einmalig, siehe oben).
UPDATE "users" SET "ai_access" = true WHERE "studio_access" = true OR "is_owner" = true;
