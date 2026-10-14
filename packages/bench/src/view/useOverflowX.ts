// Whether an element's content runs past it sideways. The phone's tray strip scrolls then: its items let a sideways
// swipe scroll it (touch-action: pan-x) and an upward drag take a part out; otherwise a drag in any direction is theirs.

import { useLayoutEffect, useState } from "react";

/** `items`: how many children it has now (measured again when that changes). Returns the flag and a ref callback. */
export function useOverflowX(items: number): [boolean, (el: HTMLElement | null) => void] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setOver(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, items]);
  return [over, setEl];
}
