// The page palette as React state: read from the notebook tokens on the page, kept in step with theme changes.

import { createContext, useContext, useEffect, useState } from "react";
import { PAPER_LIGHT, paletteKey, readPalette, type PaperPalette } from "../three/paper";

export const PaletteContext = createContext<PaperPalette>(PAPER_LIGHT);

export const usePaperPalette = (): PaperPalette => useContext(PaletteContext);

/**
 * The palette under `el`. With `theme` set it is fixed; otherwise it follows the page's CSS custom properties and is
 * read again when the root element's theme attributes or the colour scheme change.
 */
export function useReadPalette(el: Element | null, theme?: "light" | "dark"): PaperPalette {
  const [palette, setPalette] = useState<PaperPalette>(() => readPalette(el, theme));
  useEffect(() => {
    const update = () =>
      setPalette((prev) => {
        const next = readPalette(el, theme);
        return paletteKey(next) === paletteKey(prev) && next.dark === prev.dark ? prev : next;
      });
    update();
    if (theme || typeof window === "undefined") return;
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", update);
    return () => {
      mo.disconnect();
      mq?.removeEventListener?.("change", update);
    };
  }, [el, theme]);
  return palette;
}
