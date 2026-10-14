/**
 * Plays a lab's solution headlessly: builds the bench, runs the in-thread simulator, applies each step, feeds every
 * snapshot to a LabSession and reports which tasks got done. The solution test runs it for every lab, and plays each
 * task's "Show me" from its checkpoint (replayShowMe), as the lesson player does for a learner who asks.
 */
import { createSimulation, type InputKey, type InputValue, type Simulation } from "@ohmland/sim";
import type { BenchState } from "@ohmland/bench/core";
import { buildBench, controlTargets, type BuiltBench, type SimInput } from "./build";
import { isOptional, type LabDefinition, type SolutionStep, type TaskStatus } from "./define";
import { parseNote } from "./notes";
import { LabSession, type FriedRecord } from "./session";
import { applyStep, solutionSegments, type StepEffect } from "./steps";
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

/** A bench to start from instead of the lab's own: a task's checkpoint, with the tasks done before it. */
type Start = { bench: BenchState; inputs: SimInput[]; done: readonly string[] };

/** The simulator and a session, driven by solution steps the way the runtime drives them. */
type Player = {
  session: LabSession;
  fried: FriedRecord[];
  triggers: string[];
  problems: string[];
  /** Lets `seconds` of real time pass (frames of 1/30 s, each `speed` simulated frames long). */
  advance(seconds: number): void;
  /** Applies one solution step (its bench change, inputs, notes, controls, panels and views). The caller waits. */
  play(step: SolutionStep, index: number): StepEffect;
  time(): number;
  dispose(): void;
};

function createPlayer(lab: LabDefinition, built: BuiltBench, start?: Start): Player {
  const session = new LabSession(lab, built, start?.done ?? []);
  const sim: Simulation = createSimulation();
  const tone = createToneMeter();
  sim.onAudio((samples, rate) => {
    session.tone = tone.push(samples, rate);
    session.toneQuick = tone.quick();
  });
  const fried: FriedRecord[] = [];
  const triggers: string[] = [];
  const problems: string[] = [];
  const delayed: { at: number; id: string; key: InputKey; value: InputValue }[] = [];

  sim.load(start ? session.setBench(start.bench).netlist : session.net.netlist);
  for (const i of built.inputs) sim.setInput(i.id, i.key, i.value);
  if (start) {
    for (const i of start.inputs) sim.setInput(i.id, i.key, i.value);
    for (const c of built.controls) if (c.part === "*") for (const id of controlTargets(session.bench, c)) sim.setInput(id, c.key, session.controls[c.id] ?? c.value);
  }
  // The lab's `settle`, unseen, as the runtime runs it before the learner sees the bench (a Show me's fresh load too).
  if (lab.settle) sim.step(lab.settle);
  // Simulated seconds per real second, as the runtime would run (a "speed" control turns it up for a time-lapse).
  let speed = lab.speed ?? 1;
  for (const c of built.controls) if (c.key === "speed") speed = c.value;

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

  const play = (step: SolutionStep, i: number): StepEffect => {
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
    if (eff.view) session.setView(eff.view.name, eff.view.on);
    if (eff.panelView) session.setView(eff.panelView.name, eff.panelView.on);
    if (eff.roll) {
      if (!session.rolls[eff.roll.id]) problems.push(`step ${i + 1}: no histogram "${eff.roll.id}"`);
      else {
        // The auto-roller presses away; the next step waits for it (about a second a roll at most).
        session.startRolls(eff.roll.id, eff.roll.times);
        const limit = sim.time + (eff.roll.times ?? 100) * 1.5 + 1;
        while (session.rolls[eff.roll.id]!.roller && sim.time < limit) advance(0.25);
      }
    }
    if (eff.trace !== undefined) session.setTrace(eff.trace);
    if (eff.code) session.noteUpload(eff.code.part, eff.code.source, eff.code.error);
    return eff;
  };

  return { session, fried, triggers, problems, advance, play, time: () => sim.time, dispose: () => sim.dispose() };
}

