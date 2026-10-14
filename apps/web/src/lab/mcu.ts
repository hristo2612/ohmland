/**
 * The microcontroller board and its code drawer, without a DOM (Unit 5). Uploading a program to a board on the bench,
 * checking it the way Upload does, and what a lab session keeps per board (uploads, serial lines, clock wraps) and per
 * code drawer (the draft, its view, the mistakes Upload refused). The runtime, the headless replay and the LabView
 * share it; the drawer's blocks and text live in ./code.
 */
import { analyze, type Diagnostic } from "@ohmland/code";
import type { BenchState, PlacedPart } from "@ohmland/bench/core";
import type { SimEvent, Snapshot } from "@ohmland/sim";
import type { BoardView, CodeConfig, CodeView, LabDefinition, SerialView } from "./define";

/** What the drawer shows for a board with nothing written yet. */
export const EMPTY_PROGRAM = "void setup() {\n}\n\nvoid loop() {\n}\n";

/** `millis()` counts to 2^32 - 1 and starts again from 0: about 49.7 days. */
export const MILLIS_WRAP = 4294967296;

/** Where the day-49 jump puts the clock: nine seconds before it wraps. */
export const DAY_49 = MILLIS_WRAP - 9000;

/** The serial monitor keeps the last lines only. */
export const SERIAL_LINES = 500;

export type McuBoardPart = Extract<PlacedPart, { kind: "mcu-board" }>;

/** The board a lab's code tools work on: its code drawer's, else the first microcontroller board on its bench. */
export function drawerBoard(lab: Pick<LabDefinition, "bench">): string | null {
  return lab.bench.code?.board ?? lab.bench.parts.find((p) => p.kind === "mcu-board")?.id ?? null;
}

/** The microcontroller board with this id on the bench. */
export function boardPart(bench: BenchState, id: string): McuBoardPart | undefined {
  const p = bench.parts.find((x) => x.id === id);
  return p?.kind === "mcu-board" ? p : undefined;
}

/**
 * The board after an upload of `source`: the program in its flash and the upload counter bumped, so the simulator
 * resets the board and runs it from `setup()` (even when it is the same program again).
 */
export function uploadTo(bench: BenchState, id: string, source: string): BenchState {
  const p = boardPart(bench, id);
  return p ? flashed(bench, id, source, (p.params.upload ?? 0) + 1) : bench;
}

/** A bench with this program and upload count in a board's flash (anything else on the bench as it is). */
export function flashed(bench: BenchState, id: string, source: string, upload: number): BenchState {
  const p = boardPart(bench, id);
  if (!p || (p.params.program === source && p.params.upload === upload)) return bench;
  const params = { ...p.params, program: source, upload };
  return { ...bench, parts: bench.parts.map((x) => (x.id === id ? ({ ...p, params } as PlacedPart) : x)) };
}

/** What Upload refuses a program for: its first mistake (warnings never stop it), or null. */
export function uploadError(source: string): Diagnostic | null {
  return analyze(source).errors[0] ?? null;
}

/** A board's upload as the simulator tells uploads apart: a change of any of these resets the board. */
function boardKey(p: McuBoardPart): string {
  return `${p.params.upload ?? 0}|${p.params.clockStart ?? 0}|${p.params.seed ?? 1}|${p.params.program ?? ""}`;
}

/** What a session keeps per board. */
export type BoardTrack = {
  key: string;
  uploads: number;
  /** Finished serial lines since the last upload, with the simulated time each ended. */
  lines: { t: number; text: string }[];
  /** The board's count of characters sent when the last upload went up (the monitor shows what came after). */
  base: number;
  wraps: number;
  lastMillis: number | null;
  /** The board's count of characters sent, at the latest snapshot. */
  chars: number;
};

/** What a session keeps per code drawer. */
export type CodeState = {
  view: "blocks" | "text";
  source: string;
  error: Diagnostic | null;
  errorsSeen: string[];
  attempts: number;
};

/**
 * Per-board and per-drawer state of a lab session. Bench changes and snapshots feed it; the drawer and solution steps
 * tell it about Upload presses.
 */
export class McuTracker {
  boards: Record<string, BoardTrack> = {};
  codes: Record<string, CodeState> = {};
  /** Bumped by every change a code tool shows (a new upload, a line printed, a refused Upload). */
  version = 0;

  constructor(bench: BenchState, config?: CodeConfig) {
    for (const p of bench.parts) if (p.kind === "mcu-board") this.boards[p.id] = fresh(boardKey(p));
    if (config) {
      const p = boardPart(bench, config.board);
      this.codes[config.board] = newCode(config.source ?? p?.params.program ?? EMPTY_PROGRAM);
    }
  }

  /** The drawer of a board (made on first use, holding the program on the board). */
  code(board: string, bench: BenchState): CodeState {
    return (this.codes[board] ??= newCode(boardPart(bench, board)?.params.program ?? EMPTY_PROGRAM));
  }

