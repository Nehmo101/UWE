import type { Atlas3DHooks } from "./types";

export class GroundTextureBaker {
  private timer = 0;
  private revision = 0;

  constructor(
    private readonly hooks: Atlas3DHooks,
    private readonly size: number,
    private readonly apply: (source: HTMLCanvasElement | OffscreenCanvas) => void,
  ) {}

  invalidate(immediate = false): void {
    this.revision++;
    window.clearTimeout(this.timer);
    if (immediate) void this.bake(this.revision);
    else this.timer = window.setTimeout(() => void this.bake(this.revision), 150);
  }

  private async bake(revision: number): Promise<void> {
    const source = await this.hooks.bakeGround(Math.min(4096, Math.max(256, this.size)));
    if (revision !== this.revision) return;
    this.apply(source);
  }

  dispose(): void {
    window.clearTimeout(this.timer);
  }
}
