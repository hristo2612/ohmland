/** Bench render quality: picked for the device, with a manual override remembered in localStorage. */
export type Quality = "high" | "low";

const KEY = "ohmland:bench-quality";

export function storedQuality(): Quality | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "high" || v === "low" ? v : null;
  } catch {
    return null;
  }
}

export function storeQuality(q: Quality | null): void {
  try {
    if (q) localStorage.setItem(KEY, q);
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered; it still applies now.
  }
}

let software: boolean | null = null;

/** Whether WebGL runs on the CPU (SwiftShader, llvmpipe): soft shadows and post-processing would crawl there. */
function softwareGl(): boolean {
  if (software !== null) return software;
  software = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // Unknown: assume hardware.
  }
  return software;
}

/** Low on phones, small or weak devices and software WebGL, high otherwise. */
export function autoQuality(): Quality {
  if (typeof window === "undefined") return "high";
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  if ((coarse && small) || cores <= 4 || memory <= 4 || softwareGl()) return "low";
  return "high";
}

export function pickQuality(): Quality {
  return storedQuality() ?? autoQuality();
}
