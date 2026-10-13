/** A tiny toast queue shared by every island on the page. ToastRegion renders it. */
import { create } from "zustand";
import type { IconName } from "./icons";
import type { MascotPose } from "../mascot/sprite";

export type ToastTone = "neutral" | "good" | "warn" | "fried";

export type Toast = {
  id: number;
  title: string;
  body?: string | undefined;
  tone: ToastTone;
  icon?: IconName | undefined;
  mascot?: MascotPose | undefined;
  /** Milliseconds before it leaves by itself; 0 keeps it until dismissed. */
  duration: number;
};

type ToastState = {
  toasts: Toast[];
  push(t: Omit<Toast, "id" | "duration" | "tone"> & Partial<Pick<Toast, "duration" | "tone">>): number;
  dismiss(id: number): void;
};

let next = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = next++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { tone: "neutral", duration: 5000, ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = (t: Parameters<ToastState["push"]>[0]) => useToasts.getState().push(t);
