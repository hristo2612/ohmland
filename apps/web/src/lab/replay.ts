/**
 * Plays a lab's solution headlessly: builds the bench, runs the in-thread simulator, applies each step, feeds every
 * snapshot to a LabSession and reports which tasks got done. The solution test runs it for every lab.
 */
import { createSimulation, type InputKey, type InputValue } from "@ohmland/sim";
import { buildBench, controlTargets } from "./build";
import { isOptional, type LabDefinition, type TaskStatus } from "./define";
import { parseNote } from "./notes";
import { LabSession, type FriedRecord } from "./session";
import { applyStep } from "./steps";
import { createToneMeter } from "./tone";

export type ReplayResult = {
  status: Record<string, TaskStatus>;
  /** Required tasks still not done at the end. */
  missing: string[];
  /** Checkpoints that were not done when reached. */
  failedChecks: string[];
  /** Steps that did not apply cleanly. */
  problems: string[];
  fried: FriedRecord[];
  triggers: string[];
  warnings: string[];
  /** Simulated seconds the replay took. */
  seconds: number;
  /** The session at the end, for debugging a failing lab. */
  session: LabSession;
};

const FRAME = 1 / 30;

/**
 * Replays a lab's solution. `trace` (optional) gets a line after every step: the step, the meter's display and the
 * tasks done so far, which is handy while writing a solution.
 */
export function replayLab(lab: LabDefinition, trace?: (line: string) => void): ReplayResult {
  const built = buildBench(lab.bench);
  const session = new LabSession(lab, built);
  const sim = createSimulation();
  const tone = createToneMeter();
  sim.onAudio((samples, rate) => {
    session.tone = tone.push(samples, rate);
    session.toneQuick = tone.quick();
  });
  const fried: FriedRecord[] = [];
  const triggers: string[] = [];
  const problems: string[] = [];
  const failedChecks: string[] = [];
  const delayed: { at: number; id: string; key: InputKey; value: InputValue }[] = [];

  sim.load(session.net.netlist);
  for (const i of built.inputs) sim.setInput(i.id, i.key, i.value);
  // Simulated seconds per real second, as the runtime would run (a "speed" control turns it up for a time-lapse).
  let speed = lab.speed ?? 1;
  for (const c of built.controls) if (c.key === "speed") speed = c.value;

  /** Lets `seconds` of real time pass (frames of 1/30 s, each `speed` simulated frames long). */
  const advance = (seconds: number) => {
    let left = seconds;
    while (left > 1e-9) {
      const dt = Math.min(FRAME, left);
      const s = sim.step(dt * speed, { speed });
      left -= dt;
      for (let k = delayed.length - 1; k >= 0; k--) {
        const d = delayed[k]!;
        if (d.at <= sim.time + 1e-9) {
          sim.setInput(d.id, d.key, d.value);
          delayed.splice(k, 1);
        }
      }
      const u = session.ingest(s);
      fried.push(...u.fried);
      triggers.push(...u.triggers);
      for (const inp of u.inputs) sim.setInput(inp.id, inp.key, inp.value);
    }
  };

  advance(0.3);
  lab.solution.forEach((step, i) => {
    const eff = applyStep(session.bench, step);
    if (eff.problem) problems.push(`step ${i + 1} (${step.do}): ${eff.problem}`);
    if (eff.bench !== session.bench) {
      sim.load(session.setBench(eff.bench).netlist);
      // Sliders that drive every part of a kind reach parts placed since.
      for (const c of built.controls) if (c.part === "*") for (const id of controlTargets(session.bench, c)) sim.setInput(id, c.key, session.controls[c.id] ?? c.value);
    }
    for (const inp of eff.inputs) {
      if (inp.after) delayed.push({ at: sim.time + inp.after, id: inp.id, key: inp.key, value: inp.value });
      else sim.setInput(inp.id, inp.key, inp.value);
      // A fresh part (or meter fuse) may fry again.
      if (inp.key === "replace") session.revive(inp.id);
      if (inp.key === "replaceFuse") session.revive(`${inp.id}:fuse`);
    }
    if (eff.note) {
      const spec = lab.tasks.flatMap((t) => (t.note ? (Array.isArray(t.note) ? t.note : [t.note]) : [])).find((n) => n.id === eff.note!.id);
      session.setNote(eff.note.id, parseNote(eff.note.value, spec?.unit));
    }
    if (eff.control) {
      const c = built.controls.find((x) => x.id === eff.control!.id);
      if (!c) problems.push(`step ${i + 1}: no control "${eff.control.id}"`);
      else {
        session.setControl(c.id, eff.control.value);
        if (c.key === "speed") speed = eff.control.value;
        else for (const id of controlTargets(session.bench, c)) sim.setInput(id, c.key as InputKey, eff.control.value);
      }
    }
    if (eff.panel && !session.answer(eff.panel.id, eff.panel.value, true)) problems.push(`step ${i + 1}: no panel "${eff.panel.id}"`);
    if (eff.tapper !== undefined) {
      if (!session.tapper) problems.push(`step ${i + 1}: no tapper`);
      session.setTapper(eff.tapper);
    }
    if (eff.check) {
      // Give the goal a moment: a check right after an action waits for the circuit to settle.
      if (session.status[eff.check] !== "done") advance(0.5);
      if (session.status[eff.check] !== "done") failedChecks.push(`${eff.check} (at step ${i + 1})`);
    }
    if (eff.wait > 0) advance(eff.wait);
    if (trace) {
      const v = session.view();
      const m = v.meter;
      const done = lab.tasks.filter((t) => session.status[t.id] === "done").map((t) => t.id);
      trace(`${i + 1}. ${JSON.stringify(step)} | t=${sim.time.toFixed(2)} | meter ${m ? `${m.mode} ${m.range ?? ""} "${m.display ?? ""}" ${m.unit ?? ""}` : "-"} | done: ${done.join(", ")}`);
    }
  });
  advance(0.5);
  sim.dispose();

  const missing = lab.tasks.filter((t) => !isOptional(t) && session.status[t.id] !== "done").map((t) => t.id);
  return { status: { ...session.status }, missing, failedChecks, problems, fried, triggers, warnings: built.warnings, seconds: sim.time, session };
}
