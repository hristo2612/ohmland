/**
 * The isle playground: any size of isle, day or night, and the reveal of one more lesson or module.
 * Query parameters (also set by the controls): l, m, u, seed, time (auto | day | dusk | night), q (high | low),
 * rm (1: reduced motion), muted (0: sound on), bare (1: no controls, for screenshots), zoom (2: twice as close),
 * only (a unit id: just that unit's island, l lessons and m modules of it, for looking at its landmarks).
 * /robot.html shows the robot on its own (?night=1 with its lights on).
 */
import { LANDMARKS_BY_UNIT, PIECES, madeUp, makeIsle, mountIsle, planHash, type IsleEvent, type IsleView } from "../src/index";

type State = { l: number; m: number; u: number; seed: number; time: string; q: "high" | "low"; rm: boolean; muted: boolean };

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) || 0 : d);
const state: State = {
  l: num("l", 20),
  m: num("m", 6),
  u: Math.max(1, Math.min(5, num("u", 1))),
  seed: num("seed", 7) || 7,
  time: q.get("time") ?? "day",
  q: q.get("q") === "low" ? "low" : "high",
  rm: q.get("rm") === "1",
  muted: q.get("muted") !== "0",
};
if (q.get("bare") === "1") document.body.classList.add("bare");

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const host = $("isle");
const label = $("label");
const card = $("card");
const statsEl = $("stats");
const inputs = {
  lessons: $<HTMLInputElement>("lessons"),
  modules: $<HTMLInputElement>("modules"),
  units: $<HTMLInputElement>("units"),
  seed: $<HTMLInputElement>("seed"),
  time: $<HTMLSelectElement>("time"),
  unit: $<HTMLSelectElement>("unit"),
  quality: $<HTMLSelectElement>("quality"),
  reduced: $<HTMLInputElement>("reduced"),
  muted: $<HTMLInputElement>("muted"),
};
inputs.lessons.value = String(state.l);
inputs.modules.value = String(state.m);
inputs.units.value = String(state.u);
inputs.seed.value = String(state.seed);
inputs.time.value = state.time;
inputs.quality.value = state.q;
inputs.reduced.checked = state.rm;
inputs.muted.checked = state.muted;

const timeOf = (t: string): Date | undefined => {
  const d = new Date();
  if (t === "day") d.setHours(13, 0, 0, 0);
  else if (t === "dusk") d.setHours(19, 30, 0, 0);
  else if (t === "night") d.setHours(23, 0, 0, 0);
  else return undefined;
  return d;
};

let events: IsleEvent[] = [];
let view: IsleView | null = null;
let busy = false;

declare global {
  interface Window {
    __isle?: { view: IsleView; ready: boolean; hash: string; events: number; reveal(kind: "lesson" | "module"): Promise<unknown> };
  }
}

function syncUrl(): void {
  const p = new URLSearchParams({ l: String(state.l), m: String(state.m), u: String(state.u), seed: String(state.seed), time: state.time, q: state.q });
  if (state.rm) p.set("rm", "1");
  if (!state.muted) p.set("muted", "0");
  if (document.body.classList.contains("bare")) p.set("bare", "1");
  history.replaceState(null, "", `?${p}`);
}

async function rebuild(): Promise<void> {
  view?.dispose();
  view = null;
  const only = q.get("only");
  events = only ? madeUp(state.l * 5, state.m * 5, 5).filter((e) => e.unit === only).slice(0, state.l + state.m) : madeUp(state.l, state.m, state.u);
  const plan = makeIsle(state.seed, events);
  const time = timeOf(state.time);
  view = await mountIsle(host, plan, {
    interactive: true,
    quality: state.q,
    muted: state.muted,
    reducedMotion: state.rm,
    ...(time ? { time } : {}),
    onPick: (lb) => {
      if (!lb) {
        label.hidden = true;
        return;
      }
      label.hidden = false;
      label.innerHTML = "";
      const t = document.createElement("strong");
      t.textContent = lb.title;
      const d = document.createElement("span");
      d.textContent = lb.detail;
      label.append(t, d);
      label.style.left = `${lb.x}px`;
      label.style.top = `${lb.y}px`;
    },
  });
  const zoom = Number(q.get("zoom"));
  if (zoom) view.setZoom(zoom);
  window.__isle = { view, ready: false, hash: planHash(plan), events: events.length, reveal: add };
  // ready once the first frames are drawn
  requestAnimationFrame(() => requestAnimationFrame(() => window.__isle && (window.__isle.ready = true)));
  syncUrl();
}

