// Props shared by every bench renderer (the 3D bench and the 2D ink bench). Types only: no React runtime, no three.js.

import type { CSSProperties } from "react";
import type { Snapshot } from "@ohmland/sim";
import type { BenchLabels } from "../labels";
import type { BenchStore } from "../store";
import type { BenchAction, BenchState, Quality, TrayItem } from "../types";
import type { BenchController } from "./controller";

export type BenchRendererProps = {
  /** Starting bench (ignored when `store` is given). */
  initial?: BenchState;
  /** Drive the bench from your own store (see createBenchStore). */
  store?: BenchStore;
  /** Parts the learner can drag in. */
  tray?: TrayItem[];
  /** Latest simulator snapshot: LED glow, damage, relay state, meter display. */
  snapshot?: Snapshot | null;
  /** Called after every committed change (not during drags). */
  onChange?: (bench: BenchState) => void;
  /** Every user action, including inputs to forward to the simulator. */
  onAction?: (action: BenchAction) => void;
  quality?: Quality;
  readOnly?: boolean;
  /** Part ids the learner cannot move, rotate or delete (switches still flip and buttons still press). */
  locked?: string[];
  /** Part ids or anchors ("hole:e12", "pin:R1.a") to point out, for lab hints. */
  highlight?: string[];
  /** Translated UI strings. */
  labels?: Partial<BenchLabels>;
  className?: string;
  style?: CSSProperties;
  /** Called once the first frame has rendered. */
  onReady?: () => void;
  /** Receives the view's controller (BenchController, plus view-specific extras). */
  controllerRef?: { current: BenchController | null };
};
