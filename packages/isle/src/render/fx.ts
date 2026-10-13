/**
 * Point sprites in one draw call each: the sparks and dust of a reveal, smoke from a forge, the halos of lamps at
 * night and the stars. Positions live in plain arrays updated on the CPU (a few hundred points at most).
 */
import * as THREE from "three";

export type Tex = "soft" | "spark" | "star";

function texture(kind: Tex): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  if (kind === "spark") {
    // a little square spark with a bright core, voxel style
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(8, 8, 48, 48);
    g.fillStyle = "rgba(255,255,255,1)";
    g.fillRect(18, 18, 28, 28);
  } else {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (kind === "star") {
      r.addColorStop(0, "rgba(255,255,255,1)");
      r.addColorStop(0.18, "rgba(255,255,255,0.85)");
      r.addColorStop(0.45, "rgba(255,255,255,0.1)");
    } else {
      r.addColorStop(0, "rgba(255,255,255,1)");
      r.addColorStop(0.4, "rgba(255,255,255,0.5)");
    }
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = /* glsl */ `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform float uScale; varying float vA; varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aSize * uScale);
  vA = aAlpha; vC = aColor;
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uFade; varying float vA; varying vec3 vC;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  float a = t.a * vA * uFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vC * t.rgb, a);
  #include <colorspace_fragment>
}`;

/** World units to pixels for every sprite system, set once per frame from the orthographic camera. */
export const pointScale = { value: 1 };

export class Points {
  readonly obj: THREE.Points;
  readonly pos: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  readonly color: Float32Array;
  readonly fade = { value: 1 };
  private readonly geo: THREE.BufferGeometry;
  private readonly tex: THREE.Texture;
  constructor(
    readonly n: number,
    kind: Tex,
    opts: { additive?: boolean; order?: number },
  ) {
    this.pos = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.color = new Float32Array(n * 3).fill(1);
    const g = (this.geo = new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    this.tex = texture(kind);
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: pointScale, uMap: { value: this.tex }, uFade: this.fade },
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.obj = new THREE.Points(g, m);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = opts.order ?? 2;
  }
  set(i: number, x: number, y: number, z: number, size: number, alpha: number, c?: THREE.Color): void {
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.size[i] = size;
    this.alpha[i] = alpha;
    if (c) {
      this.color[i * 3] = c.r;
      this.color[i * 3 + 1] = c.g;
      this.color[i * 3 + 2] = c.b;
    }
  }
  flush(): void {
    for (const k of ["position", "aSize", "aAlpha", "aColor"]) (this.geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true;
  }
  /** Shows only the first `count` points. */
  draw(count: number): void {
    this.geo.setDrawRange(0, count);
  }
  dispose(): void {
    this.geo.dispose();
    this.tex.dispose();
    (this.obj.material as THREE.Material).dispose();
  }
}

type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; s0: number; s1: number; a: number; g: number; c: THREE.Color };

/** Short-lived particles: sparks, dust, smoke. */
export class Emitter {
  readonly pts: Points;
  private readonly ps: P[] = [];
  private next = 0;
  live = 0;
  constructor(n: number, kind: Tex, opts: { additive?: boolean }) {
    this.pts = new Points(n, kind, opts);
    for (let i = 0; i < n; i++) this.ps.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 0, s0: 0, s1: 0, a: 0, g: 0, c: new THREE.Color(1, 1, 1) });
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, a: number, c: THREE.Color, g = 0): void {
    const p = this.ps[this.next]!;
    this.next = (this.next + 1) % this.ps.length;
    Object.assign(p, { x, y, z, vx, vy, vz, age: 0, life, s0, s1, a, g });
    p.c.copy(c);
  }
  update(dt: number, wind = 0): void {
    let live = 0;
    this.ps.forEach((p, i) => {
      if (p.age >= p.life) {
        this.pts.alpha[i] = 0;
        return;
      }
      live++;
      p.age += dt;
      p.vy -= p.g * dt;
      p.x += (p.vx + wind) * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = Math.min(1, p.age / p.life);
      const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      this.pts.set(i, p.x, p.y, p.z, p.s0 + (p.s1 - p.s0) * t, Math.max(0, p.a * fade), p.c);
    });
    this.live = live;
    this.pts.flush();
  }
}
