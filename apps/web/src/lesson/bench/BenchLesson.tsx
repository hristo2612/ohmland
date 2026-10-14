/**
 * The bench lesson player (format: bench, docs/LESSONS.md). The learner sits at the bench the whole time. The margin
 * holds the robot (its eyes are the progress), its one short line and the one thing to do now; discoveries are drawn
 * onto the parts, rules are stamped quietly into the margin and collected in the notebook, and checks happen on the
 * bench. At the end the notebook page is signed off and the island grows.
 *
 * The shell (this file) is light: the bench, the simulator and three.js arrive in the Stage chunk, warmed on the
 * learner's first gesture or after a few seconds, never in the page's first load.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BenchLessonData } from "../../content/load";
import { m } from "../../i18n";
import { Dialog } from "../../components/Dialog";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { BenchSurfaceChunk, INK_RENDERER, readViewPref, resolveView, storeViewPref, type BenchViewKind, type BenchViewPref } from "../../lab/bench-view";
import type { NoteSpec, SolutionStep } from "../../lab/define";
import { loadLab } from "../../lab/labs";
import { preloadable, warmSimulator, whenIdle } from "../../lab/prefetch";
import type { FriedCard } from "../../lab/runtime";
import { prefersReducedMotion } from "../../progress/prefs";
import { flushSaves, useLearner, type Completion } from "../../progress/store";
import { useLearnerReady } from "../../progress/useLearner";
import { XP } from "../../progress/xp";
import { gradeNumeric } from "../../quiz/si";
import { getIsleHooks, revealWithin, type IsleRevealResult } from "../isle-hooks";
import type { PlayerProps } from "../types";
import { BenchFinale } from "./BenchFinale";
import {
  answerKeys,
  checkOf,
  hasDiscovery,
  isMomentDone,
  momentsOf,
  noteText,
  progressOf,
  recordTry,
  rulesFound,
  scoreOf,
  tasksOf,
  type Answers,
  type Moment,
} from "./flow";
import { judgeJoined, type Mark } from "./marks";
import { NotebookPage } from "./NotebookPage";
import { Robot, type RobotMood } from "./Robot";
import type { StageApi, StageCheck, StageNotice, StageProps } from "./Stage";
import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import "./bench-lesson.css";

const StageChunk = preloadable<StageProps, typeof import("./Stage")>(() => import("./Stage"));

const warmed = new Set<string>();
/** Starts loading the bench: the stage chunk, the 3D chunk (and its textures when idle), the lab and the simulator. */
function warmBench(labId: string): void {
  if (warmed.has(labId)) return;
  warmed.add(labId);
  void StageChunk.preload().catch(() => undefined);
  void BenchSurfaceChunk.preload()
    .then((mod) => whenIdle(mod.prepare))
    .catch(() => undefined);
  void loadLab(labId).catch(() => undefined);
  warmSimulator();
}

type Phase = "guess" | "act" | "done";

/**
 * The parts in play for a moment: the beat's or the secret's own `spot`, or the part a meet, tap or pick is about (the
 * whole part, so the spotlight never gives away which leg is right). Null frames the whole bench.
 */
function spotOf(mo: Moment): string[] | null {
  const b = mo.beat;
  if (mo.spot) return mo.spot;
  if (mo.part) return [mo.part];
  // The part a leg (D1.anode) or a mark (part:M1/dial) belongs to.
  const partOf = (a: string) => a.replace(/^(pin|part):/, "").split(/[./]/)[0]!;
  if (b?.tap?.answer !== undefined) {
    const all = [...(Array.isArray(b.tap.answer) ? b.tap.answer : [b.tap.answer]), ...(b.tap.among ?? [])];
    return [...new Set(all.filter((a) => !/^(hole:|[a-j]\d|rail|top)/.test(a)).map(partOf))];
  }
  if (b?.pick?.on) return [partOf(b.pick.on)];
  // A pop-up card leaves the whole bench in view: what it changes shows somewhere else (the LED).
  return null;
}
/** The bench steps a right check applies (`then`), as the lab's solution steps. */
const stepsOf = (mo: Moment): SolutionStep[] => (mo.beat?.then ?? []) as SolutionStep[];
/** The notebook boxes a lab task asks for (a number read off the bench, judged by the task's goal). */
const notesOf = (note: NoteSpec | NoteSpec[] | undefined): NoteSpec[] => (note ? (Array.isArray(note) ? note : [note]) : []);

type Line = { text: string; mood: RobotMood; key: number };

const INTERACTIVE = "input, textarea, select, button, a[href], [role=radio], [role=button], [role=application], [contenteditable=true], summary";
let marksSeq = 1;

