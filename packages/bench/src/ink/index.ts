// PLACEHOLDER for the 2D ink bench. The real renderer (packages/bench/src/ink/**) is built separately and replaces
// this file when it is merged. It only exists so <BenchView view="ink"> compiles and loads: it draws a plain sheet
// with a note and implements the BenchController trivially.

import { createElement, useEffect, type CSSProperties } from "react";
import type { BenchController } from "../view/controller";
import type { BenchRendererProps } from "../view/types";

const SHEET: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--paper, #F6F2E9)",
  color: "var(--ink-2, #57524A)",
  font: "400 16px/24px var(--font-serif, Literata, Georgia, serif)",
};

/** Placeholder: "ink view coming". Same props as the 3D <Bench>. */
export function BenchInk(props: BenchRendererProps) {
  const { controllerRef, onReady, className, style } = props;
  useEffect(() => {
    if (!controllerRef) return;
    const ctrl: BenchController = {
      project: () => null,
      onViewChange: () => () => {},
      focus: () => {},
      spotlight: () => {},
    };
    controllerRef.current = ctrl;
    return () => {
      if (controllerRef.current === ctrl) controllerRef.current = null;
    };
  }, [controllerRef]);
  useEffect(() => {
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createElement(
    "div",
    { className: className ? `ohb-root ohb-ink ${className}` : "ohb-root ohb-ink", style: { ...SHEET, ...style }, role: "img", "aria-label": "Bench" },
    "Ink view coming",
  );
}
