// The ink view's stylesheet: the Classic notebook palette (graphite ink, blue ink for you, red pencil for the
// teacher, amber only for light) as custom properties, then the drawing and chrome classes. Every raw colour of the
// ink view lives here. Hosts that define the notebook tokens (--paper, --ink, --blue, --sk-*) override the defaults,
// so the bench matches the page it sits on.

const LIGHT = `
  --k-paper: var(--paper, #F6F2E9);
  --k-slip: var(--paper-slip, #FCFAF5);
  --k-sunk: var(--paper-sunk, #EEE8DC);
  --k-grid: var(--grid, #E7E0D3);
  --k-ink: var(--ink, #24221E);
  --k-ink-2: var(--ink-2, #57524A);
  --k-ink-3: var(--ink-3, #6B655B);
  --k-rule: var(--rule, #3D3A34);
  --k-rule-soft: var(--rule-soft, #D8D0C1);
  --k-shadow: var(--shadow-ink, #E1D9CA);
  --k-blue: var(--blue, #1F3C9A);
  --k-blue-wash: var(--blue-wash, #E1E6F4);
  --k-red: var(--red, #B23A1C);
  --k-red-wash: var(--red-wash, #F6DED4);
  --k-amber: var(--amber, #F2A531);
  --k-focus: var(--focus, #1F3C9A);
  --k-btn-bg: var(--btn-bg, #24221E);
  --k-btn-fg: var(--btn-fg, #F6F2E9);
  /* The flow: a light electric tint inside the cables, with a dark rim so it reads on a yellow or white lead. */
  --k-flow: var(--flow, #E2F6FF);
  --k-flow-rim: color-mix(in srgb, var(--k-flow) 12%, #0B1622);

  --k-board: var(--sk-board, #FBF8F1);
  --k-hole: var(--sk-hole, #B4AC9C);
  --k-hole-in: #8C8475;
  --k-channel: #EFE9DD;
  --k-rail-pos: var(--sk-rail-pos, #C2412B);
  --k-rail-neg: var(--sk-rail-neg, #2F55B8);
  --k-strip: var(--strip-copper, #B4683A);
  --k-strip-wash: var(--strip-copper-wash, #F1D9C2);
  --k-shade: var(--sk-shade, #D3CAB9);
  --k-metal: var(--sk-metal, #BDB6A8);
  --k-metal-hi: #E4DFD4;
  --k-copper: #C98450;
  --k-zinc: #C9CCCF;
  --k-body: var(--sk-body, #E9DCC2);
  --k-scorch: var(--sk-scorch, #4A3328);
  --k-smoke: var(--sk-smoke, #8A8378);
  --k-black-part: #34312C;
  --k-black-face: #4A463F;
  --k-print: #EDE7DA;
  --k-meter: var(--sk-meter, #EFE6D2);
  --k-meter-rim: #DCD0B6;
  --k-lcd: var(--sk-lcd, #DCE3CF);
  --k-lcd-off: #CCD3BF;
  --k-lcd-ink: #22261E;
  --k-knob: #3A3833;
  --k-battery-label: var(--sk-battery-label, #E8BE2C);
  --k-wood: #C99A6B;
  --k-wood-dark: #A97B50;
  --k-relay: #E7EDEE;
  --k-glass: #E8F0EF;
  --k-water: #CFE1EE;
  --k-water-edge: #9EBFD8;
  --k-lemon: #F0CE48;
  --k-lemon-dark: #D9AE2A;
  --k-ceramic: #4E74C2;
  --k-elco: #2E3F7A;
  --k-elco-stripe: #B9C6E6;
  --k-trimmer: #3A68C6;
  --k-speaker: #3A3833;
  --k-cone: #6B655B;

  --k-w-red: var(--sk-wire-red, #C2412B);
  --k-w-black: var(--sk-wire-black, #2B2925);
  --k-w-green: var(--sk-wire-green, #2F8A4C);
  --k-w-yellow: var(--sk-wire-yellow, #E0AE22);
  --k-w-blue: #2F55B8;
  --k-w-orange: #E07B24;
  --k-w-white: #F1EEE6;
  --k-w-purple: #7D4FA6;

  --k-b-black: var(--sk-band-black, #2B2925);
  --k-b-brown: var(--sk-band-brown, #7A4A2B);
  --k-b-red: var(--sk-band-red, #C9372A);
  --k-b-orange: var(--sk-band-orange, #E07B24);
  --k-b-yellow: var(--sk-band-yellow, #E8BE2C);
  --k-b-green: var(--sk-band-green, #3C8B4A);
  --k-b-blue: #2F55B8;
  --k-b-violet: var(--sk-band-violet, #7D4FA6);
  --k-b-grey: #8F8A80;
  --k-b-white: #F6F3EC;
  --k-b-gold: var(--sk-band-gold, #B99437);
  --k-b-silver: #B8B6B0;

  --k-led-red: var(--sk-led, #D8432E);
  --k-lit-red: var(--sk-led-lit, #F07A5C);
  --k-glow-red: var(--sk-glow, #F2A08A);
  --k-led-green: #3E9A57;
  --k-lit-green: #7BD08E;
  --k-glow-green: #A8E2B4;
  --k-led-yellow: #E3B32A;
  --k-lit-yellow: #F7D560;
  --k-glow-yellow: #F6E08E;
  --k-led-blue: #3561C4;
  --k-lit-blue: #7EA2F0;
  --k-glow-blue: #A9C0F5;
  --k-led-white: #E6E2D8;
  --k-lit-white: #FFFFFF;
  --k-glow-white: #F4EED8;
  --k-led-orange: #E0782A;
  --k-lit-orange: #F6A55E;
  --k-glow-orange: #F6C08E;
  --k-led-photo: #E3E8EA;
  --k-glow-core: var(--sk-glow-core, #FFE6CF);
  --k-dead: var(--sk-led-dead, #6E5A52);
  --k-body-metal: #A9C3DE;
  --k-glass-amber: #E9B48A;
  --k-brass: #C9A04E;
  --k-station: #E3E6EA;
  --k-lemon-face: #F7E79A;
  --k-skin: #EEC3A4;
  --k-skin-line: #C98F6E;
  --k-drop: #DCEBF6;
  --k-ruler: #D7E8F3;
  --k-graphite: #3A3B3F;
  --k-pencil: #E8BE2C;
  --k-eraser: #E59AA0;
  --k-pcb: #2F7A4A;
  --k-gold: #DDB14E;
  --k-aa-alkaline: #2F5F86;
  --k-aa-nimh: #3E8A57;
  --k-aa-lithium: #6A6F78;
  --k-room: #0E0D0C;
  --k-perf: var(--sk-perf, #E7D7A6);
  --k-perf-edge: #CDB674;
  --k-solder: var(--sk-solder, #C9CDD2);
  --k-solder-hi: #F6F8FA;
  --k-solder-dull: #A5A9AD;
  --k-flux: #9A6A33;
  --k-sponge: #E9C95E;
  --k-grip: #3E6E57;
  --k-shrink: #34312C;
  --k-gun: #D2573A;
  --k-handle: #C2412B;
  --k-singe: #8A5A32;
  --k-cardboard: #DCC6A2;
  --k-cardboard-dark: #C4A982;
  --k-foil: #D6DADF;
  --k-silver: #C9C8C1;
  --k-spoon: #F3EFE6;
  --k-marble: #BFE0E6;
  --k-coat: #3E7CC7;
  --k-string: #E3D6BA;
  --k-mno2: #3A3632;
  --k-zinc-gel: #B9BDC2;
  --k-separator: #F4EFE3;
  --k-balloon-red: #D9483B;
  --k-balloon-blue: #3F6CC8;
  --k-balloon-yellow: #E8BE2C;
  --k-wool: #B8574A;
  --k-wall: #EFE7D6;
  --k-wall-line: #D8CCB2;
  --k-tape: #EFE6CF;
  --k-warm: #C2562E;
  --k-dipsw: #3360C2;
  --k-seg-body: #4A4C51;
  --k-seg-face: #5D6066;
  --k-seg-off: #CDC7BC;
  --k-probe: #E9E4D8;
  --k-lamp-off: #6B5E50;
`;

