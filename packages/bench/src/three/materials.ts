// Shared materials. Created once per page and reused by every part, preview and bench.

import * as THREE from "three";

const cache = new Map<string, THREE.Material>();

function memo<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    m.name = key;
    cache.set(key, m);
  }
  return m;
}

export const mat = {
  lead: () => memo("lead", () => new THREE.MeshStandardMaterial({ color: "#d3d6da", metalness: 1, roughness: 0.3 })),
  leadDark: () => memo("leadDark", () => new THREE.MeshStandardMaterial({ color: "#9a9ea4", metalness: 1, roughness: 0.42 })),
  copper: () => memo("copper", () => new THREE.MeshStandardMaterial({ color: "#d9875a", metalness: 1, roughness: 0.3 })),
  copperBright: () => memo("copperBright", () => new THREE.MeshStandardMaterial({ color: "#e9a07a", metalness: 1, roughness: 0.22 })),
  steel: () => memo("steel", () => new THREE.MeshStandardMaterial({ color: "#c7cbd1", metalness: 1, roughness: 0.28 })),
  chrome: () => memo("chrome", () => new THREE.MeshStandardMaterial({ color: "#eef0f3", metalness: 1, roughness: 0.12 })),
  nickel: () => memo("nickel", () => new THREE.MeshStandardMaterial({ color: "#d8d9d6", metalness: 1, roughness: 0.2 })),
  brass: () => memo("brass", () => new THREE.MeshStandardMaterial({ color: "#d6ad55", metalness: 1, roughness: 0.3 })),
  aluminium: () => memo("aluminium", () => new THREE.MeshStandardMaterial({ color: "#d4d7da", metalness: 0.9, roughness: 0.36 })),
  zinc: () => memo("zinc", () => new THREE.MeshStandardMaterial({ color: "#b9c0c6", metalness: 0.85, roughness: 0.45 })),
  blackPlastic: () => memo("blackPlastic", () => new THREE.MeshStandardMaterial({ color: "#1c1d20", metalness: 0, roughness: 0.42 })),
  blackMatte: () => memo("blackMatte", () => new THREE.MeshStandardMaterial({ color: "#232427", metalness: 0, roughness: 0.78 })),
  blackGloss: () =>
    memo("blackGloss", () => new THREE.MeshPhysicalMaterial({ color: "#141518", metalness: 0, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.25 })),
  greyPlastic: () => memo("greyPlastic", () => new THREE.MeshStandardMaterial({ color: "#3a3d42", metalness: 0, roughness: 0.6 })),
  darkInset: () => memo("darkInset", () => new THREE.MeshStandardMaterial({ color: "#121316", metalness: 0, roughness: 0.9 })),
  white: () => memo("white", () => new THREE.MeshStandardMaterial({ color: "#f3f1ec", metalness: 0, roughness: 0.55 })),
  ivory: () => memo("ivory", () => new THREE.MeshStandardMaterial({ color: "#efe6cf", metalness: 0, roughness: 0.5 })),
  board: () => memo("board", () => new THREE.MeshStandardMaterial({ color: "#f6f4ef", metalness: 0, roughness: 0.62 })),
  rubber: (color: string) => memo(`rubber:${color}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.82 })),
  plastic: (color: string, roughness = 0.45) =>
    memo(`plastic:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness })),
  glossy: (color: string) =>
    memo(`glossy:${color}`, () => new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 })),
  insulation: (color: string) =>
    memo(`insulation:${color}`, () => new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.4 })),
  paint: (color: string, metal = false) =>
    memo(
      `paint:${color}:${metal}`,
      () =>
        new THREE.MeshPhysicalMaterial({
          color,
          metalness: metal ? 0.85 : 0,
          roughness: metal ? 0.32 : 0.48,
          clearcoat: metal ? 0.2 : 0.35,
          clearcoatRoughness: 0.4,
        }),
    ),
  basic: (color: string) => memo(`basic:${color}`, () => new THREE.MeshBasicMaterial({ color })),
};

/** Wire and lead insulation colours. */
export const WIRE_HEX: Record<string, string> = {
  red: "#d3282b",
  black: "#202124",
  blue: "#2459c9",
  green: "#1f9a4c",
  yellow: "#f0c31a",
  orange: "#ef7b1a",
  white: "#ecebe6",
  purple: "#7a40b9",
};

/** Body tint for LED lenses, and the brighter emission colour when lit. */
export const LED_HEX: Record<string, { lens: string; clear: string; emit: string }> = {
  red: { lens: "#d8191f", clear: "#ff8f8f", emit: "#ff0c04" },
  orange: { lens: "#f06a12", clear: "#ffc08a", emit: "#ff7a14" },
  yellow: { lens: "#f2c414", clear: "#fff1a6", emit: "#ffd21a" },
  green: { lens: "#1cae3e", clear: "#b8f3c5", emit: "#24ff5a" },
  blue: { lens: "#2257e6", clear: "#bcd0ff", emit: "#2f6bff" },
  white: { lens: "#e9eef6", clear: "#f4f7ff", emit: "#eaf2ff" },
};
