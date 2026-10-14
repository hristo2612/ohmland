// The Lab Notebook look for the 3D bench: the page palette, a procedural grid paper, a tone curve that keeps the page
// colour exact, matte paper-friendly materials and soft contact shadows. No React here.

import * as THREE from "three";

// ---------------------------------------------------------------------------------------------------------------
// Palette (classic notebook tokens). The bench reads the page's CSS custom properties when it can, so it follows the
// app's theme; these are the fallbacks.

export type PaperPalette = {
  dark: boolean;
  paper: string;
  grid: string;
  margin: string;
  ink: string;
  /** Blue ink: the learner (selection). */
  blue: string;
  /** Red pencil: the teacher and the robot (hints, spotlight). */
  red: string;
  /** Contact shadow tint. */
  shadow: string;
  /** The flow: a light electric tint riding inside the cables (the same on both pages, like the cables). */
  flow: string;
};

export const PAPER_LIGHT: PaperPalette = {
  dark: false,
  paper: "#F6F2E9",
  grid: "#E7E0D3",
  margin: "#E2A49C",
  ink: "#24221E",
  blue: "#1F3C9A",
  red: "#B23A1C",
  shadow: "#3A3226",
  flow: "#E2F6FF",
};

export const PAPER_DARK: PaperPalette = {
  dark: true,
  paper: "#1B1A18",
  grid: "#2A2826",
  margin: "#6A3F3A",
  ink: "#ECE6DA",
  blue: "#9AB3F4",
  red: "#F2906F",
  shadow: "#000000",
  flow: "#E2F6FF",
};

const CSS_VARS: [keyof PaperPalette, string][] = [
  ["paper", "--paper"],
  ["grid", "--grid"],
  ["margin", "--margin-rose"],
  ["ink", "--ink"],
  ["blue", "--blue"],
  ["red", "--red"],
  ["flow", "--flow"],
];

