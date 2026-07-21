/**
 * Undo/redo command stack for the Atlas 3D editor.
 *
 * Pure, framework-agnostic and deterministic: commands mutate an external
 * document via apply/revert callbacks; the stack only sequences them. Slider
 * drags coalesce into a single undo step via `coalesceKey`.
 */

export interface Atlas3DCommand {
  /** Human-readable label, e.g. "Spaltbreite ändern" (shown in history UI). */
  label: string;
  /** Commands with the same key replace the previous stack top instead of pushing. */
  coalesceKey?: string;
  apply(): void;
  revert(): void;
}

export interface Atlas3DCommandStackOptions {
  /** Maximum undoable steps; oldest entries are dropped beyond it. */
  capacity?: number;
  /** Called after every apply/undo/redo — hook for autosave scheduling. */
  onChange?: (stack: Atlas3DCommandStack) => void;
}

const DEFAULT_CAPACITY = 100;

export class Atlas3DCommandStack {
  private readonly capacity: number;
  private readonly onChange?: (stack: Atlas3DCommandStack) => void;
  private undoStack: Atlas3DCommand[] = [];
  private redoStack: Atlas3DCommand[] = [];

  constructor(options: Atlas3DCommandStackOptions = {}) {
    this.capacity = Math.max(1, options.capacity ?? DEFAULT_CAPACITY);
    this.onChange = options.onChange;
  }

  get undoDepth(): number {
    return this.undoStack.length;
  }

  get redoDepth(): number {
    return this.redoStack.length;
  }

  get undoLabel(): string | null {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].label : null;
  }

  get redoLabel(): string | null {
    return this.redoStack.length > 0 ? this.redoStack[this.redoStack.length - 1].label : null;
  }

  /** Apply a command and push it as a new undo step (coalescing if requested). */
  execute(command: Atlas3DCommand): void {
    command.apply();
    const top = this.undoStack[this.undoStack.length - 1];
    if (
      command.coalesceKey !== undefined &&
      top !== undefined &&
      top.coalesceKey === command.coalesceKey
    ) {
      // Keep the ORIGINAL revert so one undo returns to the pre-drag state.
      this.undoStack[this.undoStack.length - 1] = {
        label: command.label,
        coalesceKey: command.coalesceKey,
        apply: command.apply,
        revert: top.revert,
      };
    } else {
      this.undoStack.push(command);
      if (this.undoStack.length > this.capacity) {
        this.undoStack.shift();
      }
    }
    this.redoStack = [];
    this.onChange?.(this);
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    command.revert();
    this.redoStack.push(command);
    this.onChange?.(this);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    command.apply();
    this.undoStack.push(command);
    this.onChange?.(this);
    return true;
  }

  /** Breaks coalescing so the next same-key command starts a new undo step. */
  sealCoalescing(): void {
    const top = this.undoStack[this.undoStack.length - 1];
    if (top?.coalesceKey !== undefined) {
      this.undoStack[this.undoStack.length - 1] = { ...top, coalesceKey: undefined };
    }
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange?.(this);
  }
}

/** Convenience: value change on a settable target as a command. */
export function valueCommand<T>(options: {
  label: string;
  coalesceKey?: string;
  get: () => T;
  set: (value: T) => void;
  next: T;
}): Atlas3DCommand {
  const previous = options.get();
  return {
    label: options.label,
    coalesceKey: options.coalesceKey,
    apply: () => options.set(options.next),
    revert: () => options.set(previous),
  };
}