  /**
   * The bench changed. A board whose program, upload count, clock start or seed changed was uploaded to: count it,
   * start its serial monitor afresh, and show the new program in its drawer (a setup or "Show me" put it there).
   */
  setBench(bench: BenchState, snapshot: Snapshot | null): void {
    for (const p of bench.parts) {
      if (p.kind !== "mcu-board") continue;
      const key = boardKey(p);
      const tr = this.boards[p.id];
      if (!tr) {
        this.boards[p.id] = fresh(key);
        continue;
      }
      if (tr.key === key) continue;
      this.version++;
      const chars = snapshot?.parts[p.id]?.extra?.["serialChars"];
      Object.assign(tr, { key, lines: [], base: typeof chars === "number" ? chars : tr.chars, wraps: 0, lastMillis: null });
      const source = p.params.program ?? "";
      if (source.trim()) tr.uploads++;
      const code = this.codes[p.id];
      if (code && source.trim() && code.source !== source) Object.assign(code, { source, error: null });
    }
  }

  /** The circuit starts from scratch (a reset, "Show me"): the boards' monitors and clocks too. */
  resetCircuit(): void {
    for (const tr of Object.values(this.boards)) Object.assign(tr, { lines: [], base: 0, wraps: 0, lastMillis: null, chars: 0 });
    this.version++;
  }

  /** A snapshot: serial lines and clock wraps. Returns whether anything a monitor shows changed. */
  ingest(s: Snapshot): boolean {
    let changed = false;
    for (const e of s.events) if (e.type === "serial" && this.addLines(e)) changed = true;
    for (const [id, tr] of Object.entries(this.boards)) {
      const x = s.parts[id]?.extra;
      const ms = x?.["millis"];
      if (typeof ms !== "number") continue;
      // A wrap is the clock going from its last hour to its first; the reset button only goes back from somewhere low.
      if (tr.lastMillis !== null && ms < tr.lastMillis && tr.lastMillis >= MILLIS_WRAP - 3_600_000 && ms < 3_600_000) {
        tr.wraps++;
        changed = true;
      }
      tr.lastMillis = ms;
      // A line still being printed shows as it grows.
      const chars = x?.["serialChars"];
      if (typeof chars === "number" && chars !== tr.chars) {
        tr.chars = chars;
        changed = true;
      }
    }
    if (changed) this.version++;
    return changed;
  }

  private addLines(e: SimEvent): boolean {
    const tr = this.boards[e.partId];
    if (!tr) return false;
    const text = typeof e.data?.["text"] === "string" ? (e.data["text"] as string) : e.message;
    for (const line of text.split("\n")) tr.lines.push({ t: e.t, text: line });
    if (tr.lines.length > SERIAL_LINES) tr.lines.splice(0, tr.lines.length - SERIAL_LINES);
    return true;
  }

  /** An Upload press: refused with its first mistake, or gone up. */
  noteAttempt(board: string, bench: BenchState, source: string, error: Diagnostic | null): void {
    const c = this.code(board, bench);
    c.attempts++;
    c.source = source;
    c.error = error;
    if (error && !c.errorsSeen.includes(error.kind)) c.errorsSeen.push(error.kind);
    this.version++;
  }
}

const fresh = (key: string): BoardTrack => ({ key, uploads: 0, lines: [], base: 0, wraps: 0, lastMillis: null, chars: 0 });
const newCode = (source: string): CodeState => ({ view: "blocks", source, error: null, errorsSeen: [], attempts: 0 });

/** `lab.board(id)`. */
export function boardView(bench: BenchState, snapshot: Snapshot | null, tr: BoardTrack | undefined, id: string): BoardView | null {
  const p = boardPart(bench, id);
  if (!p) return null;
  const x = snapshot?.parts[id]?.extra ?? {};
  const program = x["program"];
  const source = p.params.program?.trim() ? p.params.program : null;
  return {
    power: x["power"] === "jack" || x["power"] === "off" ? x["power"] : (p.params.power ?? "usb"),
    powered: x["powered"] === true,
    program: program === "running" || program === "error" || program === "stopped" || program === "off" ? program : source ? "off" : "none",
    source,
    error: typeof x["error"] === "string" ? x["error"] : null,
    line: typeof x["line"] === "number" ? x["line"] : null,
    millis: typeof x["millis"] === "number" ? x["millis"] : (p.params.clockStart ?? 0),
    uploads: tr?.uploads ?? 0,
    wraps: tr?.wraps ?? 0,
  };
}

/** `lab.serial(board)`: the finished lines since the last upload, and the line still being printed. */
export function serialView(snapshot: Snapshot | null, tr: BoardTrack | undefined, id: string): SerialView {
  const lines = tr?.lines ?? [];
  const x = snapshot?.parts[id]?.extra;
  const tail = typeof x?.["serial"] === "string" ? (x["serial"] as string) : "";
  const chars = typeof x?.["serialChars"] === "number" ? (x["serialChars"] as number) : 0;
  const since = Math.max(0, chars - (tr?.base ?? 0));
  const recent = since ? tail.slice(Math.max(0, tail.length - since)) : "";
  const partial = recent.slice(recent.lastIndexOf("\n") + 1).replace(/\r$/, "");
  const all = lines.map((l) => l.text);
  return { lines: all, times: lines.map((l) => l.t), partial, text: [...all, ...(partial ? [partial] : [])].join("\n") };
}

/** `lab.code(board)`. */
export function codeView(state: CodeState | undefined, bench: BenchState, board: string): CodeView {
  const s = state ?? newCode(boardPart(bench, board)?.params.program ?? EMPTY_PROGRAM);
  const e = s.error;
  return { view: s.view, source: s.source, error: e ? { line: e.line, col: e.col, kind: e.kind, message: e.message } : null, errorsSeen: [...s.errorsSeen], attempts: s.attempts };
}
