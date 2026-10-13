/**
 * Lazy access to the lab definitions in content/labs. Each lab is its own chunk, loaded only when a lab step is
 * on screen (or about to be: see prefetch.ts).
 */
import type { LabDefinition } from "./define";

const modules = import.meta.glob<{ default: LabDefinition }>("../../../../content/labs/*.ts");
const loaded = new Map<string, LabDefinition>();

export async function loadLab(id: string): Promise<LabDefinition> {
  const hit = loaded.get(id);
  if (hit) return hit;
  const entry = Object.entries(modules).find(([path]) => path.endsWith(`/${id}.ts`));
  if (!entry) throw new Error(`No lab "${id}"`);
  const mod = await entry[1]();
  loaded.set(id, mod.default);
  return mod.default;
}

/** The lab's definition if it has already loaded, so a warmed lab renders without waiting a turn. */
export function loadedLab(id: string): LabDefinition | null {
  return loaded.get(id) ?? null;
}
