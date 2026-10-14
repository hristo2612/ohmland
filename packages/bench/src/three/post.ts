// Post-processing for the paper look (high quality only): an ink outline pass, a little bloom for lit LEDs and the
// paper tone curve, plus the spotlight veil. Vanilla `postprocessing`, driven by <PaperRenderer>.

import * as THREE from "three";
import { BlendFunction, BloomEffect, Effect, EffectAttribute, EffectComposer, EffectPass, Pass, RenderPass } from "postprocessing";
import { PAPER_TONE_GLSL } from "./paper";

/** Layer of everything the spotlight keeps bright (spotlit parts and their rings), drawn again above the veil. */
export const SPOT_LAYER = 3;

// ---------------------------------------------------------------------------------------------------------------
// Ink: silhouettes from the depth buffer only (no normal pre-pass, so no second render of the scene). The second
// difference of 1/z is zero on any plane; it is positive on the far side of a depth jump, where the line is drawn,
// so each part gets a pen line just outside its own edge and thin leads keep their fill.

const INK_FRAG = /* glsl */ `
uniform vec3 ink;
uniform float thickness;
uniform float strength;
uniform float crease;

float wAt( const in vec2 uv ) {
  float d = readDepth( uv );
  return d >= 0.999999 ? 0.0 : -1.0 / getViewZ( d );
}

void mainImage( const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor ) {
  vec2 o = texelSize * thickness;
  vec2 q = o * 0.7071;
  float wc = depth >= 0.999999 ? 0.0 : -1.0 / getViewZ( depth );
  vec2 d0 = vec2( -o.x, 0.0 ); float w0 = wAt( uv + d0 );
  vec2 d1 = vec2( o.x, 0.0 );  float w1 = wAt( uv + d1 );
  vec2 d2 = vec2( 0.0, -o.y ); float w2 = wAt( uv + d2 );
  vec2 d3 = vec2( 0.0, o.y );  float w3 = wAt( uv + d3 );
  vec2 d4 = vec2( q.x, q.y );  float w4 = wAt( uv + d4 );
  vec2 d5 = vec2( -q.x, q.y ); float w5 = wAt( uv + d5 );
  vec2 d6 = vec2( q.x, -q.y ); float w6 = wAt( uv + d6 );
  vec2 d7 = vec2( -q.x, -q.y ); float w7 = wAt( uv + d7 );
  // The nearest neighbour owns the line (its alpha says whether it is under the spotlight veil).
  float wn = w0; vec2 dn = d0;
  if ( w1 > wn ) { wn = w1; dn = d1; }
  if ( w2 > wn ) { wn = w2; dn = d2; }
  if ( w3 > wn ) { wn = w3; dn = d3; }
  if ( w4 > wn ) { wn = w4; dn = d4; }
  if ( w5 > wn ) { wn = w5; dn = d5; }
  if ( w6 > wn ) { wn = w6; dn = d6; }
  if ( w7 > wn ) { wn = w7; dn = d7; }
  float ref = max( wc, wn );
  float line = 0.0;
  if ( ref > 0.0 ) {
    float lap = ( w0 + w1 + w2 + w3 - 4.0 * wc ) / ref;
    float lapd = ( w4 + w5 + w6 + w7 - 4.0 * wc ) / ref;
    line = smoothstep( 0.0025, 0.012, max( lap, lapd ) ) * strength;
    line *= clamp( texture2D( inputBuffer, uv + dn ).a, 0.0, 1.0 );
    // Creases: on a part's own surface, a sharp bend shows as a small second difference one pixel across (planes
    // give none). Drawn lighter than silhouettes, like a pencil line inside an ink outline.
    if ( crease > 0.0 && wc > 0.0 && line < 0.2 ) {
      vec2 p = texelSize;
      float a0 = wAt( uv - vec2( p.x, 0.0 ) ), a1 = wAt( uv + vec2( p.x, 0.0 ) );
      float a2 = wAt( uv - vec2( 0.0, p.y ) ), a3 = wAt( uv + vec2( 0.0, p.y ) );
      if ( min( min( a0, a1 ), min( a2, a3 ) ) > 0.0 ) {
        float c = max( abs( a0 + a1 - 2.0 * wc ), abs( a2 + a3 - 2.0 * wc ) ) / wc;
        line = max( line, smoothstep( 0.0006, 0.0022, c ) * crease * inputColor.a );
      }
    }
  }
  outputColor = vec4( mix( inputColor.rgb, ink, line ), 1.0 );
}`;

