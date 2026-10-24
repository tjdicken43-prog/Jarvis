/* ---------- Workshop: the brain as a real 3D hologram (round 6, hud/DESIGN.md) ----------
   A lit metal projector throws a globe of TJ's notes into the room, with a reflection on a dark floor, the way the Iron Man
   workshop holograms come out of a real table. Everything drawn is real: the dots are the notes (where scene.js's physics
   settled them), the arcs are their links, the ring is TJ's day (wake 6:00, J Street 8 to 12, now). It reads the page's
   state (mode, level, focus, each note's hot glow) and runs entirely on the device: no Claude calls, paused when hidden. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = $("holo");
const slotEl = $("slot");
const small = () => innerWidth < 900;
const HOLO = new THREE.Color("#a6e4ff"), AMBER = new THREE.Color("#ffb547"), WHITE = new THREE.Color("#ffffff");
const NEEDS_YOU = new Set(["To do", "Decisions"]);
const R = 1.55, C = new THREE.Vector3(0, 2.75, 0); // globe radius and centre; the projector stands on the floor at y = 0
const CENTRAL = { timeZone: "America/Chicago" };

/* ---------- renderer and post ---------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
catch { canvas.remove(); throw new Error("No WebGL: the Workshop look needs it"); }
let pixelRatio = Math.min(devicePixelRatio || 1, small() ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#04070b");
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.18;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.18);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({ // a soft vignette and fine film grain, so it reads as a lens, not a flat render
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - .5; float r = dot(d,d);
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c *= 1. - smoothstep(.2, .8, r) * .5;
      c += (h(vUv * uRes + fract(uTime) * 91.) - .5) * .018;
      gl_FragColor = vec4(c, 1.);
    }`,
});
composer.addPass(grade);

/* ---------- helpers ---------- */
const add = (o, parent = scene) => (parent.add(o), o);
const glowLine = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
function circlePts(r, n = 160, a0 = 0, a1 = Math.PI * 2) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  return p;
}
const ease = (x) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
const win = (x, a, b) => ease((x - a) / (b - a));
let seed = 42; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const fresnelVS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }`;

/* ---------- lights ---------- */
add(new THREE.AmbientLight("#1a2733", 0.6));
const lensLight = add(new THREE.PointLight("#9fdcff", 10, 9, 1.6)); lensLight.position.set(0, 0.6, 0);
add(new THREE.DirectionalLight("#5a7a99", 0.8)).position.set(-4, 6, -6);

/* ---------- floor: the page's own black, a light pool under the projector, faint machined rings ---------- */
const floor = add(new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { uOn: { value: 0 } },
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform float uOn; varying vec3 vP;
    void main(){
      float r = length(vP.xy);
      vec3 base = vec3(.0012,.0021,.0033);
      float pool = exp(-r * r * .22) * .5 * uOn;
      float ring = smoothstep(.035, 0., abs(fract(r * 1.25) - .5) - .47) * smoothstep(7., 2.2, r) * smoothstep(1.4, 2., r) * .08 * uOn;
      gl_FragColor = vec4(base + vec3(.32,.62,.86) * (pool * .05 + ring * .35), mix(.88, 1., smoothstep(1.2, 5., r)));
    }`,
})));
floor.rotation.x = -Math.PI / 2; floor.renderOrder = -1;

