/**
 * The microcontroller board in a lab (Unit 5): code steps replay headlessly like the drawer's Upload (a mistake is
 * refused and noted, a good program goes up and the board restarts), and the LabView helpers read the board, its
 * pins, its serial lines and its clock.
 */
import { describe, expect, it } from "vitest";
import mcuDemo, { BLINK, HELLO, START } from "../../../../content/labs/mcu-demo";
import { buildBench } from "./build";
import { defineLab, type LabView } from "./define";
import { DAY_49, uploadError } from "./mcu";
import { replayLab } from "./replay";

const bench = mcuDemo.bench;
const TYPO = BLINK.replace("digitalWrite(7, HIGH)", "digitalwrite(7, HIGH)");
const NO_SEMICOLON = BLINK.replace("delay(1000);", "delay(1000)");

/** A lab whose tasks check the board at each point of a solution full of code steps. */
const probe = defineLab({
  id: "mcu-probe",
  title: "Board probe",
  bench: { ...bench, code: { board: "U1", source: START } },
  tasks: [
    {
      id: "refused",
      prompt: "",
      hints: [],
      success: "",
      goal: (lab) => {
        const c = lab.code("U1");
        return c.attempts === 2 && c.errorsSeen.join() === "case,semicolon" && c.error?.kind === "semicolon" && lab.uploads("U1") === 0 && lab.board("U1")?.program === "none";
      },
    },
    {
      id: "running",
      prompt: "",
      hints: [],
      success: "",
      goal: (lab) => {
        const b = lab.board("U1");
        const pin = lab.pin("U1", 7);
        return lab.uploads("U1") === 1 && lab.code("U1").error === null && b?.program === "running" && b.source === BLINK && pin?.mode === "OUTPUT" && pin.name === "D7";
      },
    },
    {
      id: "blinks",
      prompt: "",
      hints: [],
      success: "",
      goal: (lab) => {
        const p = lab.periods("pin:U1:7", 0.5, 8);
        return p.length >= 2 && p.every((x) => Math.abs(x - 2) < 0.05);
      },
    },
    {
      id: "prints",
      prompt: "",
      hints: [],
      success: "",
      goal: (lab) => {
        const s = lab.serial("U1");
        return lab.uploads("U1") === 2 && s.lines.slice(0, 4).join() === "on,off,on,off" && s.times.every((t, i) => i === 0 || t > s.times[i - 1]!);
      },
    },
    {
      id: "wrapped",
      prompt: "",
      hints: [],
      success: "",
      goal: (lab) => (lab.board("U1")?.wraps ?? 0) === 1 && (lab.millis("U1") ?? Infinity) < 60_000,
    },
    {
      id: "views",
      prompt: "",
      hints: [],
      success: "",
      goal: (lab) => lab.view("code:text") && lab.view("millis:U1") && !lab.view("serial:U1"),
    },
  ],
  solution: [
    { do: "code", part: "U1", source: TYPO },
    { do: "code", part: "U1", source: NO_SEMICOLON },
    { do: "check", task: "refused" },
    { do: "code", part: "U1", source: BLINK },
    { do: "check", task: "running" },
    { do: "wait", seconds: 7 },
    { do: "check", task: "blinks" },
    { do: "code", part: "U1", source: HELLO },
    { do: "wait", seconds: 4 },
    { do: "check", task: "prints" },
    { do: "set", part: "U1", key: "millis", value: DAY_49 },
    { do: "wait", seconds: 10 },
    { do: "check", task: "wrapped" },
    { do: "view", name: "code:text", on: true },
    { do: "view", name: "millis:U1", on: true },
    { do: "check", task: "views" },
  ],
});

describe("the microcontroller board in a lab", () => {
  it("builds the demo bench cleanly", () => {
    expect(buildBench(mcuDemo.bench).warnings).toEqual([]);
    for (const s of [START, BLINK, HELLO]) expect(uploadError(s)).toBeNull();
  });

  it("replays code steps like Upload and reads the board", { timeout: 60_000 }, () => {
    const r = replayLab(probe);
    expect(r.problems).toEqual([]);
    expect(r.failedChecks).toEqual([]);
    expect(r.missing).toEqual([]);
    const v: LabView = r.session.view();
    expect(v.code("U1").source).toBe(HELLO);
    expect(v.code("U1").attempts).toBe(4);
    expect(v.board("R1")).toBeNull();
    expect(v.pin("U1", "A0")?.n).toBe(14);
  });

  it("starts the serial monitor afresh on each upload", { timeout: 60_000 }, () => {
    const lab = defineLab({
      ...probe,
      id: "mcu-serial",
      tasks: [{ id: "twice", prompt: "", hints: [], success: "", goal: (lab) => lab.uploads("U1") === 2 && lab.serial("U1").lines[0] === "on" && lab.serial("U1").lines.length <= 2 }],
      solution: [
        { do: "code", part: "U1", source: HELLO },
        { do: "wait", seconds: 5 },
        { do: "code", part: "U1", source: HELLO },
        { do: "wait", seconds: 0.5 },
        { do: "check", task: "twice" },
      ],
    });
    const r = replayLab(lab);
    expect(r.failedChecks).toEqual([]);
  });

  it("refuses a code step aimed at something that is not a board", () => {
    const lab = defineLab({ ...probe, id: "mcu-wrong", tasks: [{ id: "t", prompt: "", hints: [], success: "", goal: () => true }], solution: [{ do: "code", part: "R1", source: BLINK }] });
    expect(replayLab(lab).problems).toEqual(["step 1 (code): code: R1 is not a microcontroller board"]);
  });

  it("asks for a code drawer's board to be a board", () => {
    expect(() => defineLab({ ...probe, id: "mcu-bad", bench: { ...bench, code: { board: "R1" } } })).toThrow(/not a microcontroller board/);
  });
});
