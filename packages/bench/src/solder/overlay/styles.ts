// The solder overlay's stylesheet. It sits over either view, so it reads the ink view's palette when it is there
// (--k-*) and the page's notebook tokens otherwise, with the Classic notebook colours as the last fallback.

const T = {
  paper: "var(--k-paper, var(--paper, #F6F2E9))",
  slip: "var(--k-slip, var(--paper-slip, #FCFAF5))",
  sunk: "var(--k-sunk, var(--paper-sunk, #EEE8DC))",
  ink: "var(--k-ink, var(--ink, #24221E))",
  ink2: "var(--k-ink-2, var(--ink-2, #57524A))",
  ink3: "var(--k-ink-3, var(--ink-3, #6B655B))",
  rule: "var(--k-rule-soft, var(--rule-soft, #D8D0C1))",
  shadow: "var(--k-shadow, var(--shadow-ink, #E1D9CA))",
  blue: "var(--k-blue, var(--blue, #1F3C9A))",
  blueWash: "var(--k-blue-wash, var(--blue-wash, #E1E6F4))",
  red: "var(--k-red, var(--red, #B23A1C))",
  amber: "var(--k-amber, var(--amber, #F2A531))",
  focus: "var(--k-focus, var(--focus, #1F3C9A))",
  metal: "var(--k-metal, var(--sk-metal, #BDB6A8))",
  copper: "var(--k-copper, #C98450)",
  board: "var(--sk-perf, #E7D7A6)",
  solder: "var(--sk-solder, #C9CDD2)",
  solderHi: "var(--sk-solder-hi, #F4F6F8)",
  grip: "var(--sk-grip, #3A6A52)",
};