/* ---------- projector base ---------- */
const base = add(new THREE.Group());
const metal = new THREE.MeshStandardMaterial({ color: "#1a2029", metalness: 0.9, roughness: 0.34 });
const metal2 = new THREE.MeshStandardMaterial({ color: "#2a323c", metalness: 0.85, roughness: 0.22 });
add(new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.48, 0.2, 128), metal), base).position.y = 0.1;
const lip = add(new THREE.Mesh(new THREE.TorusGeometry(1.31, 0.018, 8, 160), metal2), base); lip.rotation.x = Math.PI / 2; lip.position.y = 0.2;
add(new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.06, 0.12, 128), metal2), base).position.y = 0.26;
const groove = add(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.012, 6, 128), new THREE.MeshBasicMaterial({ color: "#05080b" })), base); groove.rotation.x = Math.PI / 2; groove.position.y = 0.322;
const lensMat = new THREE.MeshBasicMaterial({ color: "#000000" });
add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.03, 96), lensMat), base).position.y = 0.33;
const emitterMat = new THREE.MeshBasicMaterial({ color: "#000000" });
const emitter = add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 8, 128), emitterMat), base); emitter.rotation.x = Math.PI / 2; emitter.position.y = 0.35;
// lights round the lip, one lit per note: the base itself counts the brain
const LEDS = 72;
const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.016, 0.022), new THREE.MeshBasicMaterial({ color: 0xffffff }), LEDS);
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < LEDS; i++) {
    const a = i / LEDS * Math.PI * 2;
    leds.setMatrixAt(i, m4.compose(new THREE.Vector3(Math.cos(a) * 1.2, 0.205, Math.sin(a) * 1.2), q.setFromAxisAngle(up, -a), one));
    leds.setColorAt(i, new THREE.Color(0));
  }
}
add(leds, base);
const ledOff = new THREE.Color("#1d2a35"), ledTmp = new THREE.Color();

/* ---------- beam and the dust drifting through it ---------- */
const beamH = C.y - 0.34;
const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, 0.5, beamH, 96, 1, true), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 w = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }`,
  fragmentShader: `uniform float uTime, uOn; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){
      float y = vUv.y;
      float rise = smoothstep(uOn * 1.15, uOn * 1.15 - .15, y);
      float edge = pow(1. - abs(dot(vN, vV)), 1.6);
      float streak = .65 + .35 * sin(vUv.x * 80. + sin(vUv.x * 13.) * 3.) * sin(y * 6. - uTime * 1.3);
      float a = (1. - y) * (.18 + edge * .55) * streak * rise * .42;
      gl_FragColor = vec4(vec3(.55,.85,1.) * a, a);
    }`,
})));
beam.position.y = 0.34 + beamH / 2; beam.renderOrder = 1;
const DUSTN = small() ? 240 : 480;
const dustPos = new Float32Array(DUSTN * 3), dustSeed = new Float32Array(DUSTN);
for (let i = 0; i < DUSTN; i++) { dustSeed[i] = rand(); const a = rand() * 6.283, rr = Math.sqrt(rand()); dustPos.set([Math.cos(a) * rr, rand(), Math.sin(a) * rr], i * 3); }
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
dustGeo.setAttribute("seed", new THREE.BufferAttribute(dustSeed, 1));
const dust = add(new THREE.Points(dustGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uPx: { value: pixelRatio }, uH: { value: beamH }, uR: { value: R * 0.9 } },
  vertexShader: `attribute float seed; uniform float uTime, uPx, uH, uR; varying float vA;
    void main(){
      float y = fract(position.y + uTime * (.025 + seed * .04));
      float rr = mix(.45, uR, y);
      vec4 mv = modelViewMatrix * vec4(position.x * rr, .34 + y * uH, position.z * rr, 1.);
      gl_PointSize = (1.2 + seed * 2.2) * uPx * (6. / -mv.z);
      vA = (1. - y) * smoothstep(0., .08, y) * (.35 + seed * .65);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `uniform float uOn; varying float vA;
    void main(){ float a = smoothstep(.5, 0., length(gl_PointCoord - .5)) * vA * uOn * .8; gl_FragColor = vec4(vec3(.7,.9,1.) * a, a); }`,
})));
dust.renderOrder = 1;

/* ---------- the hologram ---------- */
const holo = add(new THREE.Group()); holo.position.copy(C);
const globe = add(new THREE.Group(), holo);
const shellLines = [];
for (let k = -3; k <= 3; k++) { // latitudes
  const phi = k * Math.PI / 9;
  const l = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(Math.cos(phi) * R, 128)), glowLine(HOLO, 0.13)), globe);
  l.position.y = Math.sin(phi) * R; shellLines.push(l);
}
for (let k = 0; k < 12; k++) { // meridians
  const pts = [];
  for (let i = 0; i <= 96; i++) { const p = -Math.PI / 2 + Math.PI * i / 96; pts.push(new THREE.Vector3(Math.cos(p) * R, Math.sin(p) * R, 0)); }
  const l = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), glowLine(HOLO, 0.07)), globe);
  l.rotation.y = k * Math.PI / 12; shellLines.push(l);
}
const shell = add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.005, 64, 48), new THREE.ShaderMaterial({ // rim light, so it reads as a volume
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uOn: { value: 0 } }, vertexShader: fresnelVS,
  fragmentShader: `uniform float uOn; varying vec3 vN; varying vec3 vV;
    void main(){ float a = pow(1. - max(dot(vN, vV), 0.), 3.2) * .5 * uOn; gl_FragColor = vec4(vec3(.5,.82,1.) * a, a); }`,
})), globe);

