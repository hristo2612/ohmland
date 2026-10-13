/**
 * The mascot: a small voxel robot that floats over the central plaza. A rounded cream head with a dark visor and two
 * amber LED eyes, one antenna with a glowing tip, a compact body with a copper chest plate, two stubby arms, no legs,
 * and a small thruster glow beneath. It bobs, blinks, and flies next to new things during a reveal.
 *
 * Built at twice its size on the 1/8 grid (so the head is 12 voxels wide) and scaled down by half.
 */
import * as THREE from "three";
import { Q, Shape } from "./kit";
import { NOTEBOOK, gradeFor, type Look } from "./look";

export type Robot = {
  group: THREE.Group;
  /** A hidden sphere for taps. */
  hit: THREE.Mesh;
  /** Eyes open (false) or shut (true). */
  blink(shut: boolean): void;
  dispose(): void;
};

export const ROBOT_COLORS = {
  shell: "#F4EFE6",
  shellShade: "#E2DACB",
  visor: "#262A33",
  eye: "#FFB43A",
  copper: "#D98A45",
  thruster: "#FFC25A",
} as const;

/**
 * In the notebook look the robot matches its ink drawing: a red pencil tip on the antenna and no thruster glow, so
 * amber is left to its eyes alone.
 */
export function makeRobot(bodyMat: THREE.Material, glowMat: THREE.Material, look: Look = "classic"): Robot {
  const notebook = look === "notebook";
  const grade = gradeFor(look);
  const s = new Shape({ bottoms: true, grade });
  const { shell, shellShade, visor, copper } = ROBOT_COLORS;
  // head: 12 x 10 x 10 voxels, a rounded square seen from the front, its front and back edges bevelled
  const hy = 1.25;
  const W = 1.5;
  const H = 1.25;
  const D = 1.25;
  s.box(W, H - 4 * Q, D - 2 * Q, shell, 0, hy + 2 * Q, 0);
  s.box(W - 2 * Q, H - 2 * Q, D - 2 * Q, shell, 0, hy + Q, 0);
  s.box(W - 4 * Q, H, D - 2 * Q, shell, 0, hy, 0);
  s.box(W - 2 * Q, H - 4 * Q, D, shell, 0, hy + 2 * Q, 0);
  s.box(W - 4 * Q, H - 2 * Q, D, shell, 0, hy + Q, 0);
  // the visor, set a voxel proud of the face
  s.box(1.25, 0.625, Q, visor, 0, hy + 0.3125, 0.625);
  s.box(1.0, 0.75, Q, visor, 0, hy + 0.25, 0.625);
  // ear bolts
  for (const sx of [-1, 1]) s.box(Q, 0.375, 0.375, copper, sx * 0.8125, hy + 0.375, 0);
  // antenna with its tip
  s.box(Q, 0.375, Q, "#B9BEC6", 0.25, hy + 1.25, 0);
  // neck and body: 8 x 6 x 7 voxels, rounded, with the copper chest plate
  s.box(0.5, Q, 0.5, shellShade, 0, hy - Q, 0);
  const by = 0.375;
  s.box(1.0, 0.75, 0.875 - 2 * Q, shell, 0, by, 0);
  s.box(1.0 - 2 * Q, 0.75, 0.875, shell, 0, by, 0);
  s.box(0.5, 0.375, Q, copper, 0, by + 0.1875, 0.4375);
  s.box(Q, Q, Q, "#F7C27A", -0.125, by + 0.375, 0.5);
  // stubby arms
  for (const sx of [-1, 1]) {
    s.box(0.25, 0.5, 0.375, shellShade, sx * 0.625, by + 0.125, 0);
    s.box(0.25, 0.125, 0.25, copper, sx * 0.625, by, 0);
  }
  // the thruster nozzle
  s.box(0.5, 0.25, 0.5, "#4A4F59", 0, by - 0.25, 0);
  const eyesShape = new Shape({ grade });
  const eye = notebook ? NOTEBOOK.amber : "amber";
  for (const sx of [-1, 1]) eyesShape.box(0.25, 0.25, Q, eye, sx * 0.25, hy + 0.4375, 0.6875, { glow: true, day: "#FFB43A" });
  const tipShape = new Shape({ grade });
  if (notebook) tipShape.box(0.25, 0.25, 0.25, "#E0573A", 0.25, hy + 1.625, 0, { glow: true, day: NOTEBOOK.red });
  else {
    tipShape.box(0.25, 0.25, 0.25, "amber", 0.25, hy + 1.625, 0, { glow: true, day: "#FFB43A" });
    tipShape.box(0.375, Q, 0.375, "#FFC25A", 0, by - 0.375, 0, { glow: true, day: "#FFD27A" });
    tipShape.box(0.25, Q, 0.25, "#FFE6A8", 0, by - 0.5, 0, { glow: true, day: "#FFE6A8" });
  }

  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(0.5);
  inner.position.y = -0.4;
  group.add(inner);
  const body = s.geometries().body!;
  const bodyMesh = new THREE.Mesh(body, bodyMat);
  const eyes = new THREE.Mesh(eyesShape.geometries().glow!, glowMat);
  const tips = new THREE.Mesh(tipShape.geometries().glow!, glowMat);
  inner.add(bodyMesh, eyes, tips);
  // shut eyes: a thin amber line
  const shutShape = new Shape({ grade });
  for (const sx of [-1, 1]) shutShape.box(0.25, Q / 2, Q, eye, sx * 0.25, hy + 0.5, 0.6875, { glow: true, day: "#FFB43A" });
  const shut = new THREE.Mesh(shutShape.geometries().glow!, glowMat);
  shut.visible = false;
  inner.add(shut);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.2;
  group.add(hit);
  return {
    group,
    hit,
    blink(b) {
      eyes.visible = !b;
      shut.visible = b;
    },
    dispose() {
      for (const m of [bodyMesh, eyes, tips, shut, hit]) m.geometry.dispose();
      (hit.material as THREE.Material).dispose();
    },
  };
}
