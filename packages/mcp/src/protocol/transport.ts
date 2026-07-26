/**
 * Newline-delimited JSON-RPC framing over stdio.
 *
 * Invariant: stdout carries protocol frames and nothing else. Every diagnostic
 * goes to stderr — a stray `console.log` corrupts the stream and the client
 * drops the connection.
 */
import type { Readable, Writable } from "node:stream";
import type { JsonRpcResponse } from "./types";

/**
 * Incremental line splitter. Kept as a class (not a generator) so the parser can
 * be unit-tested with hand-fed chunks that split frames at arbitrary offsets.
 */
export class LineBuffer {
  private buffer = "";

  /** Feeds a chunk and returns every complete line it produced. */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines: string[] = [];

    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.trim().length > 0) {
        lines.push(line);
      }
      newlineIndex = this.buffer.indexOf("\n");
    }

    return lines;
  }

  /** Remaining unterminated input — a well-behaved client leaves this empty. */
  get pending(): string {
    return this.buffer;
  }
}

export function serializeMessage(message: JsonRpcResponse): string {
  return `${JSON.stringify(message)}\n`;
}

export function writeMessage(output: Writable, message: JsonRpcResponse): void {
  output.write(serializeMessage(message));
}

/** Diagnostics never touch stdout — see the invariant above. */
export function logDiagnostic(serverName: string, message: string): void {
  process.stderr.write(`[${serverName}] ${message}\n`);
}

/**
 * Reads NDJSON frames from `input` until it closes, invoking `onLine` per frame.
 * Resolves when the stream ends so `bin/*` entrypoints can exit cleanly.
 */
export function readLines(input: Readable, onLine: (line: string) => void): Promise<void> {
  const lineBuffer = new LineBuffer();

  return new Promise((resolve, reject) => {
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => {
      for (const line of lineBuffer.push(chunk)) {
        onLine(line);
      }
    });
    input.on("end", () => resolve());
    input.on("close", () => resolve());
    input.on("error", (error: Error) => reject(error));
  });
}