/** Appends one lesson or module to the chosen unit and plays its reveal. */
async function add(kind: "lesson" | "module"): Promise<unknown> {
  if (!view || busy) return null;
  busy = true;
  const unit = inputs.unit.value;
  const inUnit = events.filter((e) => e.unit === unit);
  const n = inUnit.filter((e) => e.type === kind).length;
  const before = events.length - 1;
  if (kind === "lesson") {
    const pieces = PIECES.filter((p) => !["moss", "tuft"].includes(p));
    events.push({ type: "lesson", unit, piece: pieces[(n * 7 + 3) % pieces.length]!, title: `Lesson ${events.length + 1}`, id: `${unit}-x${n + 1}` });
    state.l++;
  } else {
    const marks = LANDMARKS_BY_UNIT[unit as keyof typeof LANDMARKS_BY_UNIT] ?? LANDMARKS_BY_UNIT.basics;
    events.push({ type: "module", unit, landmark: marks[n % marks.length]!, title: `Module ${n + 1}`, id: `${unit}-mx${n + 1}` });
    state.m++;
  }
  inputs.lessons.value = String(state.l);
  inputs.modules.value = String(state.m);
  const plan = makeIsle(state.seed, events);
  view.update(plan, before);
  card.hidden = true;
  const info = await view.reveal(before, events.length - 1);
  card.innerHTML = "";
  const k = document.createElement("small");
  k.textContent = info.big ? "Module finished" : "New on your isle";
  const h = document.createElement("h2");
  h.textContent = info.title;
  const ul = document.createElement("ul");
  for (const line of info.lines) {
    const li = document.createElement("li");
    li.textContent = line;
    ul.append(li);
  }
  card.append(k, h, ul);
  card.hidden = false;
  window.setTimeout(() => (card.hidden = true), 4000);
  if (window.__isle) {
    window.__isle.hash = planHash(plan);
    window.__isle.events = events.length;
  }
  busy = false;
  return info;
}

$("apply").addEventListener("click", () => {
  state.l = Math.max(0, Number(inputs.lessons.value) || 0);
  state.m = Math.max(0, Number(inputs.modules.value) || 0);
  state.u = Math.max(1, Math.min(5, Number(inputs.units.value) || 1));
  state.seed = Number(inputs.seed.value) || 7;
  void rebuild();
});
$("addLesson").addEventListener("click", () => void add("lesson"));
$("addModule").addEventListener("click", () => void add("module"));
inputs.time.addEventListener("change", () => {
  state.time = inputs.time.value;
  view?.setTime(timeOf(state.time) ?? new Date());
  syncUrl();
});
inputs.quality.addEventListener("change", () => {
  state.q = inputs.quality.value === "low" ? "low" : "high";
  void rebuild();
});
inputs.reduced.addEventListener("change", () => {
  state.rm = inputs.reduced.checked;
  void rebuild();
});
inputs.muted.addEventListener("change", () => {
  state.muted = inputs.muted.checked;
  view?.setMuted(state.muted);
  syncUrl();
});
$("toggle").addEventListener("click", () => $("panel").classList.toggle("closed"));
if (matchMedia("(max-width: 600px)").matches) $("panel").classList.add("closed");

setInterval(() => {
  if (!view) return;
  const s = view.stats();
  statsEl.textContent = `${s.fps.toFixed(0)} fps  ${s.frameMs.toFixed(1)} ms\n${s.calls} draw calls  ${(s.triangles / 1000).toFixed(1)}k tris\n${s.instances} instances in ${s.pools} pools\ndpr ${s.dpr}`;
}, 500);

void rebuild();
