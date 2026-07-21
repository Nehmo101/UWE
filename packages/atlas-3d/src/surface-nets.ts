/**
 * Naive Surface Nets — meshes a signed distance field into triangles.
 *
 * Deterministic and dependency-free: same field + same grid → identical
 * buffers. Chosen over marching cubes for its compact implementation and the
 * smooth-but-faceted look that suits the ink style (flat shading comes from
 * the material, not the mesher).
 */

export type SampleFn = (x: number, y: number, z: number) => number;

export interface SurfaceNetsResult {
  positions: Float32Array;
  indices: Uint32Array;
}

const EDGE_CORNERS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [3, 7], [2, 6],
];

/**
 * Mesh the region where `sample` crosses zero inside [min, max].
 * `resolution` is the cell count per axis (samples are resolution+1 per axis).
 */
export function surfaceNets(
  sample: SampleFn,
  min: readonly [number, number, number],
  max: readonly [number, number, number],
  resolution: readonly [number, number, number],
): SurfaceNetsResult {
  const [nx, ny, nz] = resolution;
  const sx = (max[0] - min[0]) / nx;
  const sy = (max[1] - min[1]) / ny;
  const sz = (max[2] - min[2]) / nz;

  // corner samples
  const cx = nx + 1;
  const cy = ny + 1;
  const cz = nz + 1;
  const values = new Float32Array(cx * cy * cz);
  const cornerIndex = (i: number, j: number, k: number) => (k * cy + j) * cx + i;
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        values[cornerIndex(i, j, k)] = sample(min[0] + i * sx, min[1] + j * sy, min[2] + k * sz);
      }
    }
  }

  // one vertex per sign-changing cell, at the mean of its edge crossings
  const cellVertex = new Int32Array(nx * ny * nz).fill(-1);
  const cellIndex = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const positions: number[] = [];

  const corner = (i: number, j: number, k: number, c: number): number =>
    values[cornerIndex(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
  const cornerPos = (i: number, j: number, k: number, c: number): [number, number, number] => [
    min[0] + (i + (c & 1)) * sx,
    min[1] + (j + ((c >> 1) & 1)) * sy,
    min[2] + (k + ((c >> 2) & 1)) * sz,
  ];

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          if (corner(i, j, k, c) < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 0xff) continue;
        let px = 0;
        let py = 0;
        let pz = 0;
        let crossings = 0;
        for (const [a, b] of EDGE_CORNERS) {
          const va = corner(i, j, k, a);
          const vb = corner(i, j, k, b);
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          const pa = cornerPos(i, j, k, a);
          const pb = cornerPos(i, j, k, b);
          px += pa[0] + (pb[0] - pa[0]) * t;
          py += pa[1] + (pb[1] - pa[1]) * t;
          pz += pa[2] + (pb[2] - pa[2]) * t;
          crossings++;
        }
        cellVertex[cellIndex(i, j, k)] = positions.length / 3;
        positions.push(px / crossings, py / crossings, pz / crossings);
      }
    }
  }

  // connect quads across every sign-changing grid edge
  const indices: number[] = [];
  const pushQuad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) {
      indices.push(a, b, c, a, c, d);
    } else {
      indices.push(a, c, b, a, d, c);
    }
  };

  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        const v0 = values[cornerIndex(i, j, k)];
        // edge along +x — the four surrounding cells share cell-x index i
        if (i < nx && j >= 1 && j < ny && k >= 1 && k < nz) {
          const v1 = values[cornerIndex(i + 1, j, k)];
          if ((v0 < 0) !== (v1 < 0)) {
            pushQuad(
              cellVertex[cellIndex(i, j - 1, k - 1)],
              cellVertex[cellIndex(i, j, k - 1)],
              cellVertex[cellIndex(i, j, k)],
              cellVertex[cellIndex(i, j - 1, k)],
              v0 < 0,
            );
          }
        }
        // edge along +y
        if (j < ny && i >= 1 && i < nx && k >= 1 && k < nz) {
          const v1 = values[cornerIndex(i, j + 1, k)];
          if ((v0 < 0) !== (v1 < 0)) {
            pushQuad(
              cellVertex[cellIndex(i - 1, j, k - 1)],
              cellVertex[cellIndex(i - 1, j, k)],
              cellVertex[cellIndex(i, j, k)],
              cellVertex[cellIndex(i, j, k - 1)],
              v0 < 0,
            );
          }
        }
        // edge along +z
        if (k < nz && i >= 1 && i < nx && j >= 1 && j < ny) {
          const v1 = values[cornerIndex(i, j, k + 1)];
          if ((v0 < 0) !== (v1 < 0)) {
            pushQuad(
              cellVertex[cellIndex(i - 1, j - 1, k)],
              cellVertex[cellIndex(i, j - 1, k)],
              cellVertex[cellIndex(i, j, k)],
              cellVertex[cellIndex(i - 1, j, k)],
              v0 < 0,
            );
          }
        }
      }
    }
  }

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