const DARK = `
  --k-paper: var(--paper, #1B1A18);
  --k-slip: var(--paper-slip, #242320);
  --k-sunk: var(--paper-sunk, #141312);
  --k-grid: var(--grid, #252422);
  --k-ink: var(--ink, #ECE6DA);
  --k-ink-2: var(--ink-2, #BDB6A8);
  --k-ink-3: var(--ink-3, #9A9488);
  --k-rule: var(--rule, #8F887B);
  --k-rule-soft: var(--rule-soft, #3A3833);
  --k-shadow: var(--shadow-ink, #0F0E0D);
  --k-blue: var(--blue, #9AB3F4);
  --k-blue-wash: var(--blue-wash, #26304A);
  --k-red: var(--red, #F2906F);
  --k-red-wash: var(--red-wash, #43271F);
  --k-amber: var(--amber, #F5B048);
  --k-focus: var(--focus, #9AB3F4);
  --k-btn-bg: var(--btn-bg, #ECE6DA);
  --k-btn-fg: var(--btn-fg, #1B1A18);
  --k-flow: var(--flow, #E2F6FF);
  --k-flow-rim: color-mix(in srgb, var(--k-flow) 12%, #0B1622);

  --k-board: var(--sk-board, #2A2926);
  --k-hole: var(--sk-hole, #5C5850);
  --k-hole-in: #121110;
  --k-channel: #1F1E1C;
  --k-rail-pos: var(--sk-rail-pos, #E2664C);
  --k-rail-neg: var(--sk-rail-neg, #7C9BEA);
  --k-strip: var(--strip-copper, #D69A66);
  --k-strip-wash: var(--strip-copper-wash, #4A3424);
  --k-shade: var(--sk-shade, #11100F);
  --k-metal: var(--sk-metal, #8F887B);
  --k-metal-hi: #B5AE9F;
  --k-copper: #D69A66;
  --k-zinc: #9EA3A8;
  --k-body: var(--sk-body, #5E5240);
  --k-scorch: var(--sk-scorch, #120D0B);
  --k-smoke: var(--sk-smoke, #8F887B);
  --k-black-part: #0F0E0D;
  --k-black-face: #2A2824;
  --k-print: #BDB6A8;
  --k-meter: var(--sk-meter, #2E2B25);
  --k-meter-rim: #3D3931;
  --k-lcd: var(--sk-lcd, #3B4232);
  --k-lcd-off: #2C3126;
  --k-lcd-ink: #E4EAD6;
  --k-knob: #0F0E0D;
  --k-battery-label: var(--sk-battery-label, #C9A227);
  --k-wood: #7A5638;
  --k-wood-dark: #5E412A;
  --k-relay: #2D3335;
  --k-glass: #2B3233;
  --k-water: #26304A;
  --k-water-edge: #4A5C86;
  --k-lemon: #C9A227;
  --k-lemon-dark: #A5841C;
  --k-ceramic: #5F82CF;
  --k-elco: #2A3666;
  --k-elco-stripe: #8D9CC6;
  --k-trimmer: #4C76CF;
  --k-speaker: #0F0E0D;
  --k-cone: #4A463F;

  --k-w-red: var(--sk-wire-red, #E2664C);
  --k-w-black: var(--sk-wire-black, #0B0A09);
  --k-w-green: var(--sk-wire-green, #4FB46E);
  --k-w-yellow: var(--sk-wire-yellow, #E8BC3A);
  --k-w-blue: #6F8FE0;
  --k-w-orange: #EB8F3A;
  --k-w-white: #E8E3D8;
  --k-w-purple: #A47BD0;

  --k-b-black: var(--sk-band-black, #0B0A09);
  --k-b-brown: var(--sk-band-brown, #A0683E);
  --k-b-red: var(--sk-band-red, #E0584A);
  --k-b-orange: var(--sk-band-orange, #EB8F3A);
  --k-b-yellow: var(--sk-band-yellow, #E3B92C);
  --k-b-green: var(--sk-band-green, #4FA35D);
  --k-b-blue: #6F8FE0;
  --k-b-violet: var(--sk-band-violet, #A47BD0);
  --k-b-grey: #9A9488;
  --k-b-white: #E8E3D8;
  --k-b-gold: var(--sk-band-gold, #CDA74A);
  --k-b-silver: #B8B4AC;

  --k-led-red: var(--sk-led, #E2533A);
  --k-lit-red: var(--sk-led-lit, #FF9A7A);
  --k-glow-red: var(--sk-glow, #C8563A);
  --k-led-green: #4FA868;
  --k-lit-green: #8FE3A2;
  --k-glow-green: #3F9E5C;
  --k-led-yellow: #D9AE2A;
  --k-lit-yellow: #FFE07A;
  --k-glow-yellow: #B8932A;
  --k-led-blue: #5079D6;
  --k-lit-blue: #A3BFFF;
  --k-glow-blue: #4466C0;
  --k-led-white: #CFCBC2;
  --k-lit-white: #FFFFFF;
  --k-glow-white: #A9A496;
  --k-led-orange: #E58A3C;
  --k-lit-orange: #FFB877;
  --k-glow-orange: #C06A2A;
  --k-led-photo: #3B4246;
  --k-glow-core: var(--sk-glow-core, #FFC59A);
  --k-dead: var(--sk-led-dead, #5A4A44);
  --k-body-metal: #4D6680;
  --k-glass-amber: #9A6A44;
  --k-brass: #B88E42;
  --k-station: #3A3E44;
  --k-lemon-face: #B8A24A;
  --k-skin: #9C7258;
  --k-skin-line: #6E4A36;
  --k-drop: #46607A;
  --k-ruler: #3C5262;
  --k-graphite: #C9CBD0;
  --k-pencil: #C9A227;
  --k-eraser: #A86A70;
  --k-pcb: #2A6440;
  --k-gold: #C9A044;
  --k-aa-alkaline: #2F5A7E;
  --k-aa-nimh: #3A7A50;
  --k-aa-lithium: #5A5F68;
  --k-room: #000000;
  --k-perf: var(--sk-perf, #6A5B36);
  --k-perf-edge: #4E4326;
  --k-solder: var(--sk-solder, #A9AEB4);
  --k-solder-hi: #E4E8EC;
  --k-solder-dull: #7D8186;
  --k-flux: #7A5228;
  --k-sponge: #B39434;
  --k-grip: #3A6A52;
  --k-shrink: #0F0E0D;
  --k-gun: #C24A30;
  --k-handle: #E2664C;
  --k-singe: #5A3A22;
  --k-cardboard: #6E5A42;
  --k-cardboard-dark: #5A4834;
  --k-foil: #8E949A;
  --k-silver: #8F8E88;
  --k-spoon: #CFC9BC;
  --k-marble: #4F7A82;
  --k-coat: #5E8DD0;
  --k-string: #9A8F78;
  --k-mno2: #121110;
  --k-zinc-gel: #7E8388;
  --k-separator: #C9C3B5;
  --k-balloon-red: #C8503F;
  --k-balloon-blue: #5A7FD0;
  --k-balloon-yellow: #C9A227;
  --k-wool: #8A3F35;
  --k-wall: #3A3631;
  --k-wall-line: #4C4740;
  --k-tape: #D9CFB4;
  --k-warm: #D9683C;
  --k-dipsw: #3F69C8;
  --k-seg-body: #26272A;
  --k-seg-face: #34363B;
  --k-seg-off: #5A5650;
  --k-probe: #CFC9BB;
  --k-lamp-off: #4A4038;
`;

