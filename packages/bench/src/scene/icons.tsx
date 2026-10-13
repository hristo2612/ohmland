// Small line icons for the tray and toolbar (inline SVG, original drawings).

import type { ReactElement } from "react";
import type { BenchPartKind } from "../types";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function PartIcon({ kind, color }: { kind: BenchPartKind | "lead" | "meter"; color?: string }): ReactElement {
  const c = color ?? "currentColor";
  const box = (children: ReactElement | ReactElement[]) => (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" {...S}>
      {children}
    </svg>
  );
  switch (kind) {
    case "resistor":
      return box([
        <path key="l" d="M2 16h6M24 16h6" />,
        <rect key="b" x="8" y="12" width="16" height="8" rx="3.5" fill="#dcc49c" stroke="currentColor" />,
        <path key="b1" d="M11.5 12v8" stroke="#f6d01c" strokeWidth="2" />,
        <path key="b2" d="M14.5 12v8" stroke="#7c3cc0" strokeWidth="2" />,
        <path key="b3" d="M17.5 12v8" stroke="#6e3b1c" strokeWidth="2" />,
        <path key="b4" d="M21 12v8" stroke="#c79a2e" strokeWidth="2" />,
      ]);
    case "diode":
      return box([<path key="l" d="M2 16h6M24 16h6" />, <rect key="b" x="8" y="12" width="16" height="8" rx="2" fill="#222" />, <path key="k" d="M20 12v8" stroke="#ccc" strokeWidth="2.4" />]);
    case "led":
      return box([
        <path key="d" d="M10 18v-6a6 6 0 0 1 12 0v6z" fill={color ?? "#e33"} stroke="currentColor" />,
        <path key="r" d="M8 18h16" />,
        <path key="l" d="M13 18v12M19 18v9" />,
      ]);
    case "phototransistor":
      return box([<path key="d" d="M10 18v-6a6 6 0 0 1 12 0v6z" fill="#eef" stroke="currentColor" />, <path key="r" d="M8 18h16" />, <path key="l" d="M13 18v12M19 18v9" />, <path key="a" d="M25 4l-4 4M28 8l-4 4" />]);
    case "battery":
      return box([<rect key="b" x="9" y="7" width="14" height="22" rx="2" fill="#22335f" stroke="currentColor" />, <rect key="t1" x="11" y="3" width="3" height="4" />, <rect key="t2" x="18" y="3" width="4" height="4" />, <path key="v" d="M13 14l3 7 3-7" stroke="#fff" />]);
    case "pushbutton":
      return box([<rect key="b" x="8" y="10" width="16" height="12" rx="1.5" fill="#333" />, <circle key="c" cx="16" cy="16" r="3.6" fill="#111" stroke="#888" />, <path key="l" d="M10 22v6M22 22v6M10 10V4M22 10V4" />]);
    case "slide-switch":
      return box([<rect key="b" x="5" y="13" width="22" height="9" rx="1" fill="#bbb" />, <rect key="k" x="9" y="7" width="5" height="7" rx="1" fill="#222" />, <path key="l" d="M9 22v6M16 22v6M23 22v6" />]);
    case "toggle-switch":
      return box([<rect key="b" x="8" y="18" width="16" height="8" rx="1" fill="#222" />, <rect key="n" x="12" y="14" width="8" height="4" fill="#bbb" />, <path key="lv" d="M16 14L22 4" strokeWidth="2.4" />]);
    case "fuse":
      return box([<rect key="g" x="7" y="12" width="18" height="8" rx="2" fill="#eef6f2" />, <rect key="c1" x="4" y="11" width="5" height="10" rx="1" fill="#ccc" />, <rect key="c2" x="23" y="11" width="5" height="10" rx="1" fill="#ccc" />, <path key="f" d="M9 17l14-2" />]);
    case "ceramic-cap":
      return box([<circle key="d" cx="16" cy="11" r="7" fill="#3c66b4" />, <path key="l" d="M13 17v12M19 17v12" />]);
    case "electrolytic-cap":
      return box([<rect key="c" x="9" y="3" width="14" height="18" rx="2" fill="#24387c" />, <path key="s" d="M20 3v18" stroke="#a9bde3" strokeWidth="3" />, <path key="l" d="M13 21v9M19 21v7" />]);
    case "trimmer":
      return box([<rect key="b" x="7" y="7" width="18" height="16" rx="2" fill="#2f63c8" />, <circle key="r" cx="16" cy="15" r="5" fill="#f1ead8" />, <path key="x" d="M13 15h6M16 12v6" />, <path key="l" d="M10 23v6M16 23v6M22 23v6" />]);
    case "relay":
      return box([<rect key="b" x="5" y="7" width="22" height="16" rx="2" fill="#cfd6dd" />, <rect key="c" x="8" y="11" width="7" height="8" fill="#e9a07a" />, <path key="l" d="M8 23v6M14 23v6M20 23v6M25 23v6" />]);
    case "npn":
      return box([<path key="b" d="M9 20V11a7 7 0 0 1 14 0v9z" fill="#222" />, <path key="l" d="M12 20v9M16 20v9M20 20v9" />]);
    case "speaker":
      return box([<circle key="o" cx="16" cy="16" r="12" fill="#2f3136" />, <circle key="c" cx="16" cy="16" r="4" fill="#111" stroke="#888" />]);
    case "cup":
      return box([<path key="g" d="M8 6h16l-2 22H10z" fill="#eaf4fb" />, <path key="w" d="M9 13h14" stroke="#6aa9d8" />]);
    case "lemon":
      return box([<path key="l" d="M4 16a12 12 0 0 0 24 0z" fill="#f3d23a" />, <path key="c" d="M11 16V6M21 16V6" stroke="#c87533" strokeWidth="2" />]);
    case "dpdt-switch":
      return box([<rect key="b" x="3" y="16" width="26" height="10" rx="1.5" fill="#7a4a2a" />, <rect key="p" x="7" y="11" width="18" height="5" rx="1" fill="#bbb" />, <rect key="k" x="10" y="6" width="5" height="6" rx="1" fill="#222" />, <path key="s" d="M6 22h0M11 22h0M16 22h0M21 22h0M26 22h0" strokeWidth="2.6" stroke="#d6ad55" />]);
    case "touch-pads":
      return box([<rect key="b" x="6" y="5" width="20" height="17" rx="2" fill="#1f6b3f" />, <path key="f" d="M10 8v11M14 8v8M18 8v11M22 8v8" stroke="#e3b34c" strokeWidth="2" />, <path key="l" d="M12 22v7M20 22v7" />]);
    case "lead":
      return box([<path key="c" d="M4 26c6-10 10 2 16-8" stroke={c} strokeWidth="2.4" />, <path key="j" d="M20 18l7-8M22 21l7-6" />]);
    case "meter":
      return box([<rect key="b" x="7" y="3" width="18" height="26" rx="3" fill="#f0a43c" />, <rect key="s" x="10" y="6" width="12" height="6" fill="#c9d1bb" />, <circle key="d" cx="16" cy="19" r="4" fill="#333" />]);
  }
}

