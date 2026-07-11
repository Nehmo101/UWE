import { sampleElevation, type ElevationGrid } from "@uwe/atlas/elevation";

export interface HeightfieldMeshData {
  cols: number;
  rows: number;
  worldWidth: number;
  worldDepth: number;
  heightScale: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array | Uint32Array;
}

export interface HeightfieldOptions {
  worldWidth?: number;
  worldDepth?: number;
  heightScale?: number;
}

function vertexIndex(col: number, row: number, cols: number): number {
  return row * (cols + 1) + col;
}

function normalise3(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

export function buildHeightfieldMesh(
  grid: ElevationGrid,
  options: HeightfieldOptions = {},
): HeightfieldMeshData {
  const cols = Math.max(1, Math.floor(grid.cols));
  const rows = Math.max(1, Math.floor(grid.rows));
  const worldWidth = options.worldWidth ?? 2;
  const worldDepth = options.worldDepth ?? 1.25;
  const heightScale = options.heightScale ?? 0.45;
  const vertexCount = (cols + 1) * (rows + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const nx = col / cols;
      const ny = row / rows;
      const vi = vertexIndex(col, row, cols);
      positions[vi * 3] = (nx - 0.5) * worldWidth;
      positions[vi * 3 + 1] = sampleElevation(grid, nx, ny) * heightScale;
      positions[vi * 3 + 2] = (ny - 0.5) * worldDepth;
      uvs[vi * 2] = nx;
      uvs[vi * 2 + 1] = 1 - ny;
    }
  }

  const triangleCount = cols * rows * 2;
  const IndexArray = vertexCount > 65_535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(triangleCount * 3);
  let ii = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = vertexIndex(col, row, cols);
      const b = vertexIndex(col + 1, row, cols);
      const c = vertexIndex(col, row + 1, cols);
      const d = vertexIndex(col + 1, row + 1, cols);
      indices[ii++] = a;
      indices[ii++] = c;
      indices[ii++] = b;
      indices[ii++] = b;
      indices[ii++] = c;
      indices[ii++] = d;
    }
  }

  recomputeNormals({ cols, rows, worldWidth, worldDepth, heightScale, positions, normals, uvs, indices });
  return { cols, rows, worldWidth, worldDepth, heightScale, positions, normals, uvs, indices };
}

export function updateHeightsInPlace(data: HeightfieldMeshData, grid: ElevationGrid): void {
  for (let row = 0; row <= data.rows; row++) {
    for (let col = 0; col <= data.cols; col++) {
      const vi = vertexIndex(col, row, data.cols);
      data.positions[vi * 3 + 1] =
        sampleElevation(grid, col / data.cols, row / data.rows) * data.heightScale;
    }
  }
  recomputeNormals(data);
}

export function recomputeNormals(data: HeightfieldMeshData): void {
  data.normals.fill(0);
  for (let i = 0; i < data.indices.length; i += 3) {
    const ia = data.indices[i]! * 3;
    const ib = data.indices[i + 1]! * 3;
    const ic = data.indices[i + 2]! * 3;
    const abx = data.positions[ib]! - data.positions[ia]!;
    const aby = data.positions[ib + 1]! - data.positions[ia + 1]!;
    const abz = data.positions[ib + 2]! - data.positions[ia + 2]!;
    const acx = data.positions[ic]! - data.positions[ia]!;
    const acy = data.positions[ic + 1]! - data.positions[ia + 1]!;
    const acz = data.positions[ic + 2]! - data.positions[ia + 2]!;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const offset of [ia, ib, ic]) {
      data.normals[offset] += nx;
      data.normals[offset + 1] += ny;
      data.normals[offset + 2] += nz;
    }
  }
  for (let i = 0; i < data.normals.length; i += 3) {
    const [x, y, z] = normalise3(data.normals[i]!, data.normals[i + 1]!, data.normals[i + 2]!);
    data.normals[i] = x;
    data.normals[i + 1] = y;
    data.normals[i + 2] = z;
  }
}
