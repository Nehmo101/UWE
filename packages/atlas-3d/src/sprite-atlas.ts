export interface SpriteSlot {
  index: number;
  column: number;
  row: number;
  u: number;
  v: number;
  width: number;
  height: number;
}

export class SpriteAtlasAllocator {
  readonly columns: number;
  readonly rows: number;
  readonly capacity: number;
  private readonly slots = new Map<string, SpriteSlot>();

  constructor(columns = 8, rows = 8) {
    this.columns = Math.max(1, Math.floor(columns));
    this.rows = Math.max(1, Math.floor(rows));
    this.capacity = this.columns * this.rows;
  }

  allocate(key: string): SpriteSlot | null {
    const existing = this.slots.get(key);
    if (existing) return existing;
    if (this.slots.size >= this.capacity) return null;
    const used = new Set([...this.slots.values()].map((slot) => slot.index));
    let index = 0;
    while (used.has(index)) index++;
    const column = index % this.columns;
    const row = Math.floor(index / this.columns);
    const slot = {
      index,
      column,
      row,
      u: column / this.columns,
      v: row / this.rows,
      width: 1 / this.columns,
      height: 1 / this.rows,
    };
    this.slots.set(key, slot);
    return slot;
  }

  release(key: string): boolean {
    return this.slots.delete(key);
  }

  clear(): void {
    this.slots.clear();
  }
}