export function ToolIcon({ name }: { name: "select" | "wire" | "xray" | "undo" | "redo" | "rotate" | "delete" | "top" | "reset" | "flip" | "press" }): ReactElement {
  const box = (children: ReactElement | ReactElement[]) => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...S}>
      {children}
    </svg>
  );
  switch (name) {
    case "select":
      return box(<path d="M6 3l12 9-5.5 1.2L15 20l-2.4 1-2.5-6.5L6 18z" />);
    case "wire":
      return box([<circle key="a" cx="5" cy="18" r="2" />, <circle key="b" cx="19" cy="18" r="2" />, <path key="w" d="M5 16c0-12 14-12 14 0" />]);
    case "xray":
      return box([<rect key="r" x="3" y="6" width="18" height="12" rx="2" />, <path key="s" d="M7 9v6M11 9v6M15 9v6" />]);
    case "undo":
      return box(<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />);
    case "redo":
      return box(<path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />);
    case "rotate":
      return box(<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />);
    case "delete":
      return box(<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />);
    case "top":
      return box([<rect key="r" x="4" y="4" width="16" height="16" rx="2" />, <path key="c" d="M12 8v8M8 12h8" />]);
    case "reset":
      return box(<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" />);
    case "flip":
      return box(<path d="M4 9h13l-3-3M20 15H7l3 3" />);
    case "press":
      return box([<circle key="c" cx="12" cy="12" r="4" />, <path key="r" d="M12 3v3M12 18v3M3 12h3M18 12h3" />]);
  }
}