/** The palette under `el`: the page's notebook tokens if it defines them, else light or dark fallbacks. */
export function readPalette(el: Element | null, theme?: "light" | "dark"): PaperPalette {
  if (theme) return theme === "dark" ? PAPER_DARK : PAPER_LIGHT;
  if (!el || typeof getComputedStyle === "undefined") return PAPER_LIGHT;
  const cs = getComputedStyle(el);
  const paper = cs.getPropertyValue("--paper").trim();
  if (!paper) return document.documentElement.dataset.theme === "dark" ? PAPER_DARK : PAPER_LIGHT;
  const dark = new THREE.Color(paper).getHSL({ h: 0, s: 0, l: 0 }).l < 0.4;
  const base = dark ? PAPER_DARK : PAPER_LIGHT;
  const out: PaperPalette = { ...base };
  for (const [key, name] of CSS_VARS) {
    const v = cs.getPropertyValue(name).trim();
    if (v && CSS.supports?.("color", v)) (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

export function paletteKey(p: PaperPalette): string {
  return `${p.paper}|${p.grid}|${p.margin}|${p.ink}|${p.blue}|${p.red}|${p.flow}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Tone curve: identity below a high knee so the page colour survives exactly, a soft per-channel shoulder above it
// (a lit LED). Installed as three's CustomToneMapping for direct rendering; post-processing applies the same curve.

export const PAPER_TONE_GLSL = /* glsl */ `
vec3 paperTone( vec3 color ) {
  const float k = 0.94;
  vec3 c = max( color, 0.0 );
  vec3 over = max( c - k, 0.0 );
  vec3 comp = k + ( 1.0 - k ) * ( 1.0 - exp( -over / ( 1.0 - k ) ) );
  return mix( c, comp, step( k, c ) );
}`;

let toneInstalled = false;
/** Makes THREE.CustomToneMapping the paper curve (once per page; nothing else here uses CustomToneMapping). */
export function installPaperTone(): void {
  if (toneInstalled) return;
  toneInstalled = true;
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  const stub = "vec3 CustomToneMapping( vec3 color ) { return color; }";
  if (!chunk.includes(stub)) return;
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(
    stub,
    `${PAPER_TONE_GLSL}\nvec3 CustomToneMapping( vec3 color ) { return paperTone( color * toneMappingExposure ); }`,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Grid paper: drawn in the shader, so lines stay crisp at any zoom and nothing is uploaded.

/** One grid cell in millimetres: about 24 CSS px at the default framing of a lab. */
export const GRID_MM = 5;
export const PAPER_SIZE = 3200;

const PAPER_VERT = /* glsl */ `
varying vec2 vXZ;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vXZ = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const PAPER_FRAG = /* glsl */ `
uniform vec3 paper;
uniform vec3 grid;
uniform vec3 margin;
uniform float cell;
uniform float line;
uniform float marginX;
uniform float marginOn;
uniform float light;
varying vec2 vXZ;

// Coverage of a rule through every multiple of the cell, antialiased: about one pixel wide from any distance (like a
// printed rule), and at least "line" mm wide close up.
float lines( float coord ) {
  float fw = max( fwidth( coord ), 1e-4 );
  float d = abs( fract( coord / cell + 0.5 ) - 0.5 ) * cell;
  float w = max( line, fw );
  float a = 1.0 - smoothstep( w * 0.5 - fw * 0.5, w * 0.5 + fw * 0.5, d );
  // Fade out where cells get too small to read (no moire).
  return a * clamp( 1.0 - ( fw / cell - 0.1 ) / 0.12, 0.0, 1.0 );
}

void main() {
  float g = max( lines( vXZ.x ), lines( vXZ.y ) );
  vec3 col = mix( paper, grid, g );
  float fw = max( fwidth( vXZ.x ), 1e-4 );
  float mw = max( 0.6, fw * 1.2 );
  float m = 1.0 - smoothstep( mw * 0.5 - fw * 0.5, mw * 0.5 + fw * 0.5, abs( vXZ.x - marginX ) );
  col = mix( col, margin, m * marginOn * min( 1.0, 0.6 / mw ) );
  gl_FragColor = vec4( col * light, 1.0 );
  #include <colorspace_fragment>
}`;

export function paperMaterial(p: PaperPalette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: "paper",
    uniforms: {
      paper: { value: new THREE.Color(p.paper) },
      grid: { value: new THREE.Color(p.grid) },
      margin: { value: new THREE.Color(p.margin) },
      cell: { value: GRID_MM },
      line: { value: 0.07 },
      marginX: { value: -1e5 },
      marginOn: { value: 0 },
      light: { value: 1 },
    },
    vertexShader: PAPER_VERT,
    fragmentShader: PAPER_FRAG,
    // The page writes no depth: the ink pass treats it as background, and nothing can sink into it.
    depthWrite: false,
    toneMapped: false,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Materials: matte, calm, slightly quieter colours, metals as soft pencil grey. Applied once per material.

const paperized = new WeakSet<THREE.Material>();
const PENCIL = new THREE.Color("#d9d4ca");
const PENCIL_DARK = new THREE.Color("#b8b2a6");
const hsl = { h: 0, s: 0, l: 0 };

/** Mark a material whose colour must not be shifted (resistor bands, printed codes). */
export function keepColor<T extends THREE.Material>(m: T): T {
  m.userData.keepColor = true;
  return m;
}

export function paperizeMaterial(m: THREE.Material, dark = false): void {
  if (paperized.has(m)) return;
  paperized.add(m);
  const s = m as THREE.MeshPhysicalMaterial;
  if (!s.isMeshStandardMaterial) return;
  const keep = !!m.userData.keepColor;
  if (s.isMeshPhysicalMaterial) {
    s.clearcoat *= 0.18;
    s.clearcoatRoughness = Math.max(s.clearcoatRoughness, 0.55);
    if (s.transmission > 0) {
      // Glass as plain see-through plastic: refraction would draw the whole scene a second time every frame, and a
      // page drawing does not need it.
      const clear = s.transmission;
      s.transmission = 0;
      s.transparent = true;
      s.opacity = Math.min(s.opacity, 1 - 0.68 * clear);
      s.depthWrite = false;
      s.needsUpdate = true;
    }
  }
  if (s.metalness > 0.5) {
    // Tinned leads, clips and terminals: a light pencil grey that still reads as metal.
    s.metalness = 0.42;
    s.roughness = Math.max(s.roughness, 0.42);
    if (!keep) s.color.lerp(dark ? PENCIL_DARK : PENCIL, 0.32);
  } else {
    s.roughness = Math.max(s.roughness, 0.6);
  }
  if (!keep) {
    s.color.getHSL(hsl);
    s.color.setHSL(hsl.h, hsl.s * 0.88, hsl.l);
  }
}

/** Paperize every mesh material under `root` that has not been seen yet. */
export function paperizeScene(root: THREE.Object3D, dark = false): void {
  root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    if (Array.isArray(mat)) for (const x of mat) paperizeMaterial(x, dark);
    else paperizeMaterial(mat, dark);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Contact shadows: the scene's depth seen from just above a plane, darker when closer, blurred twice. They do not
// depend on the camera, so they are drawn again only when something on the bench moves.

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 step;
varying vec2 vUv;
void main() {
  vec4 s = texture2D( tDiffuse, vUv ) * 0.1633;
  s += ( texture2D( tDiffuse, vUv - step ) + texture2D( tDiffuse, vUv + step ) ) * 0.1531;
  s += ( texture2D( tDiffuse, vUv - 2.0 * step ) + texture2D( tDiffuse, vUv + 2.0 * step ) ) * 0.12245;
  s += ( texture2D( tDiffuse, vUv - 3.0 * step ) + texture2D( tDiffuse, vUv + 3.0 * step ) ) * 0.0918;
  s += ( texture2D( tDiffuse, vUv - 4.0 * step ) + texture2D( tDiffuse, vUv + 4.0 * step ) ) * 0.051;
  gl_FragColor = s;
}`;
const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

export class ContactShadow {
  readonly mesh: THREE.Mesh;
  private target: THREE.WebGLRenderTarget;
  private targetBlur: THREE.WebGLRenderTarget;
  private camera: THREE.OrthographicCamera;
  private depth: THREE.MeshDepthMaterial;
  private blur: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private hidden: THREE.Object3D[] = [];

  constructor(
    public width: number,
    public depthMm: number,
    resolution: number,
    public far: number,
    public blurPx: number,
    opacity: number,
  ) {
    const aspect = width / depthMm;
    const rw = Math.round(aspect >= 1 ? resolution : resolution * aspect);
    const rh = Math.round(aspect >= 1 ? resolution / aspect : resolution);
    this.target = new THREE.WebGLRenderTarget(rw, rh, { depthBuffer: true });
    this.target.texture.generateMipmaps = false;
    this.targetBlur = new THREE.WebGLRenderTarget(rw, rh, { depthBuffer: false });
    this.targetBlur.texture.generateMipmaps = false;
    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, depthMm / 2, -depthMm / 2, 0, far);
    this.camera.rotation.x = Math.PI / 2; // look up from the plane
    this.depth = new THREE.MeshDepthMaterial();
    this.depth.depthTest = true;
    this.depth.depthWrite = true;
    this.depth.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec4( vec3( 1.0 - fragCoordZ ), opacity );",
        // Darkness falls off with height above the plane, a little faster than linear.
        "vec4( vec3( 1.0 ), pow( 1.0 - fragCoordZ, 1.6 ) );",
      );
    };
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, step: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    const display = new THREE.MeshBasicMaterial({
      map: this.target.texture,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      color: 0x3a3226,
    });
    display.name = "contact-shadow";
    // The plane is seen from above with the image the camera saw from below: mirror it back.
    const plane = new THREE.PlaneGeometry(width, depthMm);
    this.mesh = new THREE.Mesh(plane, display);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.scale.set(1, -1, 1);
    this.mesh.renderOrder = -50;
    this.mesh.raycast = () => {};
  }

  setTint(color: string, opacity: number): void {
    const m = this.mesh.material as THREE.MeshBasicMaterial;
    m.color.set(color);
    m.opacity = opacity;
  }

  /** Draw the shadow again. `isCaster` filters what may cast (glows, proxies and overlays may not). */
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, isCaster: (o: THREE.Object3D) => boolean): void {
    const pos = new THREE.Vector3();
    this.mesh.getWorldPosition(pos);
    this.camera.position.copy(pos);
    this.camera.updateMatrixWorld();
    // Hide what must not cast.
    this.hidden.length = 0;
    scene.traverseVisible((o) => {
      if (o === this.mesh || ((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite) && !isCaster(o)) this.hidden.push(o);
    });
    for (const o of this.hidden) o.visible = false;
    const bg = scene.background;
    const before = gl.getRenderTarget();
    const clear = gl.getClearColor(new THREE.Color());
    const alpha = gl.getClearAlpha();
    const autoClear = gl.autoClear;
    const shadows = gl.shadowMap.enabled;
    scene.background = null;
    scene.overrideMaterial = this.depth;
    gl.shadowMap.enabled = false;
    gl.autoClear = true;
    // White with no alpha, so the blur only spreads darkness (the plane's colour is the tint).
    gl.setClearColor(0xffffff, 0);
    gl.setRenderTarget(this.target);
    gl.clear();
    gl.render(scene, this.camera);
    scene.overrideMaterial = null;
    scene.background = bg;
    for (const o of this.hidden) o.visible = true;
    this.hidden.length = 0;
    // Two separable blurs, the second tighter.
    for (const k of [1, 0.45]) {
      this.pass(gl, this.target, this.targetBlur, (this.blurPx * k) / this.target.width, 0);
      this.pass(gl, this.targetBlur, this.target, 0, (this.blurPx * k) / this.target.height);
    }
    gl.setRenderTarget(before);
    gl.setClearColor(clear, alpha);
    gl.autoClear = autoClear;
    gl.shadowMap.enabled = shadows;
  }

  private pass(gl: THREE.WebGLRenderer, from: THREE.WebGLRenderTarget, to: THREE.WebGLRenderTarget, sx: number, sy: number) {
    this.blur.uniforms.tDiffuse!.value = from.texture;
    (this.blur.uniforms.step!.value as THREE.Vector2).set(sx, sy);
    gl.setRenderTarget(to);
    gl.clear();
    gl.render(this.quadScene, this.quadCam);
  }

  dispose(): void {
    this.target.dispose();
    this.targetBlur.dispose();
    this.depth.dispose();
    this.blur.dispose();
    this.quad.geometry.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
