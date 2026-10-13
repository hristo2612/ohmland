/**
 * The notebook look's ink: the scene is drawn once into a multisampled target with a depth texture, then one
 * full-screen pass lays it on paper and inks it. No geometry is drawn twice, so ink costs one extra draw call.
 *
 * The camera is orthographic, so depth is linear and changes at a constant rate across any flat face. That gives two
 * cheap tests per pixel: a neighbour much further away puts the pixel on the near side of an outline (silhouettes,
 * and every step up from the board), and a kink in the depth's slope marks a crease where two faces of a voxel meet.
 * Thresholds are in world units against the size of a pixel, so lines stay one stroke wide at any zoom, and creases
 * fade out as the isle gets small, leaving only the outlines (a drawing of a far thing has fewer lines).
 */
import * as THREE from "three";
import { NOTEBOOK, type Paper } from "./look";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uReach;
uniform float uSpan;
uniform float uWpp;
uniform float uMinStep;
uniform vec3 uInk;
uniform float uLineA;
uniform float uCreaseA;
uniform vec3 uPaper;
uniform vec3 uGrid;
uniform float uCell;
uniform float uGridW;
uniform float uHeight;
uniform float uClear;
varying vec2 vUv;

float D(vec2 o) { return texture2D(tDepth, vUv + o * uTexel).x * uSpan; }

void main() {
  vec4 c = texture2D(tColor, vUv);
  float r = uReach;
  float d0 = D(vec2(0.0));
  float l = D(vec2(-r, 0.0));
  float rr = D(vec2(r, 0.0));
  float u = D(vec2(0.0, r));
  float d = D(vec2(0.0, -r));
  float a1 = D(vec2(-r, r));
  float a2 = D(vec2(r, -r));
  float b1 = D(vec2(r, r));
  float b2 = D(vec2(-r, -r));
  float far = max(max(max(l, rr), max(u, d)), max(max(a1, a2), max(b1, b2))) - d0;
  float near = d0 - min(min(min(l, rr), min(u, d)), min(min(a1, a2), min(b1, b2)));
  // a flat face's depth changes by up to about 1.5 pixel sizes a pixel at this camera angle: a step must beat that
  float stepT = max(uMinStep, uWpp * r * 2.6);
  float line = smoothstep(stepT, stepT * 1.5, far);
  // creases: the second difference of depth, zero on a flat face; skipped beside a step (the step draws that line)
  float lap = max(abs(l + rr - 2.0 * d0), abs(u + d - 2.0 * d0));
  float creaseT = uWpp * r * 0.42;
  float crease = smoothstep(creaseT, creaseT * 1.8, lap) * (1.0 - step(stepT, max(far, near)));
  // the outer contour, where the isle meets the paper, is drawn twice as wide
  float paperZ = uSpan * 0.9999;
  if (d0 < paperZ) {
    float o = max(max(D(vec2(-2.0 * r, 0.0)), D(vec2(2.0 * r, 0.0))), max(D(vec2(0.0, 2.0 * r)), D(vec2(0.0, -2.0 * r))));
    line = max(line, step(paperZ, o));
  }
  float ink = max(line * uLineA, crease * uCreaseA);

  // the paper under the scene (premultiplied colour over it), with the grid's hairlines from the top left
  vec4 base = c;
  if (uClear < 0.5) {
    vec3 paper = uPaper;
    if (uCell > 0.0) {
      vec2 g = mod(vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y), uCell);
      float on = max(step(g.x, uGridW - 0.001), step(g.y, uGridW - 0.001));
      paper = mix(paper, uGrid, on);
    }
    base = vec4(c.rgb + paper * (1.0 - c.a), 1.0);
  }
  vec4 o = vec4(uInk * ink + base.rgb * (1.0 - ink), ink + base.a * (1.0 - ink));
  gl_FragColor = vec4(o.a > 0.0 ? o.rgb / o.a : vec3(0.0), o.a);
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;
}`;

export type InkLevels = {
  /** Ink colour (linear) and how dark outlines and creases are drawn. */
  ink: THREE.Color;
  line: number;
  crease: number;
  paper: THREE.Color;
  grid: THREE.Color;
};

export class InkPass {
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly mat: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly u: Record<string, THREE.IUniform>;
  private dpr = 1;
  /** How dark creases are when the isle is close (they fade as it gets small). */
  private creaseA = 0.4;

  constructor(
    readonly paper: Paper,
    samples: number,
  ) {
    this.rt = new THREE.WebGLRenderTarget(1, 1, {
      samples,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType),
      colorSpace: THREE.SRGBColorSpace,
    });
    this.rt.depthTexture!.minFilter = this.rt.depthTexture!.magFilter = THREE.NearestFilter;
    this.u = {
      tColor: { value: this.rt.texture },
      tDepth: { value: this.rt.depthTexture },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uReach: { value: 1 },
      uSpan: { value: 1 },
      uWpp: { value: 0.02 },
      uMinStep: { value: 0.09 },
      uInk: { value: new THREE.Color(NOTEBOOK.ink) },
      uLineA: { value: 0.8 },
      uCreaseA: { value: 0.4 },
      uPaper: { value: new THREE.Color(NOTEBOOK.paper) },
      uGrid: { value: new THREE.Color(NOTEBOOK.grid) },
      uCell: { value: 0 },
      uGridW: { value: 1 },
      uHeight: { value: 1 },
      uClear: { value: paper === "clear" ? 1 : 0 },
    };
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
  }

  /** The drawing buffer's size in device pixels, and how many of them make a CSS pixel. */
  setSize(w: number, h: number, dpr: number): void {
    this.rt.setSize(w, h);
    this.dpr = dpr;
    this.u.uTexel!.value.set(1 / w, 1 / h);
    this.u.uHeight!.value = h;
    // lines about one CSS pixel wide; the grid's hairlines one CSS pixel on a 24 pixel cell
    this.u.uReach!.value = Math.max(1, Math.round(dpr * 0.9));
    this.u.uCell!.value = this.paper === "grid" ? NOTEBOOK.cell * dpr : 0;
    this.u.uGridW!.value = Math.max(1, Math.round(dpr));
  }

  /** Sets the colours for the time of day. */
  setLevels(l: InkLevels): void {
    (this.u.uInk!.value as THREE.Color).copy(l.ink);
    this.u.uLineA!.value = l.line;
    this.creaseA = l.crease;
    (this.u.uPaper!.value as THREE.Color).copy(l.paper);
    (this.u.uGrid!.value as THREE.Color).copy(l.grid);
  }

  /** Draws the scene into the target, then onto the canvas, inked. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.OrthographicCamera): void {
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    const h = this.rt.height;
    const wpp = (cam.top - cam.bottom) / cam.zoom / h;
    this.u.uSpan!.value = cam.far - cam.near;
    this.u.uWpp!.value = wpp;
    // creases fade as the isle gets small (a pixel worth more than about a tenth of a cell), outlines stay
    const k = THREE.MathUtils.clamp((0.075 - wpp * this.dpr) / 0.04, 0, 1);
    this.u.uCreaseA!.value = this.creaseA * k;
    renderer.render(this.quad, this.cam);
  }

  dispose(): void {
    this.rt.depthTexture?.dispose();
    this.rt.dispose();
    this.quad.geometry.dispose();
    this.mat.dispose();
  }
}