export const SOLDER_CSS = `
.ohs-root{position:absolute;inset:0;pointer-events:none;overflow:hidden;font:400 15px/1.3 var(--font-serif,"Literata",Georgia,serif);color:${T.ink};-webkit-user-select:none;user-select:none}
.ohs-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.ohs-hit{position:absolute;pointer-events:auto;transform:translate(-50%,-50%);border-radius:50%;background:transparent;border:0;padding:0;margin:0;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent}
.ohs-hit:focus-visible{outline:2px dashed ${T.focus};outline-offset:2px}
.ohs-hit.is-tool{cursor:grab}
.ohs-hit.is-spot{width:22px;height:22px}
.ohs-compact .ohs-hit.is-spot{width:30px;height:30px}
.ohs-hit.is-tool{width:52px;height:52px}
.ohs-ring{fill:none;stroke:${T.blue};stroke-width:1.6px;opacity:.55}
.ohs-ring.is-near{opacity:1;stroke-width:2.4px}
.ohs-ring.is-hint{stroke:${T.red};stroke-dasharray:3 3;opacity:.9}
.ohs-fill-ring{fill:none;stroke:${T.ink};stroke-width:2px;stroke-linecap:round;transition:stroke-dashoffset 120ms linear}
.ohs-iron .ohs-tip{fill:${T.solder};stroke:${T.ink};stroke-width:1.4px;stroke-linejoin:round}
.ohs-iron .ohs-shaft{fill:${T.metal};stroke:${T.ink};stroke-width:1.4px}
.ohs-iron .ohs-collar{fill:${T.sunk};stroke:${T.ink};stroke-width:1.4px}
.ohs-iron .ohs-grip{fill:${T.grip};stroke:${T.ink};stroke-width:1.6px}
.ohs-iron .ohs-cord{fill:none;stroke:${T.ink2};stroke-width:3px;stroke-linecap:round}
.ohs-ln{fill:none;stroke:${T.ink};stroke-width:1.6px;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.ohs-ln-soft{fill:none;stroke:${T.ink};stroke-width:1px;opacity:.35}
.ohs-wire .ohs-solder-edge{fill:none;stroke:${T.ink};stroke-width:4.2px;stroke-linecap:round}
.ohs-wire .ohs-solder{fill:none;stroke:${T.solder};stroke-width:2.4px;stroke-linecap:round}
.ohs-wire .ohs-solder-end{fill:${T.solderHi};stroke:${T.ink};stroke-width:1.2px}
.ohs-hatch{stroke:${T.red};stroke-width:1.2px}
.ohs-heat{stroke:${T.red};stroke-width:1px;stroke-opacity:.55}
.ohs-heat-num{font:600 12px var(--font-hand,"Kalam",cursive);fill:${T.red};paint-order:stroke;stroke:${T.paper};stroke-width:3px}
.ohs-smoke{fill:none;stroke:${T.ink3};stroke-width:1.4px;stroke-linecap:round;opacity:.55}
.ohs-slip{pointer-events:auto;background:${T.slip};border:1px solid ${T.rule};border-radius:2px;box-shadow:2px 2px 0 ${T.shadow}}
.ohs-dock{position:absolute;right:10px;bottom:10px;display:flex;align-items:center;gap:2px;padding:2px}
.ohs-compact .ohs-dock{right:8px;bottom:102px}
.ohs-notray.ohs-compact .ohs-dock{bottom:10px}
.ohs-temp{min-width:86px;padding:0 10px;display:inline-flex;flex-direction:column;justify-content:center;height:44px;line-height:1.05}
.ohs-temp b{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;color:${T.ink}}
.ohs-temp small{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${T.ink3}}
.ohs-temp[data-hot="1"] b{color:${T.red}}
.ohs-btn{all:unset;box-sizing:border-box;cursor:pointer;min-width:44px;height:44px;padding:0 10px;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:${T.ink2};font:inherit;font-size:14px}
.ohs-btn:hover{color:${T.ink};background:${T.sunk}}
.ohs-btn:focus-visible{outline:2px solid ${T.focus};outline-offset:-2px}
.ohs-btn[aria-pressed=true]{color:${T.blue};background:${T.blueWash}}
.ohs-sep{width:1px;height:24px;background:${T.rule};margin:0 2px}
.ohs-mag{position:absolute;top:12px;right:12px;width:min(260px,calc(100% - 24px));padding:8px 10px 10px}
.ohs-compact .ohs-mag{top:58px;left:50%;right:auto;transform:translateX(-50%)}
.ohs-mag h3{margin:0 0 2px;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${T.ink3};display:flex;justify-content:space-between;align-items:center}
.ohs-mag p{margin:4px 0 0;font-family:var(--font-hand,"Kalam",cursive);font-size:18px;line-height:1.2;color:${T.blue}}
.ohs-mag .ohs-side{display:block;width:100%;height:auto;margin-top:2px;border-radius:50%/60%}
.ohs-mag .ohs-x{all:unset;cursor:pointer;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:2px;color:${T.ink2}}
.ohs-mag .ohs-x:focus-visible{outline:2px solid ${T.focus}}
.ohs-side .ohs-board{fill:${T.board}}
.ohs-side .ohs-pad{fill:${T.copper}}
.ohs-side .ohs-lead{fill:${T.metal}}
.ohs-side .ohs-solder-fill{fill:${T.solder}}
.ohs-side .ohs-solder-liquid{fill:${T.solderHi}}
.ohs-side .ohs-solder-dull{fill:#A9ADB1}
.ohs-side .ohs-solder-dark{fill:#8A7A5E}
.ohs-side .ohs-sheen{fill:none;stroke:#FFFFFF;stroke-width:3px;stroke-linecap:round;opacity:.9}
.ohs-side .ohs-sheen-satin{opacity:.45}
.ohs-side .ohs-stipple{stroke:${T.ink2};stroke-width:2.4px;stroke-linecap:round;fill:none}
.ohs-side .ohs-crack{fill:none;stroke:${T.ink2};stroke-width:1.2px}
.ohs-side .ohs-burn{fill:none;stroke:#5A3A22;stroke-width:5px;stroke-linecap:round;opacity:.8}
.ohs-side .ohs-gap{stroke:${T.paper};stroke-width:3px}
.ohs-say{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
@media (prefers-reduced-motion: no-preference){
  .ohs-smoke-anim{animation:ohs-drift 2.4s ease-out infinite}
  .ohs-smoke-anim:nth-child(2){animation-delay:.8s}
  .ohs-smoke-anim:nth-child(3){animation-delay:1.6s}
}
@keyframes ohs-drift{0%{transform:translate(0,0);opacity:0}25%{opacity:.6}100%{transform:translate(-14px,-26px);opacity:0}}
`;