// the notes, where scene.js's physics settled them, sized by their links
const deg = new Map(nodes.map((n) => [n, 0]));
for (const [a, b] of edges) { deg.set(a, deg.get(a) + 1); deg.set(b, deg.get(b) + 1); }
const pos = new Map(nodes.map((n) => [n, new THREE.Vector3(n.x, n.y, n.z).normalize().multiplyScalar(R * 0.97)]));
const nodeGeo = new THREE.SphereGeometry(1, 16, 12);
const dots = nodes.map((n) => {
  const d = deg.get(n), amber = NEEDS_YOU.has(n.name);
  const tint = (amber ? AMBER : n.type === "hub" || n.type === "business" ? WHITE : HOLO).clone();
  const m = add(new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(1.6), transparent: true })), globe);
  m.position.copy(pos.get(n));
  m.userData = { n, s: 0.022 + Math.min(d, 30) / 30 * 0.05, tint, amber, deg: d };
  return m;
});
// links: short ones hug the skin, long ones dive towards the core, like connections inside a mind
const SEG = 28, arcs = [], arcPos = [], arcCol = [];
for (const [a, b] of edges) {
  const A = pos.get(a), B = pos.get(b), ang = A.angleTo(B), M = A.clone().add(B).multiplyScalar(0.5);
  const ctrl = ang < 0.9 ? M.clone().normalize().multiplyScalar(R * 1.04) : M.multiplyScalar(0.25), pts = [];
  for (let i = 0; i <= SEG; i++) { const t = i / SEG, u = 1 - t; pts.push(new THREE.Vector3().addScaledVector(A, u * u).addScaledVector(ctrl, 2 * u * t).addScaledVector(B, t * t)); }
  arcs.push({ pts, a, b });
  for (let i = 0; i < SEG; i++) {
    arcPos.push(...pts[i].toArray(), ...pts[i + 1].toArray());
    const c = HOLO.clone().multiplyScalar((0.28 + 0.72 * Math.sin(Math.PI * (i + 0.5) / SEG)) * (ang < 0.9 ? 0.32 : 0.16));
    arcCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
}
const arcGeo = new THREE.BufferGeometry();
arcGeo.setAttribute("position", new THREE.Float32BufferAttribute(arcPos, 3));
arcGeo.setAttribute("color", new THREE.Float32BufferAttribute(arcCol, 3));
arcGeo.setDrawRange(0, 0);
add(new THREE.LineSegments(arcGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), globe);
// a question lights its notes: their links glow too
const hotGeo = new THREE.BufferGeometry();
hotGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(1, arcs.length) * SEG * 6), 3));
hotGeo.setDrawRange(0, 0);
const hotLines = add(new THREE.LineSegments(hotGeo, glowLine(new THREE.Color("#dff6ff"), 0.5)), globe);
// packets travelling along links: busier while Jarvis thinks
const PK = small() ? 10 : 18;
const pk = Array.from({ length: PK }, () => ({ arc: Math.floor(rand() * arcs.length), t: rand(), v: 0.18 + rand() * 0.25 }));
const pkGeo = new THREE.BufferGeometry(); pkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PK * 3), 3));
const packets = add(new THREE.Points(pkGeo, new THREE.PointsMaterial({ color: new THREE.Color("#e8f8ff").multiplyScalar(2), size: small() ? 0.05 : 0.04, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), globe);

// the core: Jarvis himself; it breathes when idle and moves with his voice
const core = add(new THREE.Group(), holo);
const coreWire = add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.26, 1)), glowLine(new THREE.Color("#cdeeff"), 0.55)), core);
const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(2.2) });
add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 2), coreMat), core);
add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: fresnelVS,
  fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(max(dot(vN, vV), 0.), 2.); gl_FragColor = vec4(vec3(.6,.88,1.) * f * .9, f); }`,
})), core);

// rings: TJ's day, a jobs track and a fine bezel, tilted a little towards you
const rings = add(new THREE.Group(), holo); rings.rotation.x = 0.2;
const DAY_R = R + 0.5;
const day = add(new THREE.Group(), rings);
add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(DAY_R, 240)), glowLine(HOLO, 0.32)), day);
add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(DAY_R + 0.14, 240)), glowLine(HOLO, 0.1)), day);
const hourA = (h) => h / 24 * Math.PI * 2 - Math.PI / 2;
{
  const p = [];
  for (let q = 0; q < 96; q++) { // a tick every 15 minutes, longer each hour and every six
    const a = q / 96 * Math.PI * 2 - Math.PI / 2, r0 = DAY_R + 0.015, r1 = DAY_R + (q % 24 === 0 ? 0.14 : q % 4 === 0 ? 0.075 : 0.035);
    p.push(new THREE.Vector3(Math.cos(a) * r0, 0, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * r1, 0, Math.sin(a) * r1));
  }
  add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(p), glowLine(HOLO, 0.5)), day);
}
function band(h0, h1, r0, r1, color, opacity) { // RingGeometry lies in XY; laid flat its angles run the other way
  const m = add(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96, 1, -hourA(h1), hourA(h1) - hourA(h0)),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), day);
  m.rotation.x = Math.PI / 2; return m;
}
band(8, 12, DAY_R + 0.02, DAY_R + 0.12, AMBER, 0.5); // J Street, 8 to 12 every morning
band(6, 6.25, DAY_R + 0.02, DAY_R + 0.12, HOLO, 0.7); // up at 6
let elapsed = null, nowShown = -1;
const nowMark = add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(2) })), day);
function setNow() {
  const d = new Date(), h = +d.toLocaleString("en-US", { ...CENTRAL, hour: "numeric", hour12: false }) % 24 + d.getMinutes() / 60;
  if (Math.abs(h - nowShown) < 1 / 60) return;
  nowShown = h;
  if (elapsed) { day.remove(elapsed); elapsed.geometry.dispose(); }
  elapsed = band(0, Math.max(h, 0.01), DAY_R - 0.012, DAY_R + 0.012, HOLO, 0.55);
  const a = hourA(h);
  nowMark.position.set(Math.cos(a) * (DAY_R + 0.27), 0, Math.sin(a) * (DAY_R + 0.27));
  nowMark.rotation.set(0, -a, Math.PI / 2);
}
setNow(); setInterval(setNow, 30000);

const bezel = add(new THREE.Group(), rings);
{
  const p = [];
  for (let i = 0; i < 180; i++) {
    const a = i / 180 * Math.PI * 2, r0 = R + 1.0, r1 = r0 + (i % 15 === 0 ? 0.09 : 0.035);
    p.push(new THREE.Vector3(Math.cos(a) * r0, 0, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * r1, 0, Math.sin(a) * r1));
  }
  add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(p), glowLine(HOLO, 0.16)), bezel);
  add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(R + 1.0, 240, 0.3, 2.2)), glowLine(HOLO, 0.22)), bezel);
  add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(R + 1.0, 240, 3.4, 5.1)), glowLine(HOLO, 0.22)), bezel);
}
const jobsRing = add(new THREE.Group(), rings); jobsRing.rotation.set(1.05, 0, 0.32);
add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(R + 0.22, 200)), glowLine(HOLO, 0.09)), jobsRing);
const scanMat = glowLine(HOLO, 0.45);
const scan = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(R + 0.22, 60, 0, 0.9)), scanMat), jobsRing);

/* ---------- reflection: the projector and the hologram's lines mirrored under the glossy floor ---------- */
const mirror = holo.clone(); mirror.scale.y = -1;
const baseMirror = base.clone(); baseMirror.scale.y = -1;
add(mirror); add(baseMirror);
mirror.traverse((o) => { o.renderOrder = -2; if (o.isMesh && o.geometry === nodeGeo) o.visible = false; });
baseMirror.traverse((o) => (o.renderOrder = -2));
holo.traverse((o) => (o.renderOrder = 2));

/* ---------- callouts: the busiest notes, names only, in columns beside the globe ---------- */
const co = $("callouts"), svg = $("leaders"), SVGNS = "http://www.w3.org/2000/svg";
const tags = [...dots].sort((a, b) => b.userData.deg - a.userData.deg).slice(0, 10).map((m) => {
  const el = document.createElement("div"); el.className = "co" + (m.userData.amber ? " amber" : ""); el.textContent = m.userData.n.name; co.appendChild(el);
  const ln = document.createElementNS(SVGNS, "polyline"); ln.setAttribute("fill", "none"); ln.setAttribute("stroke-width", "1");
  ln.setAttribute("stroke", m.userData.amber ? "rgba(255,181,71,.5)" : "rgba(166,228,255,.35)"); svg.appendChild(ln);
  return { m, el, ln };
});
const v3 = new THREE.Vector3(), camDir = new THREE.Vector3(), wp = new THREE.Vector3();
function toScreen(v) { v3.copy(v).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H, v3.z]; }
function placeCallouts(show) {
  const per = small() || document.body.classList.contains("ambient") && false ? 0 : 2;
  const [cx0, cy0] = toScreen(holo.position);
  const rPx = Math.abs(toScreen(wp.copy(holo.position).add(new THREE.Vector3(R, 0, 0)))[0] - cx0) || 100;
  camera.getWorldDirection(camDir);
  const items = tags.map((tg) => {
    tg.m.getWorldPosition(wp);
    const facing = -wp.clone().sub(holo.position).normalize().dot(camDir);
    const [x, y] = toScreen(wp);
    return { ...tg, x, y, facing, side: x < cx0 ? -1 : 1, ly: null };
  });
  for (const side of [-1, 1]) {
    const col = items.filter((it) => it.side === side && it.facing > 0.05 && !(focus && it.m.userData.n !== focus && false)).slice(0, per).sort((a, b) => a.y - b.y);
    let prev = -1e9;
    for (const it of col) { it.ly = Math.max(it.y - 8, prev + 30); prev = it.ly; }
  }
  for (const it of items) {
    const vis = it.ly !== null && show > 0;
    it.el.style.opacity = it.ln.style.opacity = vis ? show * Math.min(1, (it.facing - 0.05) * 3) : 0;
    if (!vis) continue;
    const lx = cx0 + it.side * (rPx + 44), ex = it.x + it.side * Math.min(Math.abs(lx - it.x) * 0.4, 26);
    it.ln.setAttribute("points", `${it.x},${it.y} ${ex},${it.ly} ${lx},${it.ly}`);
    it.el.style.left = (it.side < 0 ? lx - 8 : lx + 8) + "px"; it.el.style.top = (it.ly - 9) + "px";
    it.el.style.transform = it.side < 0 ? "translateX(-100%)" : "none";
  }
}

/* ---------- framing: the globe centres on #slot and scales to fit it ---------- */
let W = 1, H = 1, frameBox = { cx: 0, cy: 0, r: 100 };
function layout() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false); composer.setSize(W, H);
  bloom.resolution.set(W / 2, H / 2);
  grade.uniforms.uRes.value.set(W, H);
  const s = slotEl.getBoundingClientRect(), ph = small();
  const r = ph ? Math.min(s.width / 3.5, s.height / 2.9) : Math.min(s.width / 3.7, s.height / 3.5);
  frameBox = { cx: s.left + s.width / 2, cy: s.top + s.height * (ph ? 0.4 : 0.37), r: Math.max(40, r) };
  camera.fov = ph ? 40 : 30; camera.aspect = W / H;
  camera.setViewOffset(W, H, W / 2 - frameBox.cx, H / 2 - frameBox.cy, W, H);
  camera.updateProjectionMatrix();
}
addEventListener("resize", layout);
new ResizeObserver(layout).observe(slotEl);
layout();

/* ---------- interaction: drag to turn the globe, tap a note to open it, tap the core to talk ---------- */
const spin = { yaw: 0, v: 0.06, pitch: 0, drag: null, idleAt: 0 };
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  spin.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, t: performance.now() };
});
canvas.addEventListener("pointermove", (e) => {
  const d = spin.drag; if (!d) return;
  d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.x, e.clientY - d.y));
  if (d.moved < 8) return;
  canvas.classList.add("drag");
  const dx = e.clientX - d.lx, dy = e.clientY - d.ly; d.lx = e.clientX; d.ly = e.clientY;
  spin.yaw += dx * 0.006; spin.v = dx * 0.006 * 60; spin.pitch = Math.max(-0.35, Math.min(0.35, spin.pitch + dy * 0.003));
  focus = null;
});
function release(e) {
  const d = spin.drag; spin.drag = null; canvas.classList.remove("drag");
  if (!d) return;
  spin.idleAt = performance.now();
  if (d.moved >= 8 || e.type !== "pointerup") return;
  pick(e.clientX, e.clientY);
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
function pick(px, py) {
  let best = null, bd = 22;
  for (const m of dots) {
    m.getWorldPosition(wp);
    const facing = -wp.clone().sub(holo.position).normalize().dot(camDir);
    const [x, y] = toScreen(wp), d = Math.hypot(x - px, y - py) - (facing > 0 ? 6 : 0);
    if (d < bd) { bd = d; best = m; }
  }
  if (best) { openNote(best.userData.n); return; }
  const [cx0, cy0] = toScreen(holo.position);
  if (Math.hypot(px - cx0, py - cy0) < frameBox.r * 0.3) { listen(); return; }
  focus = null; $("card").classList.remove("show");
}

/* ---------- full screen: the hologram takes the computer ---------- */
function ambient(on) { document.body.classList.toggle("ambient", on); requestAnimationFrame(layout); }
$("fsBtn").addEventListener("click", async () => {
  const on = !document.body.classList.contains("ambient");
  ambient(on);
  try { if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen(); else if (!on && document.fullscreenElement) await document.exitFullscreen(); } catch {} // a framed page may not be allowed full screen; the look still changes
});
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) ambient(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("ambient")) ambient(false); });

/* ---------- the frame loop ---------- */
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const t0 = performance.now(), BOOT = reduced ? 0.01 : 3.2;
let last = t0, slowFrames = 0, hotKey = "";
const coreTint = new THREE.Color();
function render(now) {
  requestAnimationFrame(render);
  if (SHOW() || document.hidden || !$("night").hidden || window.JarvisFactory?.isOpen?.()) { last = now; return; }
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; // rAF time can trail performance.now() on the first frame
  const t = Math.max(0, (now - t0) / 1000), boot = Math.min(1, t / BOOT);
  // a slow device drops its pixel ratio once rather than stutter
  if (dt > 0.034 && t > 4) { if (++slowFrames > 90 && pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(1); layout(); } } else slowFrames = Math.max(0, slowFrames - 1);

  // camera: framed on the slot, a slow drift; the globe turns, or faces the note you opened
  const el = 0.3 + spin.pitch * 0.5, yawCam = Math.sin(t * 0.07) * 0.06;
  const dist = R * H / (2 * frameBox.r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(C.x + Math.sin(yawCam) * Math.cos(el) * dist, C.y + Math.sin(el) * dist, C.z + Math.cos(yawCam) * Math.cos(el) * dist);
  camera.lookAt(C);
  if (focus && pos.has(focus) && !spin.drag) {
    const p = pos.get(focus), want = -Math.atan2(p.x, p.z) + yawCam;
    let d = want - spin.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); spin.yaw += d * 0.08; spin.v = 0;
  } else if (!spin.drag) {
    const idle = reduced ? 0 : mode === "thinking" ? 0.22 : 0.06;
    spin.v += (idle - spin.v) * 0.02; spin.yaw += spin.v * dt;
  }
  globe.rotation.y = spin.yaw;

  // boot: lights, beam, globe, links, rings
  for (let i = 0; i < LEDS; i++) {
    const on = win(boot, i / LEDS * 0.25, i / LEDS * 0.25 + 0.06);
    leds.setColorAt(i, ledTmp.copy(i < nodes.length ? HOLO : ledOff).multiplyScalar(on * (i < nodes.length ? 1.4 : 1)));
  }
  leds.instanceColor.needsUpdate = true;
  const lamp = win(boot, 0.12, 0.3);
  lensMat.color.set("#7fc6e8").multiplyScalar(0.1 + 0.45 * lamp);
  emitterMat.color.set("#d8f3ff").multiplyScalar(2.2 * lamp);
  lensLight.intensity = 10 * win(boot, 0.12, 0.4);
  beam.material.uniforms.uOn.value = win(boot, 0.15, 0.45); beam.material.uniforms.uTime.value = t;
  dust.material.uniforms.uOn.value = win(boot, 0.3, 0.6); dust.material.uniforms.uTime.value = t;
  floor.material.uniforms.uOn.value = win(boot, 0.12, 0.5);
  const g = win(boot, 0.3, 0.62);
  shellLines.forEach((l, i) => { l.visible = g > i / shellLines.length; });
  shell.material.uniforms.uOn.value = g;
  globe.scale.setScalar(0.85 + 0.15 * g);
  dots.forEach((m, i) => {
    const k = win(boot, 0.4 + i / dots.length * 0.2, 0.46 + i / dots.length * 0.2), hot = m.userData.n.hot || 0;
    m.scale.setScalar(m.userData.s * k * (1 + 0.15 * Math.sin(t * 2 + i) + hot * 1.2) * (focus === m.userData.n ? 1.6 : 1));
    m.material.color.copy(m.userData.tint).multiplyScalar(1.6 + hot * 1.4);
  });
  arcGeo.setDrawRange(0, Math.floor(arcPos.length / 3 * win(boot, 0.5, 0.8)));

  // hot links: rebuilt only when which notes glow changes
  const key = nodes.map((n) => (n.hot > 0.3 ? 1 : 0)).join("");
  if (key !== hotKey) {
    hotKey = key; const buf = hotGeo.attributes.position.array; let k = 0;
    for (const { pts, a, b } of arcs) if (a.hot > 0.3 || b.hot > 0.3) for (let i = 0; i < SEG; i++) { buf.set(pts[i].toArray(), k); buf.set(pts[i + 1].toArray(), k + 3); k += 6; }
    hotGeo.setDrawRange(0, k / 3); hotGeo.attributes.position.needsUpdate = true;
  }
  hotLines.material.opacity = 0.5 * Math.max(0, ...nodes.map((n) => n.hot || 0));

  // the core follows Jarvis's state: listening green, thinking amber, speaking moves with the voice
  coreTint.set(mode === "listening" ? "#9ff2c8" : mode === "thinking" ? "#ffd08a" : "#ffffff");
  coreMat.color.lerp(coreTint.multiplyScalar(2.2), 0.1);
  core.scale.setScalar(win(boot, 0.25, 0.45) * (1 + 0.04 * Math.sin(t * 2.4) + level * 0.35));
  coreWire.rotation.set(t * 0.21, t * (mode === "thinking" ? 0.9 : 0.33), 0);
  scanMat.color.set(mode === "thinking" ? "#ffb547" : "#a6e4ff");
  scan.rotation.y = t * (mode === "thinking" ? 1.4 : 0.35);
  bezel.rotation.y = -t * 0.02;
  rings.scale.setScalar(0.6 + 0.4 * win(boot, 0.55, 0.85)); rings.visible = boot > 0.55;
  const speed = mode === "thinking" ? 2.4 : 1;
  for (let i = 0; i < PK; i++) {
    const p = pk[i]; p.t += p.v * speed * dt;
    if (!(p.t >= 0 && p.t <= 1)) { p.t = 0; p.arc = Math.floor(rand() * arcs.length); }
    const a = arcs[p.arc]?.pts; if (!a) continue;
    const f = p.t * SEG, j = Math.min(SEG - 1, Math.floor(f)), v = a[j].clone().lerp(a[j + 1], f - j);
    pkGeo.attributes.position.setXYZ(i, v.x, v.y, v.z);
  }
  pkGeo.attributes.position.needsUpdate = true;
  packets.visible = boot > 0.8 && !reduced;
  holo.position.y = C.y + (reduced ? 0 : Math.sin(t * 0.8) * 0.025);
  mirror.position.y = -holo.position.y;
  globe.updateMatrixWorld(); mirror.children[0].rotation.y = spin.yaw; // the reflection turns with the globe

  grade.uniforms.uTime.value = t;
  composer.render();
  placeCallouts(win(boot, 0.75, 1));
}
requestAnimationFrame(render);
