/**
 * Contour lines — marching squares over a sampled height function.
 *
 * Samples `heightAt` on a regular grid across [-mapSize, mapSize]² and emits
 * line segments per contour level (all 16 cases, linear interpolation on the
 * cell edges; the ambiguous cases 5/10 are resolved with a fixed pairing).
 * Deterministic: same inputs → same segments.
 */

export interface ContourOptions {
  heightAt: (x: number, z: number) => number;
  /** Map half-extent: sampling spans [-mapSize, mapSize] in x and z. */
  mapSize: number;
  /** Samples per axis. Default 64. */
  resolution?: number;
  /**
   * Contour levels. Default: 5 evenly spaced levels between the sampled min
   * and max, skipping any level that lands on the water level (0).
   */
  levels?: number[];
}

/** A contour segment as [x1, z1, x2, z2] in map units. */
export type ContourSegment = [number, number, number, number];

export interface ContourResult {
  segments: ContourSegment[];
  levels: number[];
}

function defaultLevels(min: number, max: number): number[] {
  if (!(max > min)) return [];
  const step = (max - min) / 6;
  const levels: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const level = min + step * i;
    // Skip the water level so the shoreline is not duplicated as a contour.
    if (Math.abs(level) < step * 0.25) continue;
    levels.push(level);
  }
  return levels;
}

export function computeContours(options: ContourOptions): ContourResult {
  const resolution = Math.max(2, Math.floor(options.resolution ?? 64));
  const { heightAt, mapSize } = options;

  // Sample grid: index i → x, index j → z.
  const coords = new Float64Array(resolution);
  for (let i = 0; i < resolution; i++) {
    coords[i] = -mapSize + (2 * mapSize * i) / (resolution - 1);
  }
  const samples = new Float64Array(resolution * resolution);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const h = heightAt(coords[i], coords[j]);
      samples[j * resolution + i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }

  const levels = options.levels ?? defaultLevels(min, max);
  const segments: ContourSegment[] = [];

  // Edge interpolation between two corners of a cell.
  const interp = (
    level: number,
    ax: number,
    az: number,
    ah: number,
    bx: number,
    bz: number,
    bh: number,
  ): readonly [number, number] => {
    const span = bh - ah;
    const t = Math.abs(span) < 1e-12 ? 0.5 : Math.min(1, Math.max(0, (level - ah) / span));
    return [ax + (bx - ax) * t, az + (bz - az) * t];
  };

  for (const level of levels) {
    for (let j = 0; j < resolution - 1; j++) {
      for (let i = 0; i < resolution - 1; i++) {
        const x0 = coords[i];
        const x1 = coords[i + 1];
        const z0 = coords[j];
        const z1 = coords[j + 1];
        const h0 = samples[j * resolution + i]; // (x0, z0)
        const h1 = samples[j * resolution + i + 1]; // (x1, z0)
        const h2 = samples[(j + 1) * resolution + i + 1]; // (x1, z1)
        const h3 = samples[(j + 1) * resolution + i]; // (x0, z1)

        let caseIndex = 0;
        if (h0 >= level) caseIndex |= 1;
        if (h1 >= level) caseIndex |= 2;
        if (h2 >= level) caseIndex |= 4;
        if (h3 >= level) caseIndex |= 8;
        if (caseIndex === 0 || caseIndex === 15) continue;

        // Edges: e0 bottom (c0-c1), e1 right (c1-c2), e2 top (c2-c3), e3 left (c3-c0).
        const e0 = () => interp(level, x0, z0, h0, x1, z0, h1);
        const e1 = () => interp(level, x1, z0, h1, x1, z1, h2);
        const e2 = () => interp(level, x1, z1, h2, x0, z1, h3);
        const e3 = () => interp(level, x0, z1, h3, x0, z0, h0);
        const emit = (a: readonly [number, number], b: readonly [number, number]) => {
          segments.push([a[0], a[1], b[0], b[1]]);
        };

        switch (caseIndex) {
          case 1:
          case 14:
            emit(e3(), e0());
            break;
          case 2:
          case 13:
            emit(e0(), e1());
            break;
          case 3:
          case 12:
            emit(e3(), e1());
            break;
          case 4:
          case 11:
            emit(e1(), e2());
            break;
          case 5:
            // Ambiguous — fixed pairing.
            emit(e3(), e0());
            emit(e1(), e2());
            break;
          case 6:
          case 9:
            emit(e0(), e2());
            break;
          case 7:
          case 8:
            emit(e2(), e3());
            break;
          case 10:
            // Ambiguous — fixed pairing.
            emit(e0(), e1());
            emit(e2(), e3());
            break;
        }
      }
    }
  }

  return { segments, levels: [...levels] };
}