/**
 * Replays a lab's solution. `trace` (optional) gets a line after every step: the step, the meter's display and the
 * tasks done so far, which is handy while writing a solution.
 */
export function replayLab(lab: LabDefinition, trace?: (line: string) => void): ReplayResult {
  const built = buildBench(lab.bench);
  const p = createPlayer(lab, built);
  const failedChecks: string[] = [];
  p.advance(0.3);
  lab.solution.forEach((step, i) => {
    const eff = p.play(step, i);
    if (eff.check) {
      // Give the goal a moment: a check right after an action waits for the circuit to settle.
      if (p.session.status[eff.check] !== "done") p.advance(0.5);
      if (p.session.status[eff.check] !== "done") failedChecks.push(`${eff.check} (at step ${i + 1})`);
    }
    if (eff.wait > 0) p.advance(eff.wait);
    if (trace) {
      const v = p.session.view();
      const m = v.meter;
      const done = lab.tasks.filter((t) => p.session.status[t.id] === "done").map((t) => t.id);
      trace(`${i + 1}. ${JSON.stringify(step)} | t=${p.time().toFixed(2)} | meter ${m ? `${m.mode} ${m.range ?? ""} "${m.display ?? ""}" ${m.unit ?? ""}` : "-"} | done: ${done.join(", ")}`);
    }
  });
  p.advance(0.5);
  p.dispose();

  const session = p.session;
  const missing = lab.tasks.filter((t) => !isOptional(t) && session.status[t.id] !== "done").map((t) => t.id);
  return { status: { ...session.status }, missing, failedChecks, problems: p.problems, fried: p.fried, triggers: p.triggers, warnings: built.warnings, seconds: p.time(), session };
}

export type ShowMeResult = {
  /** The task was done once its steps had played (and a moment to settle). */
  done: boolean;
  /** Steps that did not apply cleanly. */
  problems: string[];
  /** The task's goal threw or the lab has no checkpoint for it. */
  error?: string;
  session: LabSession;
};

/**
 * "Show me" for one task, as the lesson player plays it (LabRuntime.showMe): the bench goes back to the task's
 * checkpoint (the solution's steps before its own, applied without the simulator, then the circuit started fresh),
 * the tasks before it count as done, and its own steps play with at least 0.85 s between them. A learner who resumes
 * the lesson at this task and asks for Show me gets exactly this.
 */
export function replayShowMe(lab: LabDefinition, taskId: string): ShowMeResult {
  const built = buildBench(lab.bench);
  const seg = solutionSegments(lab.solution).get(taskId);
  if (!seg) {
    const session = new LabSession(lab, built);
    return { done: false, problems: [], error: `no check for "${taskId}" in the solution`, session };
  }
  // The checkpoint: the solution up to where this task's own steps begin (LabRuntime.checkpoint).
  let bench = built.bench;
  const inputs: SimInput[] = [];
  for (let i = 0; i < seg.start; i++) {
    const e = applyStep(bench, lab.solution[i]!);
    bench = e.bench;
    // A delayed input (a timed press's release) has happened by the next step: keep its final value, undelayed.
    for (const { after: _after, ...inp } of e.inputs) inputs.push(inp);
  }
  const required = lab.tasks.filter((t) => !isOptional(t)).map((t) => t.id);
  const at = required.indexOf(taskId);
  const done = at >= 0 ? required.slice(0, at) : required.filter((id) => (solutionSegments(lab.solution).get(id)?.end ?? Infinity) < seg.start);
  const p = createPlayer(lab, built, { bench, inputs, done });
  // The player shows the rewound bench for a moment before the first step.
  p.advance(0.7);
  for (let i = seg.start; i < seg.end; i++) {
    const step = lab.solution[i]!;
    const eff = p.play(step, i);
    p.advance(step.do === "wait" ? step.seconds : Math.max(0.85, eff.wait));
  }
  // The learner watches the result: the goal has a moment to see it.
  for (let k = 0; k < 8 && p.session.status[taskId] !== "done"; k++) p.advance(0.25);
  p.dispose();
  return { done: p.session.status[taskId] === "done", problems: p.problems, session: p.session };
}
