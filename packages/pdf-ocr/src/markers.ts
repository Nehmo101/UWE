/**
 * Unlimited-OCR mischt Layout-Marker in die Markdown-Ausgabe. Zwei Schreib-
 * weisen sind im Umlauf (die DeepSeek-OCR-Erbschaft und die kompakte Form aus
 * dem Unlimited-OCR-README):
 *
 *   <|ref|>figure<|/ref|><|det|>[[12, 40, 380, 520]]<|/det|>
 *   <|det|>figure [12, 40, 380, 520]<|/det|>
 *
 * Für den Import brauchen wir beides getrennt: sauberes Markdown für die
 * Entitäts-Extraktion und die Boxen für Karten/Abbildungen. Der Parser ist
 * bewusst tolerant — unbekannte Marker werden entfernt statt zu scheitern,
 * damit ein Formatwechsel im Modell nicht den ganzen Import kippt.
 */

/** Bounding-Box in Modellkoordinaten (0–999, relativ zur Seite). */
export interface DetectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectedRegion {
  /** Vom Modell vergebener Typ, z. B. "figure", "table", "title". */
  type: string;
  box: DetectionBox;
  /** 1-basierte Seite, auf der die Box gefunden wurde. */
  pageNumber: number;
}

export interface StrippedOcrOutput {
  /** Markdown ohne Marker — das, was in die Entitäts-Extraktion geht. */
  markdown: string;
  regions: DetectedRegion[];
}

const DETECTION_MARKER = /<\|(?:ref|det)\|>([\s\S]*?)<\|\/(?:ref|det)\|>/g;
const NUMBER_GROUP = /-?\d+(?:\.\d+)?/g;
const LEADING_LABEL = /^([A-Za-z_][\w-]*)/;

function parseBoxes(raw: string): DetectionBox[] {
  const numbers = raw.match(NUMBER_GROUP)?.map(Number) ?? [];
  const boxes: DetectionBox[] = [];
  for (let index = 0; index + 3 < numbers.length; index += 4) {
    const [x1, y1, x2, y2] = numbers.slice(index, index + 4) as [number, number, number, number];
    // Entartete Boxen (Breite oder Höhe 0) sind für einen Zuschnitt nutzlos.
    if (x2 > x1 && y2 > y1) {
      boxes.push({ x1, y1, x2, y2 });
    }
  }
  return boxes;
}

/**
 * Trennt Marker von Inhalt. `pageNumber` wird jeder gefundenen Box mitgegeben,
 * weil die Boxen nur seitenrelativ sind und der Aufrufer sonst nicht weiß,
 * welche Seite er zuschneiden müsste.
 */
export function stripDetectionMarkers(raw: string, pageNumber = 1): StrippedOcrOutput {
  const regions: DetectedRegion[] = [];
  let pendingType: string | null = null;

  const markdown = raw.replace(DETECTION_MARKER, (_match, inner: string) => {
    const content = inner.trim();
    const boxes = parseBoxes(content);

    if (boxes.length === 0) {
      // Ein `<|ref|>`-Block ohne Zahlen trägt den Typ für den folgenden
      // `<|det|>`-Block — merken statt verwerfen.
      pendingType = content || pendingType;
      return "";
    }

    const label = LEADING_LABEL.exec(content)?.[1] ?? pendingType ?? "region";
    for (const box of boxes) {
      regions.push({ type: label.toLowerCase(), box, pageNumber });
    }
    pendingType = null;
    return "";
  });

  return { markdown: normalizeOcrMarkdown(markdown), regions };
}

/**
 * Räumt die Markdown-Ausgabe auf: Zeilenenden vereinheitlichen, mehr als eine
 * Leerzeile zusammenfassen, Zeilenrand-Whitespace entfernen. Der Chunker
 * schneidet später an Leerzeilen und Überschriften — beides wäre sonst durch
 * Rest-Whitespace aus den entfernten Markern verfälscht.
 */
export function normalizeOcrMarkdown(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Unsichtbarer Herkunftsvermerk pro Seite. Er überlebt das Chunking, sodass
 * später feststeht, aus welchen PDF-Seiten ein Chunk — und damit eine daraus
 * extrahierte Entität — stammt. Genau das braucht der Bild-Zuschnitt, um eine
 * Abbildung der richtigen Wiki-Seite zuzuordnen.
 *
 * Ein HTML-Kommentar, weil er in Markdown nichts rendert und die lokale KI ihn
 * ohnehin nie zu sehen bekommt (`stripPageMarkers` läuft vor dem Prompt).
 */
export function buildPageMarker(pageNumber: number): string {
  return `<!-- uwe:page ${pageNumber} -->`;
}

const PAGE_MARKER = /<!--\s*uwe:page\s+(\d+)\s*-->/g;

/** Seitenzahlen, die in diesem Textstück vermerkt sind — aufsteigend, ohne Dubletten. */
export function readPageNumbers(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(PAGE_MARKER)) {
    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > 0) {
      found.add(parsed);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** Entfernt die Marker — muss vor jedem Modell-Prompt laufen. */
export function stripPageMarkers(text: string): string {
  return normalizeOcrMarkdown(text.replace(PAGE_MARKER, ""));
}

/**
 * Fügt die Seiten-Ergebnisse zu einem Dokument zusammen. Mit `pageMarkers`
 * bekommt jede Seite ihren Herkunftsvermerk vorangestellt.
 */
export function joinOcrPages(
  pages: readonly { pageNumber: number; markdown: string }[],
  options: { pageMarkers?: boolean } = {},
): string {
  return pages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => {
      const markdown = page.markdown.trim();
      if (!markdown) return "";
      return options.pageMarkers ? `${buildPageMarker(page.pageNumber)}\n${markdown}` : markdown;
    })
    .filter(Boolean)
    .join("\n\n");
}