/** The palette without the host's tokens: for a bench forced to one theme whatever the page does. */
const own = (block: string) => block.replace(/var\(--[a-z0-9-]+, (#[0-9A-Fa-f]{3,8})\)/g, "$1");

export const INK_CSS = `
.ohi-root{${LIGHT}
  position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;outline:none;
  background-color:var(--k-paper);color:var(--k-ink);
  background-image:linear-gradient(var(--k-grid) 1px,transparent 1px),linear-gradient(90deg,var(--k-grid) 1px,transparent 1px);
  font-family:var(--font-serif,"Literata",Georgia,"Times New Roman",serif);
  -webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
:root[data-theme="dark"] .ohi-root,.ohi-root[data-theme="dark"]{${DARK}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .ohi-root:not([data-theme="light"]){${DARK}}}
.ohi-root:focus-visible{box-shadow:inset 0 0 0 2px var(--k-focus)}
.ohi-svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:hidden}
.ohi-root svg text{font-family:var(--font-serif,"Literata",Georgia,serif)}
.ohi-root .ohi-hand{font-family:var(--font-hand,"Kalam","Segoe Print","Bradley Hand",cursive)}

/* Lines: outlines keep their pen width at every zoom; physical things (leads, wires, cables) scale with the desk. */
.ohi-root .ln{fill:none;stroke:var(--k-ink);stroke-width:var(--lw,1.6px);vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.ohi-root .ln-thin{fill:none;stroke:var(--k-ink);stroke-width:var(--lw-thin,1px);vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.ohi-root .ln-faint{fill:none;stroke:var(--k-ink-3);stroke-width:var(--lw-thin,1px);vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;opacity:.7}
.ohi-root .ln-soft{fill:none;stroke:var(--k-ink);stroke-width:var(--lw-thin,1px);vector-effect:non-scaling-stroke;opacity:.35;stroke-linecap:round;stroke-linejoin:round}
.ohi-root .lead{fill:none;stroke:var(--k-ink-2);stroke-width:max(.55px,calc(var(--px,.1) * 1.6px));stroke-linecap:round;stroke-linejoin:round}
.ohi-root .edge{fill:none;stroke:var(--k-ink);stroke-width:calc(var(--w,1px) + var(--px,.1) * 3.2px);stroke-linecap:round;stroke-linejoin:round}
.ohi-root .core{fill:none;stroke-width:var(--w,1px);stroke-linecap:round;stroke-linejoin:round}
.ohi-root .sheen{fill:none;stroke:var(--k-slip);stroke-width:calc(var(--px,.1) * 2px);stroke-linecap:round;opacity:.7}

.ohi-root .f-slip{fill:var(--k-slip)}.ohi-root .f-paper{fill:var(--k-paper)}.ohi-root .f-sunk{fill:var(--k-sunk)}
.ohi-root .f-board{fill:var(--k-board)}.ohi-root .f-hole{fill:var(--k-hole)}.ohi-root .f-hole-in{fill:var(--k-hole-in)}
.ohi-root .f-channel{fill:var(--k-channel)}.ohi-root .f-shade{fill:var(--k-shade)}.ohi-root .f-metal{fill:var(--k-metal)}
.ohi-root .f-metal-hi{fill:var(--k-metal-hi)}.ohi-root .f-copper{fill:var(--k-copper)}.ohi-root .f-zinc{fill:var(--k-zinc)}
.ohi-root .f-body{fill:var(--k-body)}.ohi-root .f-black{fill:var(--k-black-part)}.ohi-root .f-black-face{fill:var(--k-black-face)}
.ohi-root .f-ink{fill:var(--k-ink)}.ohi-root .f-ink2{fill:var(--k-ink-2)}.ohi-root .f-ink3{fill:var(--k-ink-3)}
.ohi-root .f-meter{fill:var(--k-meter)}.ohi-root .f-meter-rim{fill:var(--k-meter-rim)}.ohi-root .f-lcd{fill:var(--k-lcd)}
.ohi-root .f-lcd-off{fill:var(--k-lcd-off)}.ohi-root .f-lcd-ink{fill:var(--k-lcd-ink)}.ohi-root .f-knob{fill:var(--k-knob)}
.ohi-root .f-batt-label{fill:var(--k-battery-label)}.ohi-root .f-wood{fill:var(--k-wood)}.ohi-root .f-wood-dark{fill:var(--k-wood-dark)}
.ohi-root .f-relay{fill:var(--k-relay);fill-opacity:.88}.ohi-root .f-glass{fill:var(--k-glass);fill-opacity:.9}
.ohi-root .f-water{fill:var(--k-water)}.ohi-root .f-lemon{fill:var(--k-lemon)}.ohi-root .f-lemon-dark{fill:var(--k-lemon-dark)}
.ohi-root .f-ceramic{fill:var(--k-ceramic)}.ohi-root .f-elco{fill:var(--k-elco)}.ohi-root .f-elco-stripe{fill:var(--k-elco-stripe)}
.ohi-root .f-trimmer{fill:var(--k-trimmer)}.ohi-root .f-speaker{fill:var(--k-speaker)}.ohi-root .f-cone{fill:var(--k-cone)}
.ohi-root .f-scorch{fill:var(--k-scorch)}.ohi-root .f-dead{fill:var(--k-dead)}.ohi-root .f-strip{fill:var(--k-strip-wash)}
.ohi-root .f-blue-wash{fill:var(--k-blue-wash)}.ohi-root .f-print{fill:var(--k-print)}.ohi-root .f-none{fill:none}
.ohi-root .f-body-metal{fill:var(--k-body-metal)}.ohi-root .f-glass-amber{fill:var(--k-glass-amber)}.ohi-root .f-photo{fill:var(--k-led-photo)}
.ohi-root .f-red{fill:var(--k-w-red)}.ohi-root .f-red-floor{fill:var(--k-w-red);filter:brightness(.88)}.ohi-root .f-brass{fill:var(--k-brass)}
.ohi-root .f-station{fill:var(--k-station)}.ohi-root .f-lemon-face{fill:var(--k-lemon-face)}.ohi-root .f-skin{fill:var(--k-skin)}
.ohi-root .s-skin{stroke:var(--k-skin-line)}.ohi-root .f-drop{fill:var(--k-drop)}.ohi-root .f-ruler{fill:var(--k-ruler);fill-opacity:.85}
.ohi-root .s-graphite{stroke:var(--k-graphite);fill:none}.ohi-root .f-pencil{fill:var(--k-pencil)}.ohi-root .f-eraser{fill:var(--k-eraser)}
.ohi-root .f-pcb{fill:var(--k-pcb)}.ohi-root .f-gold{fill:var(--k-gold)}.ohi-root .f-blue{fill:var(--k-blue)}
.ohi-root .s-water{stroke:var(--k-water-edge);opacity:.9}.ohi-root .s-slip{stroke:var(--k-slip)}.ohi-root .s-print{stroke:var(--k-print);fill:none}
.ohi-root .t-elco{fill:var(--k-elco)}.ohi-root .t-batt{fill:var(--k-black-part)}.ohi-root .t-red{fill:var(--k-red)}.ohi-root .t-blue{fill:var(--k-blue)}
.ohi-root .lcd-label{fill:var(--k-lcd-ink);opacity:.7}
.ohi-root .f-tape{fill:var(--k-tape)}.ohi-root .f-warm{fill:var(--k-warm)}.ohi-root .f-dipsw{fill:var(--k-dipsw)}
.ohi-root .f-seg-body{fill:var(--k-seg-body)}.ohi-root .f-seg-face{fill:var(--k-seg-face)}.ohi-root .f-seg-off{fill:var(--k-seg-off)}
.ohi-root .f-probe{fill:var(--k-probe)}.ohi-root .f-lamp-off{fill:var(--k-lamp-off)}
.ohi-root .f-amber{fill:var(--k-amber)}.ohi-root .f-amber-glow{fill:var(--k-amber);opacity:.35}
/* Pin numbers and names on chips and displays: up close (data-near) or in a spotlight. */
.ohi-root .pinno{display:none}
.ohi-root text.pinno{fill:var(--k-print);paint-order:stroke;stroke:var(--k-ink);stroke-width:calc(var(--px,.1) * 2.6px);stroke-linejoin:round}
.ohi-root[data-near="1"] .ohi-svg .pinno{display:inline}
.ohi-item .pinno{display:none !important}
.ohi-root .dots{stroke:var(--k-ink-3);stroke-width:calc(var(--px,.1) * 3px);stroke-linecap:round;fill:none}
.ohi-root .s-rail-pos{stroke:var(--k-rail-pos)}.ohi-root .s-rail-neg{stroke:var(--k-rail-neg)}
.ohi-root .t-rail-pos{fill:var(--k-rail-pos)}.ohi-root .t-rail-neg{fill:var(--k-rail-neg)}
.ohi-root .print{fill:var(--k-ink-3)}
.ohi-root .print-light{fill:var(--k-print)}

/* Unit 3: the solder station, perfboard and wire. */
.ohi-root .f-perf{fill:var(--k-perf)}.ohi-root .f-perf-edge{fill:var(--k-perf-edge)}.ohi-root .f-solder{fill:var(--k-solder)}
.ohi-root .f-solder-hi{fill:var(--k-solder-hi)}.ohi-root .f-solder-dull{fill:var(--k-solder-dull)}.ohi-root .f-flux{fill:var(--k-flux)}
.ohi-root .f-sponge{fill:var(--k-sponge)}.ohi-root .f-grip{fill:var(--k-grip)}.ohi-root .f-shrink{fill:var(--k-shrink)}
.ohi-root .f-gun{fill:var(--k-gun)}.ohi-root .f-handle{fill:var(--k-handle)}.ohi-root .f-singe{fill:var(--k-singe)}
.ohi-root .s-solder{fill:none;stroke:var(--k-solder);stroke-linecap:round}
.ohi-root .s-copper{fill:none;stroke:var(--k-copper);stroke-linecap:round}
.ohi-root .bare{fill:none;stroke:var(--k-copper);stroke-width:max(.6px,calc(var(--px,.1) * 2.2px));stroke-linecap:round}
.ohi-root .air{fill:none;stroke:var(--k-red);stroke-width:var(--lw-thin,1px);vector-effect:non-scaling-stroke;stroke-linecap:round;opacity:.65}
.ohi-root .ghost{fill:none;stroke:var(--k-red);stroke-width:var(--lw-thin,1px);vector-effect:non-scaling-stroke;stroke-dasharray:3 2.4;opacity:.75}
.ohi-root .plan-line{fill:none;stroke:var(--k-blue);stroke-width:var(--lw,1.6px);vector-effect:non-scaling-stroke;stroke-linecap:round;opacity:.55}
.ohi-root .sheen-hi{fill:none;stroke:var(--k-solder-hi);stroke-linecap:round}
.ohi-root .f-cardboard{fill:var(--k-cardboard)}.ohi-root .f-cardboard-dark{fill:var(--k-cardboard-dark)}.ohi-root .f-foil{fill:var(--k-foil)}
.ohi-root .f-silver{fill:var(--k-silver)}.ohi-root .f-spoon{fill:var(--k-spoon)}.ohi-root .f-marble{fill:var(--k-marble);fill-opacity:.85}
.ohi-root .f-coat{fill:var(--k-coat)}.ohi-root .s-coat{stroke:var(--k-coat);fill:none}.ohi-root .s-string{stroke:var(--k-string);fill:none}
.ohi-root .f-mno2{fill:var(--k-mno2)}.ohi-root .f-zinc-gel{fill:var(--k-zinc-gel)}.ohi-root .f-sep{fill:var(--k-separator)}
.ohi-root .f-wool{fill:var(--k-wool)}.ohi-root .f-wall{fill:var(--k-wall)}.ohi-root .s-wall{stroke:var(--k-wall-line);fill:none}
.ohi-root .f-balloon-red{fill:var(--k-balloon-red)}.ohi-root .f-balloon-blue{fill:var(--k-balloon-blue)}.ohi-root .f-balloon-yellow{fill:var(--k-balloon-yellow)}
.ohi-root .s-ink{stroke:var(--k-ink);fill:none}.ohi-root .s-red{stroke:var(--k-red);fill:none}.ohi-root .f-red-pencil{fill:var(--k-red)}

/* Teaching overlays: flow dots (paper dots ringed in ink), electrons (ink dashes), push (red pencil hatching), the
   loop tracer (a red pencil line). Physical sizes: they scale with the desk. */
.ohi-root .ov{pointer-events:none}
.ohi-root .flow-halo{fill:none;stroke:var(--k-ink);stroke-linecap:round}
.ohi-root .flow-dot{fill:none;stroke:var(--k-slip);stroke-linecap:round}
.ohi-root .flow-e{fill:none;stroke:var(--k-ink);stroke-linecap:butt}
.ohi-root .flow-e-halo{fill:none;stroke:var(--k-slip);stroke-linecap:round}
.ohi-root .push-hatch{fill:none;stroke:var(--k-red);opacity:.62}
.ohi-root .push-hill{fill:var(--k-red-wash);fill-opacity:.55;stroke:var(--k-red);stroke-width:1.4px;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.ohi-root .push-hill-hatch{fill:none;stroke:var(--k-red);stroke-width:.32;opacity:.8}
.ohi-root .trace{fill:none;stroke:var(--k-red);stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.ohi-root .trace-mark{fill:none;stroke:var(--k-red);stroke-width:2.2px;vector-effect:non-scaling-stroke;stroke-linecap:round}
/* The striped flow styles (light units with a dark rim, inside the cable) and the tracer's run (red units with a light
   rim, so they read on a red lead), ending in a red disc with a light cross at a gap, or a red ring where it closed. */
.ohi-root .fl-fill{fill:var(--k-flow);stroke:var(--k-flow-rim);stroke-width:max(.06px,calc(var(--px,.1) * .9px));stroke-linejoin:round}
.ohi-root .fl-core{fill:none;stroke:var(--k-flow);stroke-linecap:butt}
.ohi-root .fl-rim{fill:none;stroke:var(--k-flow-rim);stroke-linecap:butt}
.ohi-root .fl-glow{fill:none;stroke:var(--k-flow);stroke-linecap:round}
.ohi-root .fl-lane{fill:none;stroke:var(--k-flow);stroke-linecap:round;stroke-linejoin:round}
.ohi-root .fl-run{fill:var(--k-red);stroke:var(--k-flow);stroke-width:max(.08px,calc(var(--px,.1) * 1.2px));stroke-linejoin:round}
.ohi-root .fl-head{fill:var(--k-flow);stroke:var(--k-red);stroke-width:max(.1px,calc(var(--px,.1) * 1.6px));stroke-linejoin:round}
.ohi-root .fl-stop{fill:var(--k-red);stroke:var(--k-flow);stroke-width:max(.12px,calc(var(--px,.1) * 1.4px))}
.ohi-root .fl-stop-x{fill:none;stroke:var(--k-flow);stroke-linecap:round}
.ohi-root .fl-home{fill:none;stroke:var(--k-red)}
.ohi-root .fl-home-halo{fill:none;stroke:var(--k-flow)}

/* Breadboard x-ray: the metal clips under the plastic. */
.ohi-root .strip{fill:var(--k-strip-wash);stroke:var(--k-strip);stroke-width:var(--lw-thin,1px);vector-effect:non-scaling-stroke}
.ohi-root .strip.lit{fill:var(--k-blue-wash);stroke:var(--k-blue);stroke-width:var(--lw,1.6px)}
.ohi-root .pin-lit{fill:none;stroke:var(--k-blue);stroke-width:var(--lw,1.6px);vector-effect:non-scaling-stroke}

/* Light. */
.ohi-root .glow{pointer-events:none}
.ohi-root .ray{fill:none;stroke-width:calc(var(--px,.1) * 2px);stroke-linecap:round}

/* Marks: blue ink is you, red pencil is the teacher. */
.ohi-root .sel{fill:none;stroke:var(--k-blue);stroke-width:2px;vector-effect:non-scaling-stroke;stroke-linecap:round}
.ohi-root .snap{fill:none;stroke:var(--k-blue);stroke-width:2.2px;vector-effect:non-scaling-stroke}
.ohi-root .cursor{fill:none;stroke:var(--k-focus);stroke-width:2.4px;vector-effect:non-scaling-stroke;stroke-dasharray:3 3}
.ohi-root .hint{fill:none;stroke:var(--k-red);stroke-width:2.2px;vector-effect:non-scaling-stroke;stroke-linecap:round}
.ohi-root .spot{fill:none;stroke:var(--k-red);stroke-width:2px;vector-effect:non-scaling-stroke;opacity:.85}
.ohi-root .draft{fill:none;stroke:var(--k-blue);stroke-width:2px;vector-effect:non-scaling-stroke;stroke-dasharray:4 5;stroke-linecap:round}
.ohi-root .smoke{fill:none;stroke:var(--k-smoke);stroke-width:calc(var(--px,.1) * 2.2px);stroke-linecap:round}
.ohi-root .crack{fill:none;stroke:var(--k-slip);stroke-width:calc(var(--px,.1) * 1.6px);stroke-linecap:round;stroke-linejoin:round}

.ohi-svg [data-own]{transition:opacity var(--dur-ui,160ms) var(--ease-out,ease-out)}
.ohi-root .dial-knob{transition:transform 220ms var(--ease-out,cubic-bezier(.2,.7,.2,1))}
.ohi-root .actuator{transition:transform 140ms var(--ease-out,cubic-bezier(.2,.7,.2,1))}

/* Level of detail: fine print only when it can be read. */
.ohi-root[data-lod="0"] .ohi-svg .lod1,.ohi-root[data-lod="0"] .ohi-svg .lod2,.ohi-root[data-lod="1"] .ohi-svg .lod2,.ohi-item .lod1,.ohi-item .lod2{display:none}
.ohi-root[data-lod="0"] .ohi-svg{--lw:1.1px;--lw-thin:.7px}
.ohi-item svg{--lw:1.1px;--lw-thin:.7px}
.ohi-root[data-lod="1"] .ohi-svg{--lw:1.35px;--lw-thin:.85px}

@media (prefers-reduced-motion: no-preference){
  .ohi-root .smoke-anim path{animation:ohi-smoke 2.6s var(--ease-out,ease-out) infinite}
  .ohi-root .smoke-anim path:nth-child(2){animation-delay:.85s}
  .ohi-root .smoke-anim path:nth-child(3){animation-delay:1.7s}
  .ohi-root .hint-pulse{animation:ohi-pulse 1.6s var(--ease-out,ease-out) infinite}
  .ohi-root .spot-pulse{animation:ohi-breathe 2.4s var(--ease-out,ease-out) infinite}
}
@media (prefers-reduced-motion: reduce){
  .ohi-svg [data-own],.ohi-root .dial-knob,.ohi-root .actuator{transition:none}
  .ohi-root .smoke path{opacity:.75}
}
@keyframes ohi-smoke{0%{transform:translate(0,0);opacity:0}20%{opacity:.9}100%{transform:translate(0,-9px);opacity:0}}
@keyframes ohi-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes ohi-breathe{0%,100%{opacity:.9}50%{opacity:.45}}

.ohi-svg .ohi-room{fill:var(--k-room);pointer-events:none;transition:opacity 400ms}
/* SVG outlines would scale with the drawing: the focus ring is drawn as a mark instead. */
.ohi-svg [tabindex]{outline:none}
.ohi-svg .focus-ring{fill:none;stroke:var(--k-focus);stroke-width:2.4px;vector-effect:non-scaling-stroke;stroke-dasharray:5 4}
.ohi-svg .ohi-cursor:focus-visible .cursor{stroke-width:3px}

/* Chrome: quiet slips that come and go. */
.ohi-ui{position:absolute;inset:0;pointer-events:none;font:400 15px/1.3 var(--font-serif,"Literata",Georgia,serif);color:var(--k-ink)}
.ohi-slip{pointer-events:auto;background:var(--k-slip);border:1px solid var(--k-rule-soft);border-radius:2px;box-shadow:2px 2px 0 var(--k-shadow)}
.ohi-row{display:flex;gap:2px;align-items:center;padding:2px}
.ohi-btn{all:unset;box-sizing:border-box;cursor:pointer;min-width:44px;height:44px;padding:0 10px;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--k-ink-2);font:inherit;font-size:14px}
.ohi-btn:hover{color:var(--k-ink);background:var(--k-sunk)}
.ohi-btn:focus-visible{outline:2px solid var(--k-focus);outline-offset:-2px}
.ohi-btn[aria-pressed=true]{color:var(--k-blue);background:var(--k-blue-wash)}
.ohi-btn:disabled{opacity:.35;cursor:default}
.ohi-btn svg{flex:none}
.ohi-sep{width:1px;height:24px;background:var(--k-rule-soft);margin:0 2px}
.ohi-tools{position:absolute;top:10px;left:10px;opacity:.9;transition:opacity var(--dur-ui,160ms)}
.ohi-tools:not(:hover):not(:focus-within){opacity:.72}
.ohi-view{position:absolute;top:10px;right:10px}
.ohi-tray{position:absolute;left:10px;top:66px;bottom:10px;width:176px;display:flex;flex-direction:column;overflow:hidden}
.ohi-tray h2{margin:10px 12px 2px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--k-ink-3)}
.ohi-tray-list{overflow:auto;padding:4px 6px 8px;display:grid;grid-template-columns:1fr 1fr;gap:2px}
.ohi-item{all:unset;box-sizing:border-box;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:2px;min-height:76px;padding:4px 2px 6px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;text-align:center;font-size:12.5px;line-height:1.15;color:var(--k-ink-2);overflow-wrap:anywhere;hyphens:auto}
.ohi-item:hover{background:var(--k-sunk);color:var(--k-ink)}
.ohi-item[aria-pressed=true]{background:var(--k-blue-wash);color:var(--k-blue);outline:1.5px solid var(--k-blue)}
.ohi-item:focus-visible{outline:2px solid var(--k-focus)}
.ohi-item svg{width:64px;height:40px;overflow:visible}
.ohi-item small{font-size:11.5px;color:var(--k-ink-3)}
.ohi-sel{position:absolute;bottom:calc(12px + var(--ohi-inset-bottom,0px));left:calc((100% - var(--ohi-inset-right,0px)) / 2);transform:translateX(-50%);max-width:calc(100% - 24px - var(--ohi-inset-right,0px))}
.ohi-sel .ohi-name{padding:0 10px 0 12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
.ohi-menu{position:absolute;min-width:180px;padding:4px;display:flex;flex-direction:column}
.ohi-menu .ohi-btn{justify-content:flex-start}
.ohi-hint{position:absolute;top:14px;left:50%;transform:translateX(-50%);padding:6px 12px;font-family:var(--font-hand,"Kalam",cursive);font-size:18px;color:var(--k-blue);background:none;border:none;box-shadow:none;white-space:nowrap;pointer-events:none}
.ohi-tag{position:absolute;padding:0 4px;font-family:var(--font-hand,"Kalam",cursive);font-size:17px;line-height:22px;color:var(--k-blue);transform:translate(10px,-30px);white-space:nowrap;pointer-events:none;text-shadow:0 0 3px var(--k-paper),0 0 3px var(--k-paper)}
.ohi-select{all:unset;height:36px;padding:0 10px;border-radius:2px;background:var(--k-sunk);font:inherit;font-size:14px;cursor:pointer}
.ohi-sw{all:unset;cursor:pointer;width:24px;height:24px;border-radius:50%;border:1.5px solid var(--k-ink);margin:10px 3px;box-sizing:border-box}
.ohi-sw[aria-pressed=true]{box-shadow:0 0 0 2px var(--k-paper),0 0 0 3.5px var(--k-blue)}
.ohi-sw:focus-visible{outline:2px solid var(--k-focus);outline-offset:2px}
.ohi-seg{display:inline-flex;gap:2px;padding:2px;background:var(--k-sunk);border-radius:2px}
.ohi-chip{min-width:44px;padding:0 9px;font-size:13px}
.ohi-sel .ohi-row{flex-wrap:wrap;justify-content:center}
.ohi-readouts{position:absolute;inset:0;pointer-events:none}
.ohi-readout{position:absolute;transform:translate(-50%,calc(-100% - 8px));background:var(--k-slip);border:1px solid var(--k-rule-soft);box-shadow:2px 2px 0 var(--k-shadow);font-size:13px;line-height:18px;padding:1px 7px;white-space:nowrap;color:var(--k-ink)}
.ohi-stress{width:120px;height:14px;padding:0;transform:translate(-50%,-50%)}
.ohi-readouts[data-compact] .ohi-stress{width:64px;height:10px}
.ohi-stress[data-spot]{outline:2px solid var(--k-red);outline-offset:5px;border-radius:2px}
.ohi-stress i{position:absolute;left:0;top:0;bottom:0;background:var(--k-b-green)}
.ohi-stress[data-tone="mid"] i{background:var(--k-b-orange)}
.ohi-stress[data-tone="high"] i{background:var(--k-b-red)}
.ohi-stress[data-tone="dead"] i{background:var(--k-ink-3)}
.ohi-stress b{position:absolute;top:0;bottom:0;width:1px;background:var(--k-ink)}
.ohi-heat em{font-style:normal;font-family:var(--font-hand,"Kalam",cursive);font-size:15px}
.ohi-heat[data-feel="cool"] em{color:var(--k-blue)}
.ohi-heat[data-feel="warm"] em{color:var(--k-ink-2)}
.ohi-heat[data-feel="hot"],.ohi-heat[data-feel="ouch"]{border-color:var(--k-red)}
.ohi-heat[data-feel="hot"] em,.ohi-heat[data-feel="ouch"] em{color:var(--k-red)}
.ohi-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.ohi-compact .ohi-tray{left:8px;right:8px;top:auto;bottom:8px;width:auto;height:86px}
.ohi-compact .ohi-tray h2{display:none}
.ohi-compact .ohi-tray-list{display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:4px}
.ohi-compact .ohi-item{min-width:72px;min-height:74px}
.ohi-compact .ohi-tray-list[data-scroll] .ohi-item{touch-action:pan-x}
.ohi-compact .ohi-tools{left:8px;top:8px}
.ohi-compact .ohi-view{right:8px;top:8px}
.ohi-compact .ohi-sel{bottom:calc(102px + var(--ohi-inset-bottom,0px))}
.ohi-compact.ohi-notray .ohi-sel{bottom:12px}
.ohi-compact .ohi-hint{top:58px;white-space:normal;width:calc(100% - 32px);text-align:center;font-size:17px}
.ohi-compact .ohi-label{display:none}
.ohi-notray .ohi-tray{display:none}
/* The theme prop forces a page, whatever the host page shows. */
.ohi-root.ohi-root[data-theme="light"]{${own(LIGHT)}}
.ohi-root.ohi-root[data-theme="dark"]{${own(DARK)}}
`;

/** Colour tokens by name, for inline fills and gradient stops. */
export const LED_TOKEN = (color: string, state: "led" | "lit" | "glow") => `var(--k-${state}-${color})`;
export const WIRE_TOKEN = (color: string) => `var(--k-w-${color})`;
export const BAND_TOKEN = (color: string) => `var(--k-b-${color})`;
