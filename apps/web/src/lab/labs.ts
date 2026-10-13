/**
 * Lazy access to the lab definitions in content/labs. Each lab is its own chunk, loaded only when a lab step is
 * on screen.
 */
import type { LabDefinition } from "./define";

const modules = import.meta.glob<{ default: LabDefinition }>("../../../../content/labs/*.ts");

export async function loadLab(id: string): Promise<LabDefinition> {
  const entry = Object.entries(modules).find(([path]) => path.endsWith(`/${id}.ts`));
  if (!entry) throw new Error(`No lab "${id}"`);
  const mod = await entry[1]();
  return mod.default;
}
