// Animation helpers for a demand-rendered canvas: keep invalidating only while something moves.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/**
 * Smoothly approach `target` and call `apply(value)` every frame until settled. With frameloop "demand" this keeps
 * requesting frames only while the value is moving.
 */
export function useEased(target: number, apply: (v: number) => void, speed = 14, initial?: number): void {
  const v = useRef(initial ?? target);
  const applied = useRef<number | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [target, invalidate]);
  useFrame((_, dt) => {
    const d = target - v.current;
    if (Math.abs(d) < 1e-3) {
      if (applied.current !== target) {
        v.current = target;
        applied.current = target;
        apply(target);
      }
      return;
    }
    v.current += d * Math.min(1, dt * speed);
    applied.current = v.current;
    apply(v.current);
    invalidate();
  });
}

/** Keep rendering every frame while `active` (smoke, pulses, turntables). */
export function useAnimating(active: boolean): void {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);
  useFrame(() => {
    if (active) invalidate();
  });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
