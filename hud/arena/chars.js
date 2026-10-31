/* Training grounds characters: anime proportions (about 7 heads), lathe-sculpted torso and limbs, painted faces,
   bent hair clumps, two-tone cel shading with coloured shadows, a rim light and ink outlines. All in code. */
import * as THREE from "three";

export const TAU = Math.PI * 2;
let sd = 7; export const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); export const reseed = s => (sd = s);

/* ---------- materials: 2-step ramp (light / shadow), shadow tint comes from a cool hemisphere light; rim added in shader ---------- */
const ramp = (() => { const d = new Uint8Array([105, 105, 105, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const RIM = { value: new THREE.Color("#ffffff") }, RIMK = { value: .55 };
const MC = new Map();
export function toon(color, o = {}) {
  const key = color + (o.map ? o.map.uuid : "") + (o.emit || "");
  if (MC.has(key)) return MC.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, map: o.map || null, emissive: o.emit || "#000000" });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimC = RIM; sh.uniforms.rimK = RIMK;
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 rimC; uniform float rimK;")
      .replace("#include <opaque_fragment>", `float rimF = smoothstep(.62,.72,1.-max(dot(normalize(vNormal),normalize(vViewPosition)),0.));
        outgoingLight += rimC*rimF*rimK*(.4+.6*diffuseColor.rgb);
        #include <opaque_fragment>`);
  };
  MC.set(key, m); return m;
}
export const inkMat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { w: { value: .011 } },
  vertexShader: `uniform float w; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*normal); mv.xyz+=n*w*clamp(-mv.z*.35,.6,2.4); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `void main(){ gl_FragColor=vec4(.06,.04,.07,1.); }` });
export const OPT = { ink: true, faces: true };
export function part(geo, mat, parent, x = 0, y = 0, z = 0, ink = true) {
  const m = new THREE.Mesh(geo, typeof mat === "string" ? toon(mat) : mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m);
  if (ink && OPT.ink) m.add(new THREE.Mesh(geo, inkMat)); return m;
}
export const grp = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };

/* ---------- sculpted shapes ---------- */
const lathe = (pts, seg = 20) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); g.computeVertexNormals(); return g; };
const down = (g) => { g.rotateX(Math.PI); return g; };              // limb hangs from its joint
const LIMB = {
  upperArm: down(lathe([[0, 0], [.05, .005], [.058, .05], [.06, .12], [.052, .22], [.044, .27], [0, .28]])),
  foreArm: down(lathe([[0, 0], [.044, .005], [.05, .05], [.046, .13], [.036, .23], [.032, .25], [0, .26]])),
  thigh: down(lathe([[0, 0], [.085, .01], [.092, .08], [.085, .2], [.066, .37], [.058, .41], [0, .42]])),
  shin: down(lathe([[0, 0], [.058, .005], [.066, .08], [.06, .18], [.042, .36], [.038, .4], [0, .41]])),
  chest: lathe([[0, 0], [.135, 0], [.142, .07], [.155, .18], [.182, .3], [.19, .37], [.165, .44], [.08, .48], [0, .49]], 28),
  pelvis: lathe([[0, -.02], [.13, -.02], [.152, .04], [.15, .1], [.135, .15], [0, .16]], 24),
};
LIMB.chest.scale(1, 1, .66); LIMB.pelvis.scale(1, 1, .72);
function headGeo() { // a skull with an anime chin
  const g = new THREE.SphereGeometry(.13, 40, 28), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const y = v.y / .13;
    if (y < 0) { const k = 1 - Math.pow(-y, 1.6) * .42; v.x *= k; v.z *= 1 - Math.pow(-y, 2) * .18; v.z += Math.pow(-y, 2.2) * .03 * Math.max(0, v.z / .13); v.y *= 1.18; }
    v.y *= 1.06; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
const HEAD = headGeo();
function bentCone(r, len, bend, seg = 7) { // a hair clump: tapered and curved
  const g = new THREE.ConeGeometry(r, len, 9, seg); g.translate(0, len / 2, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const h = p.getY(i) / len; p.setZ(i, p.getZ(i) + bend * h * h * len); p.setX(i, p.getX(i) * (1 - h * .15)); }
  g.computeVertexNormals(); return g;
}

/* ---------- painted faces (drawn on the head's own UVs; the face centre is u=.25) ---------- */
export function faceTex(o) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d");
  g.fillStyle = o.skin; g.fillRect(0, 0, 1024, 512);
  const cx = 256, ey = 262;
  if (o.blush) { g.fillStyle = "rgba(240,120,110,.18)"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 52, ey + 46, 22, 10, 0, 0, TAU); g.fill(); } }
  if (o.whiskers) { g.strokeStyle = "rgba(60,30,20,.7)"; g.lineWidth = 3; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx + s * 34, ey + 36 + k * 9); g.lineTo(cx + s * 62, ey + 32 + k * 11); g.stroke(); } }
  for (const s of [-1, 1]) {
    const x = cx + s * 40, w = 29, h = o.eyeH || 27;
    if (o.closed) { g.strokeStyle = "#1a1012"; g.lineWidth = 5; g.beginPath(); g.moveTo(x - w, ey); g.quadraticCurveTo(x, ey + 8, x + w, ey); g.stroke(); continue; }
    g.save(); g.beginPath(); g.ellipse(x, ey, w, h, 0, 0, TAU); g.clip();
    g.fillStyle = "#fbfbff"; g.fillRect(x - w, ey - h, w * 2, h * 2);
    const ir = g.createLinearGradient(0, ey - h, 0, ey + h); ir.addColorStop(0, o.irisTop || "#0d2a6a"); ir.addColorStop(1, o.iris);
    g.fillStyle = ir; g.beginPath(); g.ellipse(x + s * 2 + (o.look || 0), ey + 2, w * .62, h * .95, 0, 0, TAU); g.fill();
    g.fillStyle = "#0a0a14"; g.beginPath(); g.ellipse(x + s * 2 + (o.look || 0), ey + 4, w * .26, h * .42, 0, 0, TAU); g.fill();
    if (o.glow) { g.fillStyle = "rgba(200,240,255,.55)"; g.beginPath(); g.ellipse(x + s * 2, ey + 8, w * .5, h * .4, 0, 0, TAU); g.fill(); }
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x - 6 + (o.look || 0), ey - 7, 6, 7, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 7 + (o.look || 0), ey + 9, 3, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = o.lash || "#140c10"; g.lineCap = "round";               // upper lash: heavy, flicked at the outer corner
    g.lineWidth = 7; g.beginPath(); g.moveTo(x - s * w * 1.05, ey - h * .25); g.quadraticCurveTo(x, ey - h * 1.35, x + s * w * 1.15, ey - h * .55); g.stroke();
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - s * w * .7, ey + h * .95); g.quadraticCurveTo(x, ey + h * 1.15, x + s * w * .8, ey + h * .8); g.stroke();
    g.lineWidth = 6; g.strokeStyle = o.brow || "#2a1a10"; const bt = o.angry ? 10 : -4;  // brows set the mood
    g.beginPath(); g.moveTo(x - s * w * 1.05, ey - h - 22 - bt * .2); g.quadraticCurveTo(x, ey - h - 30, x + s * w * 1.1, ey - h - 22 + bt); g.stroke();
  }
  g.strokeStyle = "rgba(120,60,50,.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 2, ey + 34); g.lineTo(cx - 3, ey + 44); g.stroke();
  g.lineCap = "round";
  if (o.mouth === "shout") { g.fillStyle = "#3a0d12"; g.beginPath(); g.moveTo(cx - 22, ey + 66); g.quadraticCurveTo(cx, ey + 100, cx + 22, ey + 66); g.closePath(); g.fill(); g.fillStyle = "#fff"; g.fillRect(cx - 18, ey + 66, 36, 6); }
  else if (o.mouth === "grin") { g.fillStyle = "#fff"; g.beginPath(); g.moveTo(cx - 24, ey + 66); g.quadraticCurveTo(cx, ey + 84, cx + 24, ey + 66); g.closePath(); g.fill(); g.strokeStyle = "#2a1012"; g.lineWidth = 3.5; g.stroke(); }
  else if (o.mouth === "smirk") { g.strokeStyle = "#3a1a18"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx - 14, ey + 70); g.quadraticCurveTo(cx + 4, ey + 74, cx + 18, ey + 64); g.stroke(); }
  else { g.strokeStyle = "#3a1a18"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx - 12, ey + 70); g.lineTo(cx + 12, ey + 70); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* ---------- a fighter ---------- */
export function fighter(o) {
  const root = new THREE.Group(), J = {}; reseed(o.seed || 3);
  const hip = J.hip = grp(root, 0, .93, 0);
  part(LIMB.pelvis, o.pants, hip, 0, -.06, 0);
  if (o.belt) part(new THREE.TorusGeometry(.142, .018, 8, 32), o.belt, hip, 0, .07, 0).rotation.x = Math.PI / 2;
  if (o.hem) { const h = part(lathe([[0, -o.hem], [.2, -o.hem], [.18, -.02], [.158, .1], [.15, .2], [0, .2]], 28), o.hemCol || o.top, hip, 0, -.04, 0); h.scale.set(1, 1, .78); }
  const spine = J.spine = grp(hip, 0, .08, 0);
  const chest = part(LIMB.chest, o.top, spine, 0, 0, 0);
  if (o.yoke) { const y = part(lathe([[.0, .31], [.188, .31], [.19, .37], [.165, .44], [.08, .48], [0, .49]], 28), o.yoke, spine); y.scale.set(1.02, 1.01, .68); }
  if (o.zip) part(new THREE.BoxGeometry(.012, .3, .01), o.zip, spine, 0, .17, .132, false);
  if (o.collar) part(new THREE.CylinderGeometry(.085, .115, o.collarH || .12, 20, 1, true), o.collar, spine, 0, .5, 0).material.side = THREE.DoubleSide;
  const neck = J.neck = grp(spine, 0, .48, 0);
  part(new THREE.CylinderGeometry(.042, .05, .1, 12), o.skin, neck, 0, .04, 0);
  const head = J.head = grp(neck, 0, .2, 0);
  part(HEAD, OPT.faces ? new THREE.MeshToonMaterial({ map: faceTex(o.face || { skin: o.skin, iris: "#2a6ad8" }), gradientMap: ramp }) : toon(o.skin), head);
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(.026, 12, 8), o.skin, head, s * .122, -.01, -.005).scale.set(.5, 1, .8); // ears
  if (o.band) { const b = part(new THREE.CylinderGeometry(.137, .137, .04, 28, 1, true), new THREE.MeshToonMaterial({ color: o.band, gradientMap: ramp, side: THREE.DoubleSide }), head, 0, .07, 0); b.rotation.x = -.12;
    part(new THREE.BoxGeometry(.1, .036, .012), toon("#c9d2da"), head, 0, .072, .136, false); }
  if (o.blind) part(new THREE.CylinderGeometry(.136, .136, .06, 28), "#14151b", head, 0, .03, 0);
  // hair: a cap, then clumps fanned out with a curve
  const hair = J.hair = grp(head, 0, .04, -.01);
  part(new THREE.SphereGeometry(.142, 24, 16, 0, TAU, 0, Math.PI * .55), o.hair, hair, 0, -.005, -.006);
  const Y = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
  const N = o.hairN || 0;
  for (let i = 0; i < N; i++) { // crown and sides: clumps grow out of the skull along a designed flow
    const ring = i % 3, a = (i / N) * TAU + ring * .35, elev = [.95, .55, .2][ring];
    const out = new THREE.Vector3(Math.sin(a) * Math.cos(elev), Math.sin(elev), Math.cos(a) * Math.cos(elev));
    if (out.z > .55 && elev < .9) continue;                                  // keep the face clear; bangs come next
    const len = (o.hairLen || .2) * (.75 + rnd() * .5) * (ring === 0 ? 1.1 : 1);
    dir.copy(out).multiplyScalar(o.up ? .55 : 1).add(new THREE.Vector3(0, o.up ? 1.1 : .35, o.up ? -.15 : -.45)).normalize();
    const c = part(bentCone(.045 + rnd() * .02, len, o.up ? -.25 : -.5), o.hair, hair, out.x * .12, out.y * .12, out.z * .12 - .01, false);
    c.quaternion.copy(q.setFromUnitVectors(Y, dir));
  }
  for (let i = 0; i < (o.bangs || 0); i++) { // bangs: short clumps falling over the forehead
    const x = (i / ((o.bangs || 2) - 1) - .5) * .2, len = (o.bangLen || .12) * (.8 + rnd() * .4);
    dir.set(x * 1.5, -1, .55).normalize();
    const c = part(bentCone(.032, len, .35), o.hair, hair, x, .085, .1, false); c.quaternion.copy(q.setFromUnitVectors(Y, dir));
  }
  for (const s of [-1, 1]) {
    const sh = J["sh" + s] = grp(spine, s * .2, .39, 0);
    part(new THREE.SphereGeometry(.068, 16, 12), o.sleeve || o.top, sh);
    part(LIMB.upperArm, o.sleeve || o.top, sh).scale.set(o.loose || 1, 1, o.loose || 1);
    const el = J["el" + s] = grp(sh, 0, -.27, 0);
    part(LIMB.foreArm, o.fore || o.sleeve || o.top, el);
    if (o.cuff) part(new THREE.TorusGeometry(.04, .012, 6, 16), o.cuff, el, 0, -.2, 0).rotation.x = Math.PI / 2;
    const hd = J["hd" + s] = grp(el, 0, -.26, 0);
    const palm = part(new THREE.SphereGeometry(.05, 14, 10), o.glove || o.skin, hd, 0, -.03, 0); palm.scale.set(.75, 1.05, .45);
    part(new THREE.CapsuleGeometry(.014, .03, 4, 8), o.glove || o.skin, hd, s * -.03, -.02, .02).rotation.z = s * .6;
    const th = J["th" + s] = grp(hip, s * .085, -.02, 0);
    part(LIMB.thigh, o.pants, th).scale.set(o.baggy || 1, 1, o.baggy || 1);
    const kn = J["kn" + s] = grp(th, 0, -.41, 0);
    part(LIMB.shin, o.legs || o.pants, kn).scale.set(o.baggy || 1, 1, o.baggy || 1);
    if (o.wrap) part(new THREE.CylinderGeometry(.046, .05, .12, 12), o.wrap, kn, 0, -.33, 0);
    const ft = J["ft" + s] = grp(kn, 0, -.41, 0);
    const shoe = part(new THREE.SphereGeometry(.06, 14, 10), o.shoe || "#1d2230", ft, 0, -.025, .04); shoe.scale.set(.85, .6, 1.75);
  }
  root.userData.J = root.userData.J0 = J; root.userData.o = o; return root;
}

/* ---------- poses (radians per joint) and stepped sampling ---------- */
export const POSE = {
  idle: { y: .93, sh1: [0, 0, .14], "sh-1": [0, 0, -.14], el1: [-.25, 0, 0], "el-1": [-.25, 0, 0], kn1: [.05, 0, 0], "kn-1": [.05, 0, 0] },
  ready: { y: .86, spine: [.18, -.3, 0], sh1: [-.6, .3, .45], el1: [-1.6, 0, 0], "sh-1": [-.9, -.2, -.3], "el-1": [-1.5, 0, 0], th1: [-.55, 0, .14], kn1: [.75, 0, 0], ft1: [-.2, 0, 0], "th-1": [.25, 0, -.12], "kn-1": [.45, 0, 0], "ft-1": [-.1, 0, 0], head: [-.05, .25, 0] },
  seal: { y: .9, spine: [.08, 0, 0], sh1: [-1.05, -.5, .2], el1: [-1.65, 0, 0], "sh-1": [-1.05, .5, -.2], "el-1": [-1.65, 0, 0], hd1: [0, 0, .4], "hd-1": [0, 0, -.4], th1: [-.2, 0, .12], kn1: [.25, 0, 0], "th-1": [-.2, 0, -.12], "kn-1": [.25, 0, 0], head: [.12, 0, 0] },
  charge: { y: .78, spine: [.4, -.5, 0], "sh-1": [-.5, -.2, -.5], "el-1": [-1.3, 0, 0], "hd-1": [-.4, 0, 0], sh1: [.15, .2, .55], el1: [-.4, 0, 0], th1: [-1.0, 0, .16], kn1: [1.3, 0, 0], ft1: [-.3, 0, 0], "th-1": [.55, 0, -.14], "kn-1": [.7, 0, 0], head: [-.15, .4, 0] },
  helper: { y: .76, spine: [.55, .7, 0], sh1: [-1.25, .5, .2], el1: [-.7, 0, 0], "sh-1": [-1.25, -.1, -.3], "el-1": [-.8, 0, 0], th1: [-.9, 0, .2], kn1: [1.2, 0, 0], "th-1": [.3, 0, -.15], "kn-1": [.9, 0, 0], head: [.35, -.2, 0] },
  wind: { y: .74, spine: [.25, -1.0, -.1], "sh-1": [.4, -.3, -.4], "el-1": [-1.2, 0, 0], sh1: [-.4, .3, .7], el1: [-1.1, 0, 0], th1: [-.7, 0, .25], kn1: [1.4, 0, 0], ft1: [-.3, 0, 0], "th-1": [.2, 0, -.2], "kn-1": [1.2, 0, 0], head: [.1, .9, 0] },
  dash: { y: .72, spine: [.75, -.2, 0], "sh-1": [-1.35, -.15, -.1], "el-1": [-.1, 0, 0], sh1: [.9, 0, .35], el1: [-.5, 0, 0], th1: [-1.35, 0, .1], kn1: [1.5, 0, 0], "th-1": [.85, 0, -.1], "kn-1": [1.0, 0, 0], "ft-1": [.6, 0, 0], head: [-.55, .1, 0] },
  strike: { y: .8, spine: [.45, .35, 0], "sh-1": [-1.62, -.2, .05], "el-1": [0, 0, 0], sh1: [.6, 0, .5], el1: [-.9, 0, 0], th1: [-1.1, 0, .12], kn1: [.9, 0, 0], ft1: [-.1, 0, 0], "th-1": [.7, 0, -.12], "kn-1": [.25, 0, 0], head: [-.3, -.2, 0] },
  follow: { y: .84, spine: [.3, .6, .1], "sh-1": [-1.2, -.6, -.3], "el-1": [-.3, 0, 0], sh1: [.4, 0, .9], el1: [-.6, 0, 0], th1: [-.8, 0, .15], kn1: [.6, 0, 0], "th-1": [.45, 0, -.15], "kn-1": [.3, 0, 0], head: [-.1, -.4, 0] },
  grin: { y: .92, spine: [-.05, .2, 0], sh1: [-.2, 0, .3], el1: [-2.2, 0, 0], hd1: [0, 0, 0], "sh-1": [.1, 0, -.2], "el-1": [-.3, 0, 0], th1: [0, 0, .1], "th-1": [0, 0, -.12], head: [-.08, -.2, .08] },
  purple: { y: .9, spine: [.08, .5, 0], "sh-1": [-1.5, -.25, 0], "el-1": [-.05, 0, 0], sh1: [-1.3, .6, .1], el1: [-.45, 0, 0], th1: [-.35, 0, .2], kn1: [.4, 0, 0], "th-1": [.25, 0, -.18], "kn-1": [.3, 0, 0], head: [.05, .45, 0] },
  // the dummy's repertoire
  guard: { y: .84, spine: [.22, 0, 0], sh1: [-1.25, .25, .55], el1: [-2.0, 0, 0], "sh-1": [-1.25, -.25, -.55], "el-1": [-2.0, 0, 0], th1: [-.55, 0, .14], kn1: [.85, 0, 0], ft1: [-.3, 0, 0], "th-1": [.25, 0, -.14], "kn-1": [.5, 0, 0], head: [.2, 0, 0] },
  brace: { y: .78, spine: [.38, 0, 0], sh1: [-1.45, .3, .3], el1: [-2.2, 0, 0], "sh-1": [-1.45, -.3, -.3], "el-1": [-2.2, 0, 0], th1: [-.9, 0, .2], kn1: [1.3, 0, 0], ft1: [-.4, 0, 0], "th-1": [.4, 0, -.2], "kn-1": [.9, 0, 0], head: [.35, 0, 0] },
  hit: { y: .9, spine: [-.75, 0, .15], sh1: [.6, 0, 1.3], el1: [-.4, 0, 0], "sh-1": [.5, 0, -1.4], "el-1": [-.3, 0, 0], th1: [-.6, 0, .2], kn1: [.5, 0, 0], "th-1": [.3, 0, -.2], "kn-1": [.2, 0, 0], head: [-.8, 0, .2] },
  fly: { y: .93, spine: [-1.2, 0, .3], sh1: [.3, 0, 2.2], el1: [-.2, 0, 0], "sh-1": [.4, 0, -2.0], "el-1": [-.2, 0, 0], th1: [-1.3, 0, .3], kn1: [1.1, 0, 0], "th-1": [-.6, 0, -.25], "kn-1": [.4, 0, 0], head: [-.6, 0, 0] },
  down: { y: .2, spine: [-.2, 0, 0], sh1: [-.2, 0, 1.1], el1: [-.6, 0, 0], "sh-1": [-.1, 0, -1.2], "el-1": [-.5, 0, 0], th1: [-1.4, 0, .2], kn1: [1.6, 0, 0], "th-1": [-.3, 0, -.3], "kn-1": [.4, 0, 0], head: [.3, 0, 0] },
  crouch: { y: .52, spine: [.5, 0, 0], sh1: [-.6, 0, .5], el1: [-1.4, 0, 0], "sh-1": [.2, 0, -.6], "el-1": [-.2, 0, 0], th1: [-1.7, 0, .2], kn1: [2.2, 0, 0], ft1: [-.4, 0, 0], "th-1": [-.4, 0, -.25], "kn-1": [2.3, 0, 0], head: [-.4, 0, 0] },
  dodge: { y: .8, spine: [.1, .2, -.55], sh1: [-.4, 0, 1.4], el1: [-.3, 0, 0], "sh-1": [-.9, 0, -.4], "el-1": [-1.6, 0, 0], th1: [-.2, 0, .55], kn1: [.5, 0, 0], "th-1": [-.9, 0, -.2], "kn-1": [1.6, 0, 0], head: [0, 0, -.3] },
};
const JOINTS = ["spine", "neck", "head", "sh1", "sh-1", "el1", "el-1", "hd1", "hd-1", "th1", "th-1", "kn1", "kn-1", "ft1", "ft-1"];
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler();
export function blend(f, a, b, t) { // ease between two poses (callers step t for limited animation)
  const J = f.userData.J; J.hip.position.y = (a.y ?? .93) + ((b.y ?? .93) - (a.y ?? .93)) * t;
  for (const k of JOINTS) { if (!J[k]) continue; const ra = a[k] || [0, 0, 0], rb = b[k] || [0, 0, 0];
    q1.setFromEuler(e.set(ra[0], ra[1], ra[2])); q2.setFromEuler(e.set(rb[0], rb[1], rb[2])); J[k].quaternion.slerpQuaternions(q1, q2, t); }
  return f;
}
export const pose = (f, p) => blend(f, p, p, 0);
export const ease = { out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t, io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };

/* ---------- the cast used by the mockups ---------- */
export const CAST = {
  naruto: { top: "#f2862a", pants: "#f2862a", yoke: "#1c1f2b", zip: "#f4f4f4", skin: "#f5cfa8", hair: "#ffd43a", band: "#1e2a50", shoe: "#24346a", wrap: "#f2f2f2", legs: "#f2862a", cuff: "#1c1f2b", hairN: 30, hairLen: .2, bangs: 7, bangLen: .13, baggy: 1.15, loose: 1.15, hem: .14, seed: 4,
    face: { skin: "#f5cfa8", iris: "#3a8cff", irisTop: "#123a8a", whiskers: true, angry: true, mouth: "shout", brow: "#c58a1a" } },
  gojo: { top: "#16171f", pants: "#16171f", collar: "#16171f", collarH: .16, zip: "#9aa0b4", skin: "#f6e0cc", hair: "#f6f8ff", shoe: "#0d0d12", hairN: 33, hairLen: .19, up: true, bangs: 6, bangLen: .15, baggy: 1.25, hem: .3, seed: 12,
    face: { skin: "#f6e0cc", iris: "#7fe0ff", irisTop: "#1a6aff", glow: true, mouth: "smirk", brow: "#dfe6f0", lash: "#c8d2e0", eyeH: 20 } },
  dummy: { top: "#c49a5e", pants: "#a87c45", skin: "#d7b177", sleeve: "#c49a5e", fore: "#d7b177", hair: "#6a4a28", hairN: 0, hairLen: .01, shoe: "#5a3e22", wrap: "#e8dcc0", belt: "#4a3420", seed: 5,
    face: { skin: "#d7b177", iris: "#2a1a10", irisTop: "#120a06", angry: true, mouth: "flat", brow: "#4a2e14", lash: "#2a1a10", eyeH: 12 } },
};
