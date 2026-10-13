/** React hooks over the learner store. Every island calls useLearnerReady(outline) once to load the record. */
import { useEffect, useMemo } from "react";
import type { CourseOutline } from "../content/outline";
import { derive, type Derived } from "./derive";
import { useLearner } from "./store";

export { useLearner };

export function useLearnerReady(outline?: CourseOutline): boolean {
  const status = useLearner((s) => s.status);
  useEffect(() => {
    void useLearner.getState().init(outline);
  }, [outline]);
  return status === "ready";
}

/** Derived XP, level and parts for the current record. */
export function useDerived(outline: CourseOutline): Derived {
  const learner = useLearner((s) => s.learner);
  return useMemo(() => derive(learner, outline), [learner, outline]);
}