export class InkEffect extends Effect {
  constructor(ink: string, thickness: number, strength = 0.82) {
    super("InkEffect", INK_FRAG, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ["ink", new THREE.Uniform(new THREE.Color(ink))],
        ["thickness", new THREE.Uniform(thickness)],
        ["strength", new THREE.Uniform(strength)],
        ["crease", new THREE.Uniform(0.38)],
      ]),
    });
  }
  set(ink: string, thickness: number, strength = 0.82): void {
    (this.uniforms.get("ink")!.value as THREE.Color).set(ink);
    this.uniforms.get("thickness")!.value = thickness;
    this.uniforms.get("strength")!.value = strength;
  }
}

const TONE_FRAG = /* glsl */ `
${PAPER_TONE_GLSL}
void mainImage( const in vec4 inputColor, const in vec2 uv, out vec4 outputColor ) {
  outputColor = vec4( paperTone( inputColor.rgb ), 1.0 );
}`;

export class PaperToneEffect extends Effect {
  constructor() {
    super("PaperToneEffect", TONE_FRAG, { blendFunction: BlendFunction.SRC });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Spotlight: a sheet of paper-coloured veil over everything, then the spotlit things drawn again on top (depth
// tested against the scene, so whatever stands in front of them stays veiled). The veil also lowers alpha, which
// tells the ink pass to fade the lines of what it covers.

export type SpotState = { amount: number; color: THREE.Color };

const VEIL_FRAG = /* glsl */ `
uniform vec3 color;
uniform float amount;
void main() {
  gl_FragColor = vec4( color, amount );
  #include <colorspace_fragment>
}`;
const VEIL_VERT = /* glsl */ `
void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

export class Spotlight {
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  constructor(public state: SpotState) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { color: { value: state.color }, amount: { value: 0 } },
      vertexShader: VEIL_VERT,
      fragmentShader: VEIL_FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }
  /**
   * Draws the veil and the spotlit layer over what is already in the current render target. `markAlpha` lowers the
   * target's alpha under the veil for the ink pass to read; drawing straight to the canvas leaves alpha alone.
   */
  draw(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, markAlpha = false): void {
    if (this.state.amount <= 0.001) return;
    this.material.uniforms.amount!.value = this.state.amount;
    this.material.blendDstAlpha = markAlpha ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor;
    const bg = scene.background;
    const autoClear = gl.autoClear;
    const mask = camera.layers.mask;
    gl.autoClear = false;
    gl.render(this.scene, this.cam);
    // The lights must reach the spotlight layer too.
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight) o.layers.enable(SPOT_LAYER);
    });
    scene.background = null;
    camera.layers.set(SPOT_LAYER);
    gl.render(scene, camera);
    camera.layers.mask = mask;
    scene.background = bg;
    gl.autoClear = autoClear;
  }
  dispose(): void {
    this.material.dispose();
  }
}

class SpotPass extends Pass {
  constructor(
    private spotScene: THREE.Scene,
    private spotCamera: THREE.Camera,
    private spot: Spotlight,
  ) {
    super("SpotPass");
    this.needsSwap = false;
  }
  override render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(inputBuffer);
    this.spot.draw(renderer, this.spotScene, this.spotCamera, true);
  }
}

export type PaperComposer = {
  composer: EffectComposer;
  ink: InkEffect;
  render: (delta: number) => void;
  setSize: (w: number, h: number) => void;
  dispose: () => void;
};

export function createPaperComposer(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  spot: Spotlight,
  opts: { ink: string; thickness: number; bloom: number },
): PaperComposer {
  const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new SpotPass(scene, camera, spot));
  const ink = new InkEffect(opts.ink, opts.thickness);
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.1, luminanceSmoothing: 0.2, intensity: opts.bloom, radius: 0.68 });
  composer.addPass(new EffectPass(camera, ink, bloom, new PaperToneEffect()));
  return {
    composer,
    ink,
    render: (delta) => composer.render(delta),
    setSize: (w, h) => composer.setSize(w, h),
    dispose: () => composer.dispose(),
  };
}
