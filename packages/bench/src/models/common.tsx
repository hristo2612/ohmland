// Shared bits for part models: mounting frames, leads, health tints.

import { createContext, type ReactNode } from "react";
import * as THREE from "three";
import type { PartState } from "@ohmland/sim";
import type { Quality } from "../types";

/**
 * How a part is shown:
 * - "board": seated in breadboard holes. Local origin is the first lead's hole at board-surface height.
 * - "preview": standing upright with full-length straight leads (parts bin, gallery). Same origin as "board".
 * - "desk": lying loose on the desk. Local origin is the body origin on the desk surface.
 */
export type Mount = "board" | "preview" | "desk";

export type ModelProps<P> = {
  params: P;
  mount: Mount;
  /** Lead spacing in pitches for stretchable parts (board and preview). */
  span?: number;
  state?: PartState | null;
  quality?: Quality;
  /** Momentary actuator state (pushbutton held). */
  pressed?: boolean;
};

/** Room lighting, 1 bright to about 0.1 dim. Glowing parts shine harder in a dim room. */
export const RoomLight = createContext(1);

/** Depth a lead goes into a breadboard hole, below the surface. */
export const IN_HOLE = -2.3;

export function healthOf(state?: PartState | null): PartState["health"] {
  return state?.health ?? "ok";
}

/**
 * Radial parts are modelled upright (body above, leads pointing down, spread along x, centred on x = 0).
 * This wraps them for each mount: on the board the body centre sits `centerX` from the first lead;
 * on the desk the part lies on its side with the leads pointing +x and the body resting at `deskAxis` height.
 * `layFlat` lays the part face-up instead (ceramic discs, transistors with the flat face up).
 */
export function RadialMount({
  mount,
  centerX,
  deskAxis,
  layFlat,
  children,
}: {
  mount: Mount;
  centerX: number;
  deskAxis: number;
  layFlat?: "up" | "down";
  children: ReactNode;
}) {
  if (mount !== "desk") return <group position={[centerX, 0, 0]}>{children}</group>;
  if (layFlat) {
    return (
      <group position={[0, deskAxis, 0]} rotation={[layFlat === "up" ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>{children}</group>
      </group>
    );
  }
  return (
    <group position={[0, deskAxis, 0]} rotation={[0, 0, Math.PI / 2]}>
      <group rotation={[0, -Math.PI / 2, 0]}>{children}</group>
    </group>
  );
}

/** Blend a colour toward another (for burnt or hot looks). */
export function mix(a: string, b: string, t: number): string {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}