export function BenchLesson({ lesson, outline, parts, module, next, mapHref }: PlayerProps & { lesson: BenchLessonData }) {
  const ready = useLearnerReady(outline);
  const muted = useLearner((s) => s.learner.settings.muted);
  const friedAll = useLearner((s) => s.learner.fried);
  const hooks = useMemo(() => getIsleHooks(), []);
  const moments = useMemo(() => momentsOf(lesson), [lesson]);

  const [restored, setRestored] = useState(false);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("act");
  const [answers, setAnswers] = useState<Answers>({});
  const [marks, setMarks] = useState<Mark[]>([]);
  const [line, setLine] = useState<Line | null>(null);
  /** When the last bench warning was drawn (its note leaves a few seconds later). */
  const [notice, setNotice] = useState<number | null>(null);
  const [fried, setFried] = useState<FriedCard[]>([]);
  const [hints, setHints] = useState(0);
  const [stamp, setStamp] = useState<string | null>(null);
  const [tried, setTried] = useState<string[]>([]);
  const [xpFloat, setXpFloat] = useState<{ n: number; key: number } | null>(null);
  const [clock, setClock] = useState<{ end: number; left: number } | null>(null);
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const [warm, setWarm] = useState(false);
  const [api, setApi] = useState<StageApi | null>(null);
  const [benchReady, setBenchReady] = useState(false);
  const [benchFailed, setBenchFailed] = useState(false);
  const [notebook, setNotebook] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [isle, setIsle] = useState<IsleRevealResult>(null);
  const [view, setView] = useState<BenchViewKind>("3d");
  const [live, setLive] = useState("");
  const [numberText, setNumberText] = useState("");
  const [holeText, setHoleText] = useState("");
  /** What the learner typed into the lab task's notebook boxes (by note id), for a `do` beat whose task asks. */
  const [notebookText, setNotebookText] = useState<Record<string, string>>({});

  const moment = moments[index]!;
  const tasks = tasksOf(answers, lesson.lab);
  const rules = rulesFound(moments, index, tasks, phase === "done");
  const progress = started ? progressOf(moments, index, phase === "done") : 0;

  // Latest values for callbacks the stage holds on to.
  const state = useRef({ moment, phase, answers, index, tasks, api });
  state.current = { moment, phase, answers, index, tasks, api };
  const lineRef = useRef<HTMLParagraphElement>(null);
  const pendingSetup = useRef<string | null>(null);
  const pendingTrace = useRef<string | null>(null);
  const pendingThen = useRef<SolutionStep[]>([]);
  const pendingSkips = useRef<string[]>([]);
  const lastSecret = useRef(0);
  const prefetchedIsle = useRef(false);

  const announce = useCallback((text: string) => {
    setLive("");
    requestAnimationFrame(() => setLive(text));
  }, []);
  const say = useCallback((text: string, mood: RobotMood = "idle") => setLine({ text, mood, key: Date.now() + Math.random() }), []);
  const setAnswer = useCallback(
    (key: string, value: unknown) => setAnswers((a) => ({ ...a, [key]: typeof value === "function" ? (value as (prev: unknown) => unknown)(a[key]) : value })),
    [],
  );
  const addMark = useCallback((mk: Omit<Mark, "id"> & { id?: string }) => {
    setMarks((ms) => [...ms.filter((x) => x.id !== mk.id), { ...mk, id: mk.id ?? `m${marksSeq++}` }]);
  }, []);
  const floatXp = (n: number) => setXpFloat({ n, key: Date.now() });
  useEffect(() => {
    if (!xpFloat) return;
    const t = window.setTimeout(() => setXpFloat(null), 1400);
    return () => window.clearTimeout(t);
  }, [xpFloat]);

  // ---- The bench view: remembered per device, ink on phones by default ------------------------------------------
  useEffect(() => {
    setView(resolveView(readViewPref()));
  }, []);
  const chooseView = (v: BenchViewKind) => {
    setView(v);
    const pref: BenchViewPref = v;
    storeViewPref(pref);
  };

  // ---- Warm the bench on the first gesture or after a few seconds, never in the first load ----------------------
  useEffect(() => {
    if (warm) {
      warmBench(lesson.lab);
      return;
    }
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      setWarm(true);
    };
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", go, opts);
    window.addEventListener("pointermove", go, opts);
    window.addEventListener("keydown", go, opts);
    const timer = window.setTimeout(go, 3000);
    return () => {
      done = true;
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("pointermove", go);
      window.removeEventListener("keydown", go);
      window.clearTimeout(timer);
    };
  }, [warm, lesson.lab]);

  // ---- Moments -----------------------------------------------------------------------------------------------------
  /** Runs the loop tracer from a terminal now, or once the bench is up. */
  const runTrace = useCallback((from: string) => {
    if (state.current.api) state.current.api.trace(from);
    else pendingTrace.current = from;
  }, []);

  const enter = useCallback(
    (i: number, a: Answers = state.current.answers) => {
      const mo = moments[i]!;
      const t = tasksOf(a, lesson.lab);
      // The last beat's tracer ink goes with it.
      const last = state.current.moment;
      if (last !== mo && last.trace) state.current.api?.trace(null);
      pendingTrace.current = null;
      setIndex(i);
      setHints(0);
      setLine(null);
      setNotice(null);
      setStamp(null);
      setTried([]);
      setNumberText("");
      setHoleText("");
      setNotebookText({});
      // The last moment's notes fade to small marks; pencil rings and warnings go.
      setMarks((ms) => ms.filter((k) => k.kind !== "ring" && k.kind !== "strip" && !k.id.startsWith("notice-")).map((k) => (k.kind === "note" || k.kind === "label" ? { ...k, faded: true } : k)));
      const done = isMomentDone(mo, a, t);
      if (done) setPhase("done");
      else if (mo.beat?.guess && typeof a[answerKeys.guess(mo.key)] !== "number") setPhase("guess");
      else setPhase("act");
      if (mo.action === "meet" && mo.part) addMark({ id: `label-${mo.key}`, kind: "label", at: mo.part, text: mo.note?.text ?? mo.part, tone: "ink" });
      if (mo.beat?.tap?.joinedTo) addMark({ id: `marker-${mo.key}`, kind: "ring", at: mo.beat.tap.joinedTo, tone: "red" });
      if (mo.beat?.pick?.on) addMark({ id: `on-${mo.key}`, kind: "ring", at: mo.beat.pick.on, tone: "ink" });
      state.current.api?.calm();
      // A setup puts fresh parts on the bench: nothing is left to replace.
      if (mo.task && !done && state.current.api?.task(mo.task)?.setup?.length) setFried([]);
      if (mo.task && !done) {
        pendingSetup.current = mo.task;
        if (state.current.api) {
          state.current.api.applySetup(mo.task);
          pendingSetup.current = null;
        }
      }
      // A beat with nothing to do runs its tracer as it begins (and a finished one shows it again on resume).
      if (mo.trace && (mo.action === "next" || done)) runTrace(mo.trace);
      if ((mo.kind === "fix" || mo.kind === "end") && !prefetchedIsle.current && !useLearner.getState().learner.lessons[lesson.id]) {
        prefetchedIsle.current = true;
        hooks.prefetch();
      }
      if (mo.kind !== "fix") setClock(null);
      // A beat with nothing to do shows its discovery as it begins: the note is drawn, the rule stamped. The learner
      // reads it and taps Next.
      const lines = [mo.say];
      if (mo.action === "next" && mo.kind === "beat") {
        if (mo.note && mo.note.at !== "tap") {
          const text = noteText(mo.note.text, undefined);
          addMark({ id: `note-${mo.key}`, kind: "note", at: mo.note.at, text, tone: "blue" });
          lines.push(m.lessonBench.found(text));
        }
        if (mo.rule) {
          setStamp(mo.rule);
          lines.push(m.lessonBench.stamped(mo.rule));
        }
      }
      announce(lines.join(" "));
    },
    [moments, lesson.lab, lesson.id, addMark, announce, hooks, runTrace],
  );

  const focusLine = () => requestAnimationFrame(() => lineRef.current?.focus({ preventScroll: true }));

  const goNext = useCallback(() => {
    const { index: i, tasks: t } = state.current;
    let n = i + 1;
    // The secret's offer is skipped when the learner found it already.
    if (moments[n]?.kind === "secret" && moments[n]!.task && t.includes(moments[n]!.task!)) n++;
    if (n < moments.length) enter(n);
    focusLine();
  }, [moments, enter]);

  /** A moment is finished: show what was found, or move on by itself when there is nothing to read. */
  const complete = useCallback(
    (mo: Moment, opts: { tapped?: string; mood?: RobotMood } = {}) => {
      setPhase("done");
      // What a wrong try wrote on the bench has done its job: the discovery takes its place.
      setMarks((ms) => ms.filter((k) => !k.id.startsWith("miss-")));
      const lines: string[] = [];
      if (mo.done) {
        say(mo.done, opts.mood ?? "happy");
        lines.push(mo.done);
      } else if (mo.action === "tap" || mo.action === "pick" || mo.action === "number") {
        // A check right without a line of its own: a short "yep" replaces any nudge still showing.
        const pool = m.lessonBench.right;
        say(pool[moments.indexOf(mo) % pool.length]!, "happy");
      }
      if (mo.note && mo.action !== "meet") {
        const at = mo.note.at === "tap" ? (opts.tapped ?? "") : mo.note.at;
        const text = noteText(mo.note.text, opts.tapped);
        if (at) addMark({ id: `note-${mo.key}`, kind: "note", at, text, tone: "blue" });
        lines.push(m.lessonBench.found(text));
      }
      if (mo.rule) {
        setStamp(mo.rule);
        lines.push(m.lessonBench.stamped(mo.rule));
      }
      // A right check can change the bench (a padlock wheel turned to the digit just found).
      if (mo.beat?.then) state.current.api?.applySteps(stepsOf(mo));
      // The tracer shows the loop the learner just found (the right terminal tapped).
      if (mo.trace) runTrace(mo.trace);
      if (lines.length) announce(lines.join(" "));
      if (!hasDiscovery(mo)) window.setTimeout(() => state.current.moment === mo && goNext(), prefersReducedMotion() ? 600 : 1300);
    },
    [addMark, announce, say, goNext, moments, runTrace],
  );

  // ---- Restore and save ----------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!ready || restored) return;
    const saved = useLearner.getState().learner.inProgress[lesson.id];
    if (saved && saved.version === lesson.version && saved.step > 0 && saved.step <= moments.length) {
      const a = saved.answers;
      const at = saved.step - 1;
      const t = tasksOf(a, lesson.lab);
      setAnswers(a);
      setStarted(true);
      setWarm(true);
      // Tasks the learner skipped on the way must not hold the lab back.
      pendingSkips.current = moments.slice(0, at).flatMap((mo) => (mo.task && !t.includes(mo.task) && mo.kind !== "secret" ? [mo.task] : []));
      // What was found before shows as small marks.
      setMarks(
        moments.slice(0, at).flatMap((mo) => {
          if (!mo.note || mo.action === "meet") return [];
          const rec = checkOf(a, mo.key);
          const where = mo.note.at === "tap" ? rec?.at : mo.note.at;
          return where ? [{ id: `note-${mo.key}`, kind: "note" as const, at: where, text: noteText(mo.note.text, rec?.at), tone: "blue" as const, faded: true }] : [];
        }),
      );
      // What right checks put on the bench since the last task done comes back too (a task's checkpoint has the rest).
      let lastTask = -1;
      moments.slice(0, at).forEach((mo, k) => {
        if (mo.task && t.includes(mo.task)) lastTask = k;
      });
      pendingThen.current = moments.slice(lastTask + 1, at).flatMap((mo) => (checkOf(a, mo.key)?.done ? stepsOf(mo) : []));
      enter(at, a);
      // No toast over the bench: the bench and the robot's line show where the learner is.
      window.setTimeout(() => announce(`${m.lesson.resumed} ${moments[at]!.say}`), 0);
    }
    setRestored(true);
  }, [ready, restored, lesson.id, lesson.version, lesson.lab, moments, enter, announce]);

  // Achievements earned on the way wait for the finale's tally: nothing toasts over the bench mid-discovery.
  useEffect(() => {
    const store = useLearner.getState();
    store.holdAchievements(true);
    return () => store.holdAchievements(false);
  }, []);

  useEffect(() => {
    if (!restored || completion) return;
    if (!started && Object.keys(answers).length === 0) return;
    useLearner.getState().saveProgress(lesson.id, { step: started ? index + 1 : 0, answers, version: lesson.version });
  }, [restored, completion, started, index, answers, lesson.id, lesson.version]);

  // The stage is up: apply a setup that waited for it, and let go of skipped tasks.
  useEffect(() => {
    if (!api) return;
    if (pendingSkips.current.length) {
      api.skip(pendingSkips.current);
      pendingSkips.current = [];
    }
    if (pendingThen.current.length) {
      api.applySteps(pendingThen.current);
      pendingThen.current = [];
    }
    if (pendingSetup.current) {
      api.applySetup(pendingSetup.current);
      pendingSetup.current = null;
    }
    if (pendingTrace.current) {
      api.trace(pendingTrace.current);
      pendingTrace.current = null;
    }
  }, [api]);

  // ---- Bench events -----------------------------------------------------------------------------------------------
  const onTaskDone = useCallback(
    (id: string) => {
      setAnswer(answerKeys.tasks(lesson.lab), (prev: unknown) => [...new Set([...(Array.isArray(prev) ? (prev as string[]) : []), id])]);
      const { moment: mo, phase: ph } = state.current;
      if (id === mo.task && ph !== "done") {
        floatXp(XP.task);
        // Without a line of its own, the robot says the lab task's success line while the lesson moves on.
        const success = state.current.api?.task(id)?.success;
        if (!mo.done && success) say(success, "happy");
        if (mo.kind === "secret") lastSecret.current = Date.now();
        complete(mo, { mood: "happy" });
        if (mo.kind === "fix" && mo.fix && mo.fix.index === mo.fix.count - 1) {
          const c = clockRef.current;
          if (c && c.left > 0) setAnswer(answerKeys.clock, c.left);
          setClock(null);
        }
        return;
      }
      const s = lesson.secret;
      if (s && id === s.task) {
        // Found by experimenting, mid-lesson: the secret's discovery, without leaving the current beat.
        lastSecret.current = Date.now();
        floatXp(XP.task);
        say(s.done ?? m.lessonBench.secret, "happy");
        if (s.note) addMark({ id: "note-secret", kind: "note", at: s.note.at === "tap" ? "" : s.note.at, text: s.note.text, tone: "blue" });
        if (s.rule) setStamp(s.rule);
        announce([m.lessonBench.secret, s.done, s.rule && m.lessonBench.stamped(s.rule)].filter(Boolean).join(". "));
      }
    },
    [lesson.lab, lesson.secret, setAnswer, complete, say, addMark, announce],
  );

  const onFried = useCallback(
    (card: FriedCard) => {
      setFried((f) => [...f.filter((c) => c.partId !== card.partId), card]);
      // The secret's own line stays (a fry for science), but the robot looks sorry for the part either way.
      if (Date.now() - lastSecret.current > 600 && state.current.moment.kind !== "secret") say(state.current.api?.lab.mascot?.fried ?? m.lessonBench.friedLine, "sad");
      else setLine((l) => (l ? { ...l, mood: "sad" } : l));
      announce(m.lab.fried.title(card.shownLabel));
    },
    [say, announce],
  );

  const onNudge = useCallback(
    (text: string) => {
      if (state.current.phase === "act") say(text, "thinking");
    },
    [say],
  );

  /**
   * A bench warning (a short, a part running hot) is never printed in the margin. Known ones write a short note in red
   * pencil on the part that raised it and the robot says a kind line; in a fix-it round they say nothing at all (the
   * warning would name the fault the learner is there to find).
   */
  const onNotice = useCallback(
    (n: StageNotice) => {
      const { moment: mo, phase: ph } = state.current;
      if (mo.kind === "fix") return;
      const spec = m.lessonBench.notices[n.type === "shorted" ? "shorted" : (n.cause ?? "")] ?? m.lessonBench.notices["other"]!;
      const id = `notice-${n.partId}`;
      setMarks((ms) => {
        // The discovery of the moment wins when it is already written on that part.
        const taken = ms.some((k) => k.kind === "note" && !k.faded && !k.id.startsWith("notice-") && k.at.replace(/^(pin|part):/, "").split(/[./]/)[0] === n.partId);
        return taken ? ms : [...ms.filter((k) => k.id !== id), { id, kind: "note", at: n.partId, text: spec.note, tone: "red" }];
      });
      setNotice(Date.now());
      // The beat's own result line (and a secret just found) keeps the margin; otherwise the robot says it kindly.
      if (ph === "act" && Date.now() - lastSecret.current > 1500) say(spec.line, "thinking");
      announce(spec.line);
    },
    [say, announce],
  );
  // The note has had its moment after a few seconds: the bench shows the rest.
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => {
      setMarks((ms) => ms.filter((k) => !k.id.startsWith("notice-")));
      setNotice(null);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // ---- Checks --------------------------------------------------------------------------------------------------------
  const onTap = useCallback(
    (anchor: string) => {
      const { moment: mo, phase: ph, answers: a, api: st } = state.current;
      if (mo.action === "meet") {
        if (ph === "act") {
          if (mo.part) addMark({ id: `tick-${mo.key}`, kind: "tick", at: mo.part, tone: "blue" });
          complete(mo);
        }
        return;
      }
      const tap = mo.beat?.tap;
      if (!tap || ph !== "act" || !st) return;
      const key = answerKeys.check(mo.key);
      const prev = checkOf(a, mo.key);
      const where = anchor.replace(/^hole:/, "");
      if (tap.anyHole) {
        if (!anchor.startsWith("hole:")) return;
        setAnswer(key, recordTry(prev, true, where));
        if (mo.beat?.xray) addMark({ id: `strip-${mo.key}`, kind: "strip", at: anchor, tone: "blue" });
        complete(mo, { tapped: anchor });
        return;
      }
      if (tap.joinedTo) {
        if (!anchor.startsWith("hole:")) return;
        const bench = st.runtime.store.getState().bench;
        const target = st.holeFor(tap.joinedTo.replace(/^rail\+:/, "+").replace(/^rail-:/, "-")) ?? tap.joinedTo;
        const verdict = judgeJoined(bench, target, where);
        if (verdict === "self") {
          say(m.lessonBench.holes["self"] ?? "", "thinking");
          return;
        }
        const right = verdict === "right";
        setAnswer(key, recordTry(prev, right, where));
        if (right) {
          if (!prev) floatXp(XP.firstTry);
          addMark({ id: `strip-${mo.key}`, kind: "strip", at: `hole:${target}`, tone: "blue" });
          addMark({ id: `tick-${mo.key}`, kind: "tick", at: anchor, tone: "blue" });
          complete(mo, { tapped: anchor });
        } else {
          // Not marked wrong: the bench shows where the tapped hole's own strip runs.
          addMark({ id: `miss-strip-${mo.key}`, kind: "strip", at: anchor, tone: "ink" });
          say(m.lessonBench.holes[verdict] ?? m.lessonBench.wrongTap, "thinking");
        }
        return;
      }
      const answersList = Array.isArray(tap.answer) ? tap.answer : tap.answer ? [tap.answer] : [];
      const right = answersList.includes(anchor);
      setAnswer(key, recordTry(prev, right, anchor));
      if (right) {
        if (!prev) floatXp(XP.firstTry);
        addMark({ id: `tick-${mo.key}`, kind: "tick", at: anchor, tone: "blue" });
        complete(mo, { tapped: anchor });
      } else {
        // Not marked wrong: the tapped thing shows its own name (the three-period lesson's second period).
        addMark({ id: `miss-${anchor}`, kind: "label", at: anchor, text: st.nameOf(anchor), tone: "ink" });
        say(mo.beat?.wrong?.[anchor] ?? mo.beat?.hint ?? m.lessonBench.wrongTap, "thinking");
      }
    },
    [addMark, complete, say, setAnswer],
  );

  const onPick = (i: number) => {
    const mo = moment;
    const pick = mo.beat?.pick;
    if (!pick || phase !== "act") return;
    const option = pick.options[i]!;
    const right = pick.answer === undefined || pick.answer === option;
    const prev = checkOf(answers, mo.key);
    setAnswer(answerKeys.check(mo.key), recordTry(prev, right, option));
    if (right) {
      if (!prev && pick.answer !== undefined) floatXp(XP.firstTry);
      if (pick.on) addMark({ id: `tick-${mo.key}`, kind: "tick", at: pick.on, tone: "blue" });
      complete(mo);
    } else {
      setTried((t) => [...t, option]);
      say(mo.beat?.wrong?.[option] ?? mo.beat?.hint ?? m.lessonBench.wrongPick, "thinking");
    }
  };

  const onNumber = () => {
    const mo = moment;
    const spec = mo.beat?.number;
    if (!spec || phase !== "act") return;
    let right: boolean;
    if (spec.unit) {
      const g = gradeNumeric(numberText, { answer: spec.answer, unit: spec.unit, tolerance: spec.tolerance });
      if (g.status === "invalid") return say(m.lessonBench.number.invalid, "thinking");
      right = g.status === "correct";
    } else {
      const v = Number(numberText.replace(",", "."));
      if (!Number.isFinite(v) || numberText.trim() === "") return say(m.lessonBench.number.invalid, "thinking");
      right = Math.abs(v - spec.answer) <= (Math.abs(spec.answer) * spec.tolerance) / 100 + 1e-9;
    }
    const prev = checkOf(answers, mo.key);
    setAnswer(answerKeys.check(mo.key), recordTry(prev, right, numberText));
    if (right) {
      if (!prev) floatXp(XP.firstTry);
      complete(mo);
    } else say(mo.beat?.hint ?? m.lessonBench.number.wrong, "thinking");
  };

  /**
   * A number for the lab notebook (a `do` beat whose task declares `note`): it goes to the lab, whose goal judges it
   * against the bench. If the task is still open a moment later, the robot nudges.
   */
  const onNote = (spec: NoteSpec) => {
    const mo = moment;
    if (!api || !mo.task || phase !== "act") return;
    if (api.runtime.setNote(spec.id, notebookText[spec.id] ?? "") === null) return say(m.lessonBench.number.invalid, "thinking");
    // A task with several boxes is only judged once every box has a value: no nudge for a right first number.
    const all = notesOf(api.task(mo.task)?.note);
    if (all.some((n) => n.id !== spec.id && !(notebookText[n.id] ?? "").trim())) return;
    window.setTimeout(() => {
      const cur = state.current;
      if (cur.moment === mo && cur.phase === "act" && !cur.tasks.includes(mo.task!)) say(m.lessonBench.number.wrong, "thinking");
    }, 900);
  };

  const onGuess = (i: number | null) => {
    if (i !== null) setAnswer(answerKeys.guess(moment.key), i);
    setPhase("act");
  };

  const hintLines = (): string[] => {
    if (moment.task) return api?.task(moment.task)?.hints ?? [];
    return moment.beat?.hint ? [moment.beat.hint] : [];
  };
  const onHint = () => {
    const list = hintLines();
    if (!list.length) return;
    const n = Math.min(list.length, hints + 1);
    setHints(n);
    say(list[n - 1]!, "thinking");
  };
  const hintHighlight = moment.task && hints > 0 ? api?.task(moment.task)?.highlight : undefined;

  const skipTask = () => {
    if (moment.task) api?.skip([moment.task]);
    goNext();
  };

  // ---- The fix-it clock (only if the learner asks for it) ---------------------------------------------------------
  useEffect(() => {
    if (!clock) return;
    const t = window.setInterval(() => {
      setClock((c) => {
        if (!c) return c;
        const left = Math.max(0, Math.round((c.end - Date.now()) / 1000));
        if (left === 0 && c.left > 0) say(m.lessonBench.fixit.timeUp, "thinking");
        return left === c.left ? c : { ...c, left };
      });
    }, 250);
    return () => window.clearInterval(t);
  }, [clock !== null, say]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Finish ----------------------------------------------------------------------------------------------------------
  const finish = async () => {
    if (finishing) return;
    if (!muted) hooks.prime();
    setFinishing(true);
    await useLearner.getState().init(outline);
    const score = scoreOf(lesson, moments, answers);
    const result = useLearner.getState().completeLesson({ lessonId: lesson.id, version: lesson.version, ...score });
    await flushSaves();
    if (!result.replay) setIsle(await revealWithin(hooks, { before: result.before, after: result.after, outline, muted }));
    setCompletion(result);
    setFinishing(false);
  };

  // Enter runs the one primary action when focus is not in a control (or on the bench).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body && t.closest(INTERACTIVE)) return;
      const primary = document.querySelector<HTMLButtonElement | HTMLAnchorElement>("[data-primary]");
      if (primary && !(primary as HTMLButtonElement).disabled) {
        e.preventDefault();
        primary.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- What the bench shows ----------------------------------------------------------------------------------------
  const gate = started && phase === "act" && moment.task && !tasks.includes(moment.task) ? moment.task : null;
  const tap = moment.beat?.tap;
  const check: StageCheck =
    !started || phase !== "act"
      ? null
      : moment.action === "meet" && moment.part
        ? { kind: "meet", part: moment.part }
        : tap?.answer !== undefined
          ? { kind: "targets", targets: tap.among ?? (Array.isArray(tap.answer) ? tap.answer : [tap.answer]) }
          : tap
            ? { kind: "holes" }
            : null;
  const readOnly = !started || phase === "guess" || check?.kind === "targets";
  const spot = started ? spotOf(moment) : null;
  // A hole check brings the marked hole's corner of the board close, without veiling the holes around it.
  const frame = started && moment.beat?.tap?.joinedTo ? [moment.beat.tap.joinedTo] : null;
  const popup = started && phase === "act" && moment.action === "popup" ? (moment.beat?.popup ?? null) : null;
  // The beat's tool. A tool new to this beat waits for its guess (it could give the answer away); one the beat before
  // named too stays docked through it, so it never closes and opens again between two beats that both use it.
  const kept = !!moment.tool && moments[index - 1]?.tool === moment.tool;
  const tool = started && (phase !== "guess" || kept) ? (moment.tool ?? null) : null;
  const friedHere = friedAll.filter((f) => f.lessonId === lesson.id).map((f) => f.label);
  const fixedCount = moments.filter((mo) => mo.kind === "fix" && mo.task && tasks.includes(mo.task)).length;

  if (completion) {
    return (
      <BenchFinale
        lesson={lesson}
        completion={completion}
        parts={parts}
        module={module}
        next={next}
        mapHref={mapHref}
        isle={isle}
        firstTry={scoreOf(lesson, moments, answers).firstTry}
        items={scoreOf(lesson, moments, answers).items}
        page={<NotebookPage lesson={lesson} moments={moments} answers={answers} reached={moments.length} rules={rulesFound(moments, moments.length, tasks, true)} fried={friedHere} fixed={fixedCount} signed />}
      />
    );
  }

  // ---- The margin --------------------------------------------------------------------------------------------------
  const shownLine = !started ? lesson.start.say : (line?.text ?? moment.say);
  const mood: RobotMood = !started ? "idle" : (line?.mood ?? (phase === "done" ? "happy" : "idle"));
  const guess = moment.beat?.guess;
  const guessPicked = typeof answers[answerKeys.guess(moment.key)] === "number" ? guess?.options[answers[answerKeys.guess(moment.key)] as number] : undefined;
  const hintsLeft = hintLines().length > hints;
  const canShow = !!moment.task && hints >= hintLines().length && hintLines().length > 0 && !!api?.runtime.canShow(moment.task);

  let action: ReactNode = null;
  if (!started) {
    action = (
      <button type="button" className="btn btn--primary btn--large bl-go" data-primary onClick={() => { setStarted(true); setWarm(true); enter(0); focusLine(); }}>
        {lesson.start.go ?? m.lessonBench.start}
        <Icon name="arrow-right" size={20} />
      </button>
    );
  } else if (phase === "guess" && guess) {
    action = (
      <>
        <div className="bl-chips" role="group" aria-label={m.lessonBench.guessLabel}>
          {guess.options.map((o, i) => (
            <button key={o} type="button" className="bl-chip" data-guess={i} onClick={() => onGuess(i)}>
              {o}
            </button>
          ))}
        </div>
        <button type="button" className="bl-link" onClick={() => onGuess(null)}>
          {m.lessonBench.skipGuess}
        </button>
      </>
    );
  } else if (phase === "done") {
    action =
      moment.kind === "end" ? null : hasDiscovery(moment) ? (
        <button type="button" className="btn btn--primary bl-next" data-primary onClick={goNext}>
          {m.lessonBench.next}
          <Icon name="arrow-right" size={18} />
        </button>
      ) : null;
  } else if (moment.action === "finish") {
    action = (
      <button type="button" className="btn btn--primary btn--large bl-go" data-primary onClick={finish} aria-busy={finishing || undefined} disabled={finishing}>
        {finishing ? m.lessonBench.finishing : m.lessonBench.finish}
        <Icon name="check" size={20} />
      </button>
    );
  } else if (moment.action === "next") {
    action = (
      <button type="button" className="btn btn--primary bl-next" data-primary onClick={goNext}>
        {m.lessonBench.next}
        <Icon name="arrow-right" size={18} />
      </button>
    );
  } else if (moment.action === "pick" && moment.beat?.pick) {
    action = (
      <div className="bl-chips" role="group" aria-label={moment.say}>
        {moment.beat.pick.options.map((o, i) => (
          <button key={o} type="button" className="bl-chip" data-pick={i} disabled={tried.includes(o)} data-tried={tried.includes(o) || undefined} onClick={() => onPick(i)}>
            {o}
          </button>
        ))}
      </div>
    );
  } else if (moment.action === "number" && moment.beat?.number) {
    const unit = moment.beat.number.unit;
    action = (
      <form className="bl-number" onSubmit={(e) => { e.preventDefault(); onNumber(); }}>
        <label className="sr-only" htmlFor="bl-number">{m.lessonBench.number.field}</label>
        <input id="bl-number" className="bl-number__input" inputMode="decimal" autoComplete="off" value={numberText} onChange={(e) => setNumberText(e.target.value)} />
        {unit && <span className="bl-number__unit">{unit}</span>}
        <button type="submit" className="btn btn--primary" data-primary disabled={!numberText.trim()}>
          {m.lessonBench.number.check}
        </button>
      </form>
    );
  } else if (moment.action === "tap" && tap && tap.answer === undefined) {
    // Hole taps: the keyboard path is a hole's name.
    action = (
      <form
        className="bl-number bl-number--quiet"
        onSubmit={(e) => {
          e.preventDefault();
          const h = api?.holeFor(holeText);
          if (h) onTap(`hole:${h}`);
          else say(m.lessonBench.holes["unknown"] ?? "", "thinking");
        }}
      >
        <label className="bl-number__label" htmlFor="bl-hole">{m.lessonBench.holes.field}</label>
        <input id="bl-hole" className="bl-number__input bl-number__input--short" autoComplete="off" placeholder={m.lessonBench.holes.placeholder} value={holeText} onChange={(e) => setHoleText(e.target.value)} />
        <button type="submit" className="btn btn--small btn--tertiary" disabled={!holeText.trim()}>
          {m.lessonBench.holes.go}
        </button>
      </form>
    );
  } else if (moment.action === "task" || moment.action === "meet") {
    action = (
      <div className="bl-help">
        {hintsLeft && (
          <button type="button" className="bl-link" onClick={onHint}>
            <Icon name="hint" size={18} />
            {m.lessonBench.hint}
          </button>
        )}
        {canShow && (
          <button type="button" className="bl-link" onClick={() => moment.task && api?.showMe(moment.task)}>
            <Icon name="play" size={18} />
            {m.lessonBench.showMe}
          </button>
        )}
        {moment.kind === "secret" && (
          <button type="button" className="bl-link" onClick={goNext}>
            {m.lessonBench.skip}
          </button>
        )}
        {moment.action === "meet" && (
          <button type="button" className="bl-link" onClick={() => onTap(moment.part ?? "")}>
            {m.lessonBench.next}
          </button>
        )}
        {benchFailed && moment.kind !== "secret" && (
          <button type="button" className="bl-link" onClick={skipTask}>
            {m.lessonBench.skipTask}
          </button>
        )}
      </div>
    );
  }

  // A `do` beat whose lab task asks for a number read off the bench: one box per note, above the help links.
  const noteBoxes =
    started && phase === "act" && moment.task
      ? notesOf(api?.task(moment.task)?.note).map((spec, _i, boxes) => {
          const text = notebookText[spec.id] ?? "";
          const field = `bl-note-${spec.id}`;
          return (
            <form key={spec.id} className="bl-number bl-number--note" data-note={spec.id} onSubmit={(e) => { e.preventDefault(); onNote(spec); }}>
              <label className="bl-number__label" htmlFor={field}>{spec.label}</label>
              <input id={field} className="bl-number__input" inputMode="decimal" autoComplete="off" value={text} onChange={(e) => setNotebookText((t) => ({ ...t, [spec.id]: e.target.value }))} />
              {spec.unit && <span className="bl-number__unit">{spec.unit}</span>}
              <button type="submit" className="btn btn--primary" data-primary={boxes.length === 1 ? "" : undefined} disabled={!text.trim()}>
                {m.lessonBench.number.check}
              </button>
            </form>
          );
        })
      : null;

  const fix = moment.fix;
  // The current objective's name, as a quiet kicker: one thing at a time, never the whole list.
  const objective = moment.kind === "beat" ? moments.slice(0, index + 1).reverse().find((mo) => mo.beat?.objective)?.beat?.objective : undefined;
  const stepsDone = Math.min(moments.length, index + 1);

  return (
    <div
      className="bl"
      data-started={started || undefined}
      data-phase={started ? phase : "start"}
      data-moment={started ? moment.key : "start"}
      data-action={started ? moment.action : "start"}
      data-tasks={tasks.join(" ")}
      data-view={view}
    >
      <header className="bl-bar">
        <IconButton label={m.lesson.close} icon="close" href={mapHref} />
        <p className="bl-bar__title">{lesson.title}</p>
        <div className="bl-bar__tools">
          <div className="bl-views" role="radiogroup" aria-label={m.lessonBench.view}>
            {(["3d", "ink"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                className="bl-views__opt"
                title={v === "ink" && !INK_RENDERER ? m.lessonBench.viewInkStandIn : undefined}
                onClick={() => chooseView(v)}
              >
                {v === "3d" ? m.lessonBench.view3d : m.lessonBench.viewInk}
              </button>
            ))}
          </div>
          <button type="button" className="bl-nb-btn" aria-haspopup="dialog" aria-label={m.lessonBench.notebookOpen(rules.length)} onClick={() => setNotebook(true)} data-notebook-button>
            <Icon name="book" size={20} />
            <span className="bl-nb-btn__text">{m.lessonBench.notebook}</span>
            {rules.length > 0 && (
              <span className="bl-nb-btn__n" key={rules.length}>
                {rules.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main id="main" className="bl-main">
        <aside className="bl-margin" aria-label={m.lessonBench.marginLabel}>
          <div className="bl-margin__top">
            <div className="bl-margin__robot">
              <Robot lit={progress} mood={mood} label={m.lessonBench.robot(progress)} />
              {xpFloat && (
                <span className="bl-xp" key={xpFloat.key} aria-hidden="true">
                  {m.lessonBench.xp(xpFloat.n)}
                </span>
              )}
            </div>
            {started && (
              <p className="bl-steps" aria-label={m.lessonBench.progressLabel(stepsDone, moments.length)}>
                {m.lessonBench.progress(stepsDone, moments.length)}
              </p>
            )}
          </div>
          <div className="bl-margin__body">
            {!started && lesson.start.title && (
              <hgroup className="bl-mission">
                <p className="bl-kicker bl-kicker--red">{m.lessonBench.mission}</p>
                <h1 className="bl-mission__title">{lesson.start.title}</h1>
              </hgroup>
            )}
            {started && (fix || moment.kind === "secret" || objective) && (
              <p className="bl-kicker bl-kicker--red" key={`k-${fix ? "fix" : moment.kind === "secret" ? "secret" : objective}`}>
                {fix ? `${m.lessonBench.fixit.kicker} · ${m.lessonBench.fixit.of(fix.index + 1, fix.count)}` : moment.kind === "secret" ? m.lessonBench.secretKicker : objective}
              </p>
            )}
            <p className="bl-line" ref={lineRef} tabIndex={-1} data-step-heading key={`${moment.key}-${line?.key ?? 0}-${started}`}>
              {shownLine}
            </p>
            {guessPicked !== undefined && (
              <p className="bl-guess">
                <span className="bl-guess__k">{m.lessonBench.guessLabel}</span> <span className="bl-hand bl-hand--blue">{guessPicked}</span>
                {phase === "done" && guess?.answer !== undefined && (
                  <span className="bl-guess__verdict">{guess.answer === guessPicked ? m.lessonBench.called : m.lessonBench.missed}</span>
                )}
              </p>
            )}
            {fix && phase === "act" && fix.index === 0 && (
              <button type="button" className="bl-clock" aria-pressed={!!clock} onClick={() => setClock((c) => (c ? null : { end: Date.now() + fix.timer * 1000, left: fix.timer }))}>
                <Icon name="clock" size={18} />
                {clock ? m.lessonBench.fixit.raceOn : m.lessonBench.fixit.race}
              </button>
            )}
            {clock && (
              <p className="bl-clock__left" role="timer" aria-live="off">
                {m.lessonBench.fixit.left(clock.left)}
              </p>
            )}
            <div className="bl-act">
              {noteBoxes}
              {action}
            </div>
            {fried.length > 0 && (
              <div className="bl-fried">
                {fried.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="btn btn--secondary btn--small"
                    data-replace
                    onClick={() => {
                      api?.replace(c);
                      setFried((f) => f.filter((x) => x.key !== c.key));
                    }}
                  >
                    <Icon name="retry" size={16} />
                    {c.kind === "meter-fuse" ? m.lab.meter.replaceFuse : m.lessonBench.replace}
                  </button>
                ))}
                <span className="bl-fried__hall">{m.lessonBench.hall}</span>
              </div>
            )}
          </div>
          <div className="bl-margin__foot">
            {stamp && (
              <p className="bl-stamped" key={stamp}>
                <span className="bl-stamp" aria-hidden="true">
                  <span>{m.lessonBench.ruleWord}</span>
                  <b>{rules.length}</b>
                </span>
                <span className="bl-stamped__text">{stamp}</span>
              </p>
            )}
            <button type="button" className="bl-keyboard-btn" aria-expanded={keyboard} onClick={() => setKeyboard((k) => !k)}>
              {m.lessonBench.keyboard}
            </button>
          </div>
        </aside>

        <section className="bl-bench" aria-label={m.lessonBench.benchLabel}>
          {warm && restored ? (
            <StageChunk.Component
              labId={lesson.lab}
              lessonId={lesson.id}
              view={view}
              done={tasks}
              gate={gate}
              secret={lesson.secret?.task ?? null}
              readOnly={readOnly}
              trayOpen={!!gate}
              spot={spot}
              frame={frame}
              xray={started && !!moment.beat?.xray}
              hintHighlight={hintHighlight}
              marks={marks}
              check={check}
              popup={popup}
              tool={tool}
              code={started ? { key: moment.key, ...moment.code } : null}
              keyboardOpen={keyboard}
              onApi={setApi}
              onBenchReady={() => setBenchReady(true)}
              onBenchFailed={() => setBenchFailed(true)}
              onTaskDone={onTaskDone}
              onFried={onFried}
              onNudge={onNudge}
              onNotice={onNotice}
              onTap={onTap}
              onPopupDone={() => {
                const mo = state.current.moment;
                if (mo.action === "popup") complete(mo);
              }}
            />
          ) : (
            <div className="bl-skeleton" role="status" aria-label={m.lessonBench.loading}>
              <span className="bl-skeleton__line" aria-hidden="true" />
            </div>
          )}
          {!benchReady && started && <span className="sr-only">{m.lessonBench.loading}</span>}
        </section>
      </main>

      <Dialog open={notebook} onClose={() => setNotebook(false)} title={m.lessonBench.notebook} variant="sheet" className="bl-notebook">
        <NotebookPage lesson={lesson} moments={moments} answers={answers} reached={index + (phase === "done" ? 1 : 0)} rules={rules} fried={friedHere} fixed={fixedCount} />
      </Dialog>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </div>
    </div>
  );
}
