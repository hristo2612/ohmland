/**
 * The robot on its own, large, from the front and from the isle's camera angle, for checking its design (and as the
 * reference for the app's 2D pixel version). ?night=1 shows it with its lights on.
 */
import * as THREE from "three";
import { makeRobot } from "../src/render/robot";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const night = new URLSearchParams(location.search).get("night") === "1";
const scene = new THREE.Scene();
scene.background = new THREE.Color(night ? "#1b2346" : "#e4f3f4");
scene.add(new THREE.HemisphereLight("#eaf4ff", "#8a7a62", night ? 0.7 : 2.0));
const sun = new THREE.DirectionalLight("#fff6e6", night ? 0.45 : 1.6);
sun.position.set(-2, 5, 4);
scene.add(sun);
const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6b645a, emissiveIntensity: 0.45 });
const glowMat = new THREE.ShaderMaterial({
  vertexColors: true,
  uniforms: { uNight: { value: night ? 1 : 0 } },
  vertexShader:
    "attribute vec3 dayColor; uniform float uNight; varying vec3 vC; void main(){ vC = mix(dayColor, color * 1.08, uNight); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0);\n#include <colorspace_fragment>\n}",
});
const front = makeRobot(bodyMat, glowMat);
const iso = makeRobot(bodyMat, glowMat);
front.group.position.set(-1.4, 0, 0);
iso.group.position.set(1.4, 0, 0);
iso.group.rotation.y = -Math.PI / 4;
scene.add(front.group, iso.group);
const cam = new THREE.OrthographicCamera(-3, 3, 1.8, -1.8, 0.1, 100);
cam.position.set(0, 0.2, 10);
cam.lookAt(0, 0.2, 0);
const fit = () => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  const a = w / h;
  const half = Math.max(1.6, 3.2 / a);
  Object.assign(cam, { left: -half * a, right: half * a, top: half, bottom: -half });
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
};
new ResizeObserver(fit).observe(canvas);
fit();
(window as unknown as { __robotReady: boolean }).__robotReady = true;
