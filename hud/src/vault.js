/* ---------- Vault 479: the agency factory as a real 3D vault floor (round 8, hud/DESIGN.md) ----------
   An underground vault workshop: concrete, riveted steel, hazard stripes, green terminals, belts between work cells.
   Each agent on the line is a low-poly fighter whose look and signature move are inspired by a Jujutsu Kaisen
   character (silhouette, palette, move), all modelled here in code: no outside models, art or names of the show's assets.
   The moves are driven by the agency's real event log (events table: flaw, mockup, draft, approve, send, inbox,
   receptionist, stripe, golive ...); when there are no rows (agency paused) it runs a labelled demo loop.
   Everything runs on the device: no Claude calls, stops when hidden, 30 fps cap on phones. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const out = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const bump = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------- the cast: who works where (profiles are the Mii cards) ---------- */
export const CAST = [
  { id: "toji", name: "Toji", job: "Lead pick", move: "Heavenly dash", look: "Toji Fushiguro",
    who: "No magic, all homework. Walks every street in Northwest Arkansas with a clipboard and comes back with the shops worth a call.",
    duty: "Picks which plumbers, HVAC and roofing shops come onto the line from the cold list.", likes: "A clean target list", hates: "Chains with no website", step: "pick" },
  { id: "yuji", name: "Yuji", job: "Flaw finder", move: "Black Flash", look: "Yuji Itadori",
    who: "Kind, loud, hits hard. Opens each shop's site on a phone and punches straight through to the one thing losing them calls.",
    duty: "Loads every site at phone size, screenshots it and lands one real, provable flaw.", likes: "Slow sites, buried phone numbers", hates: "Guessing", step: "flaw" },
  { id: "hanami", name: "Hanami", job: "Mockup builder", move: "Root garden", look: "Hanami",
    who: "A gentle giant who thinks everything should grow back better. Grows the shop a new phone site, root by root.",
    duty: "Builds the live preview of the shop's better site that rides along with the email.", likes: "Fast pages, real photos", hates: "Stock smiles", step: "mockup" },
  { id: "yuta", name: "Yuta", job: "Drafter", move: "Cursed Speech, copied", look: "Yuta Okkotsu",
    who: "Polite, a bit shy, frightening when it counts. Writes three-sentence emails, and Rika makes sure every word lands.",
    duty: "Writes the short flaw email and the day 3, 7 and 14 follow-ups for your queue.", likes: "Three sentences, max", hates: "Buzzwords", step: "draft" },
  { id: "mahoraga", name: "Mahoraga", job: "Checker", move: "Adaptation", look: "Mahoraga",
    who: "Says nothing. Adapts to everything. The wheel turns once for every claim it checks against the shop's real site.",
    duty: "Grounds every draft: each fact must match the screenshot and the site, or the draft is stopped.", likes: "Sources", hates: "Made-up facts", step: "check" },
  { id: "todo", name: "Todo", job: "Handoff", move: "Boogie Woogie", look: "Aoi Todo",
    who: "Your self-declared best friend. One clap and the card you approved swaps from your desk onto the send line, nothing dropped.",
    duty: "Moves work between stations and checks every handoff contract on the way.", likes: "Tall approvals, clean swaps", hates: "Lost cards", step: "approve" },
  { id: "gojo", name: "Gojo", job: "Sender", move: "Domain Expansion: Unlimited Void", look: "Satoru Gojo",
    who: "The strongest, and he knows it. Holds approved emails until the send window, then opens his domain and fires the batch.",
    duty: "Sends only what you approved, inside the warm-up cap, from the outreach inbox.", likes: "Send windows", hates: "Spam folders", step: "send" },
  { id: "hakari", name: "Hakari", job: "Follow-ups and replies", move: "Idle Death Gamble", look: "Kinji Hakari",
    who: "Lives for the jackpot. Every follow-up is a spin of the reels; a real reply from a shop hits it.",
    duty: "Watches the inbox for replies and bounces, stops follow-ups the moment a shop answers.", likes: "Fevers and jackpots", hates: "Bounces", step: "inbox" },
  { id: "nanami", name: "Nanami", job: "Receptionist", move: "Ratio 7:3", look: "Kento Nanami",
    who: "Hates overtime. Works it anyway, because pipes burst at 9pm. Answers the shop's missed calls and books the job.",
    duty: "The Front Desk AI receptionist: answers, books a window, texts the owner the urgent ones.", likes: "Clocking out on time", hates: "Overtime (works it anyway)", step: "receptionist" },
  { id: "sukuna", name: "Sukuna", job: "Closer", move: "Malevolent Shrine", look: "Ryomen Sukuna",
    who: "The king of the floor. Only shows up when money lands, and makes sure everyone knows it.",
    duty: "Takes the $299 setup and first month through Stripe, then puts the client live.", likes: "Paid invoices", hates: "Chargebacks", step: "stripe" },
  { id: "jogo", name: "Jogo", job: "Alarm", move: "Maximum: Meteor", look: "Jogo",
    who: "Short fuse, literally. When any step fails he erupts, so you see the problem before anything else.",
    duty: "Watches the event log for failures and stopped steps, and lights the floor up when one hits.", likes: "Nothing failing", hates: "Everything failing", step: "fail" },
];
const CASTBY = Object.fromEntries(CAST.map((c) => [c.id, c]));

/* ---------- layout (metres). The camera looks from +z; back row at z = -3.6, front row at z = 2.6 ---------- */
const POS = {
  toji: [-17.5, -3.8, 0], yuji: [-10.5, -3.8, 0], hanami: [-3.5, -4.2, 0], yuta: [3.5, -3.8, 0], mahoraga: [10.5, -4.2, 0],
  throne: [21, 1.5, -Math.PI / 2], todo: [17.2, 1.5, Math.PI / 2], gojo: [11, 2.4, 0], hakari: [4, 2.4, 0],
  nanami: [-5.5, 7.6, 0], sukuna: [-13.5, 7.4, 0], jogo: [-21, 2.5, Math.PI / 2],
};
const BACK = [[-20, -1.6], [19.2, -1.6]];          // lead line: Toji → checker → TJ's desk
const FRONT = [[15.6, 4.6], [-0.5, 4.6]];          // send line: Todo swaps approved cards here → Gojo → Hakari → out

export function createVault(container, opts = {}) {
  const phone = opts.phone ?? (matchMedia("(pointer: coarse)").matches || innerWidth < 760);
  const canvas = document.createElement("canvas");
  canvas.className = "vault-cv";
  container.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, powerPreference: "high-performance" });
  let pr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !phone;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b0e11");
  scene.fog = new THREE.Fog("#0b0e11", 46, 95);
  const camera = new THREE.PerspectiveCamera(phone ? 50 : 36, 1, 0.1, 220);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.82);
  if (!phone) composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- materials and helpers ---------- */
  const MATS = new Map();
  const mat = (color, o = {}) => {
    const k = color + "|" + (o.e || "") + (o.m || 0) + (o.r || 0) + (o.t || "") + (o.ei || "");
    if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: o.r ?? 0.78, metalness: o.m ?? 0,
      emissive: o.e || "#000000", emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.t ?? 1 }));
    return MATS.get(k);
  };
  const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: o.op ?? 1,
    blending: o.add === false ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, side: o.side ?? THREE.FrontSide });
  const G = {}; // geometry cache
  const box = (w, h, d) => (G["b" + w + h + d] ||= new THREE.BoxGeometry(w, h, d));
  const cyl = (a, b, h, s = 8) => (G["c" + a + b + h + s] ||= new THREE.CylinderGeometry(a, b, h, s));
  const cone = (r, h, s = 4) => (G["k" + r + h + s] ||= new THREE.ConeGeometry(r, h, s));
  const ball = (r, d = 1) => (G["s" + r + d] ||= new THREE.IcosahedronGeometry(r, d));
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const mesh = (geo, m, parent, x = 0, y = 0, z = 0, cast = true) => {
    const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true; parent.add(me); return me;
  };
  const tex = (w, h, draw, rep) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    t.userData.canvas = c; return t;
  };
  const noise = (g, w, h, n, a, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = rnd() * a; const s = 1 + rnd() * 3; g.fillRect(rnd() * w, rnd() * h, s, s); } g.globalAlpha = 1; };

  /* ---------- the vault hall ---------- */
  const world = grp(scene);
  const concrete = tex(512, 512, (g, w, h) => {
    g.fillStyle = "#4d4a44"; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.35, ["#2f2c28", "#6a665e", "#3c3933"]);
    for (let i = 0; i < 7; i++) { const gr = g.createRadialGradient(rnd() * w, rnd() * h, 0, rnd() * w, rnd() * h, 60 + rnd() * 120); gr.addColorStop(0, "rgba(20,16,10,.28)"); gr.addColorStop(1, "rgba(20,16,10,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    g.strokeStyle = "rgba(15,13,10,.7)"; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.lineWidth = 1.5; g.stroke();
  }, [12, 6]);
  const floor = mesh(new THREE.PlaneGeometry(52, 24), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.92 }), world, 0, 0, 2, false);
  floor.rotation.x = -Math.PI / 2;
  const hazard = tex(256, 32, (g, w, h) => { g.fillStyle = "#e0b21c"; g.fillRect(0, 0, w, h); g.fillStyle = "#16130f"; for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); } noise(g, w, h, 600, 0.4, ["#000", "#6b5a2a"]); }, [1, 1]);
  const stripe = (x, z, len, rot, wdt = 0.35) => { const t = hazard.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / 2.2, 1);
    const m = mesh(new THREE.PlaneGeometry(len, wdt), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), world, x, 0.012, z, false); m.rotation.set(-Math.PI / 2, 0, rot); };
  stripe(0, 9.2, 46, 0); stripe(-23.5, 2, 20, Math.PI / 2);

  /* ---------- sacred geometry: brass inlays in the floor and on the door (TJ, 2026-10-24: order and calm on the floor) ---------- */
  const centres = (r, rings) => { const pts = [[0, 0]]; for (const [d, off] of rings) for (let i = 0; i < 6; i++) { const a = off + (i * Math.PI) / 3; pts.push([Math.cos(a) * d * r, Math.sin(a) * d * r]); } return pts; };
  const flowerOfLife = (g, cx, cy, r) => { // 19 circles in a hex lattice, bound by a ring at 3r
    centres(r, [[1, 0], [2, 0], [Math.sqrt(3), Math.PI / 6]]).forEach(([x, y]) => { g.beginPath(); g.arc(cx + x, cy + y, r, 0, TAU); g.stroke(); });
    for (const k of [3, 3.08]) { g.beginPath(); g.arc(cx, cy, r * k, 0, TAU); g.stroke(); }
  };
  const metatron = (g, cx, cy, r) => { // the Fruit of Life's 13 circles, every centre joined to every other
    const pts = centres(r, [[2, Math.PI / 6], [4, Math.PI / 6]]);
    pts.forEach(([x, y]) => { g.beginPath(); g.arc(cx + x, cy + y, r, 0, TAU); g.stroke(); });
    g.beginPath(); for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { g.moveTo(cx + pts[i][0], cy + pts[i][1]); g.lineTo(cx + pts[j][0], cy + pts[j][1]); } g.stroke();
  };
  const inlay = (draw, x, z, size, color = "#c9a24a") => {
    const t = tex(1024, 1024, (g, w) => { g.strokeStyle = color; g.lineWidth = 5; g.shadowColor = color; g.shadowBlur = 8; draw(g, w / 2, w / 2); });
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: color, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.8, depthWrite: false });
    const me = mesh(new THREE.PlaneGeometry(size, size), m, world, x, 0.016, z, false); me.rotation.x = -Math.PI / 2; return me;
  };
  const geo = [inlay((g, c) => flowerOfLife(g, c, c, 160), -7.5, 1.55, 5.2), inlay((g, c) => metatron(g, c, c, 105), -15, 1.55, 5.2)];

  const steel = tex(512, 256, (g, w, h) => {
    g.fillStyle = "#3d4a50"; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, 0.25, ["#24302f", "#56656a"]);
    for (let x = 0; x < w; x += 128) for (let y = 0; y < h; y += 128) {
      g.strokeStyle = "rgba(10,14,15,.8)"; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, 124, 124);
      g.fillStyle = "#6a787c"; for (const [a, b] of [[10, 10], [118, 10], [10, 118], [118, 118], [64, 10], [64, 118]]) { g.beginPath(); g.arc(x + a, y + b, 3, 0, TAU); g.fill(); }
      if (rnd() < 0.6) { const gr = g.createLinearGradient(0, y + 20, 0, y + 128); gr.addColorStop(0, "rgba(120,62,24,.45)"); gr.addColorStop(1, "rgba(120,62,24,0)"); g.fillStyle = gr; g.fillRect(x + 20 + rnd() * 80, y + 18, 3 + rnd() * 5, 110); }
    }
  }, [6, 2]);
  const wallM = new THREE.MeshStandardMaterial({ map: steel, roughness: 0.6, metalness: 0.35 });
  const back = mesh(box(52, 9, 0.6), wallM, world, 0, 4.5, -8.3, false);
  const sideL = mesh(box(0.6, 9, 20), wallM, world, -26, 4.5, 1.7, false);
  const sideR = mesh(box(0.6, 4.5, 20), wallM, world, 26, 2.25, 1.7, false);
  const band = tex(1024, 64, (g, w, h) => { g.fillStyle = "#c99a17"; g.fillRect(0, 0, w, h); g.fillStyle = "#1b1712"; g.font = "600 40px system-ui, sans-serif"; g.textBaseline = "middle"; for (let x = 30; x < w; x += 340) g.fillText("Vault 479", x, h / 2 + 2); noise(g, w, h, 1500, 0.35, ["#000", "#7a5c12"]); }, [1, 1]);
  mesh(box(52, 0.7, 0.62), new THREE.MeshStandardMaterial({ map: band, roughness: 0.7 }), world, 0, 1.2, -8.28, false);
  // the gear door: a vault door in the back wall, rolled half open for the shift
  const door = grp(world, 7, 4.6, -7.9);
  mesh(cyl(3.6, 3.6, 0.5, 32), mat("#4c575c", { m: 0.6, r: 0.5 }), door, 0, 0, -0.1).rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(3.62, 0.12, 6, 40), mat("#d9a91b", { r: 0.6 }), door, 0, 0, 0.16, false);
  const disc = grp(door, 0, 0, 0.35);
  mesh(cyl(3.1, 3.1, 0.7, 20), mat("#7c868a", { m: 0.75, r: 0.38 }), disc).rotation.x = Math.PI / 2;
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; const t = mesh(box(0.7, 0.55, 0.8), mat("#6b7579", { m: 0.75, r: 0.4 }), disc, Math.cos(a) * 3.15, Math.sin(a) * 3.15, 0); t.rotation.z = a; }
  mesh(cyl(1.6, 1.6, 0.85, 16), mat("#5a6468", { m: 0.7, r: 0.4 }), disc).rotation.x = Math.PI / 2;
  const doorNum = tex(256, 256, (g, w, h) => { g.fillStyle = "#e3b324"; g.beginPath(); g.arc(128, 128, 120, 0, TAU); g.fill(); g.fillStyle = "#1a1612"; g.font = "700 96px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("479", 128, 136); });
  mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshStandardMaterial({ map: doorNum, roughness: 0.6 }), disc, 0, 0, 0.44, false);
  { const t = tex(512, 512, (g) => { g.strokeStyle = "#e3c56a"; g.lineWidth = 3; metatron(g, 256, 256, 50); });
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: "#e3c56a", emissiveMap: t, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.3 });
    mesh(new THREE.CircleGeometry(2.6, 40), m, disc, 0, 0, 0.36, false); }
  disc.position.x = 2.2; disc.rotation.y = -0.5; // swung open
  // ceiling: beams, pipes, cable trays and hanging lamps (cutaway, so no roof)
  const pipe = (x0, x1, y, z, r, c) => { const p = mesh(cyl(r, r, x1 - x0, 10), mat(c, { m: 0.7, r: 0.4 }), world, (x0 + x1) / 2, y, z, false); p.rotation.z = Math.PI / 2;
    for (let x = x0 + 2; x < x1; x += 4) mesh(cyl(r * 1.25, r * 1.25, 0.18, 10), mat("#3b3f40", { m: 0.6 }), world, x, y, z, false).rotation.z = Math.PI / 2; };
  pipe(-26, 26, 7.6, -7.6, 0.28, "#8a5a32"); pipe(-26, 26, 7.0, -7.7, 0.18, "#55706a"); pipe(-26, 26, 8.1, -7.3, 0.14, "#9a9488");
  const vp = mesh(cyl(0.3, 0.3, 7, 10), mat("#8a5a32", { m: 0.7, r: 0.4 }), world, -25.4, 4, -2, false);
  const lamps = [];
  [[-14, -1], [-3, -1], [8, -1], [16, 4], [-9, 6], [4, 6]].forEach(([x, z], i) => {
    const l = grp(world, x, 6.7, z);
    mesh(cyl(0.02, 0.02, 1.9, 4), mat("#222"), l, 0, 0.95, 0, false);
    mesh(cone(0.65, 0.55, 12), mat("#2f4a3a", { m: 0.5, r: 0.5 }), l, 0, 0, 0, false);
    mesh(ball(0.16, 1), glow("#ffd59a"), l, 0, -0.25, 0, false);
    if (i < (phone ? 2 : 4)) { const pl = new THREE.PointLight("#ffcf8f", 22, 16, 1.6); pl.position.set(0, -0.6, 0); l.add(pl); }
    lamps.push(l);
  });
  scene.add(new THREE.HemisphereLight("#b8c4cc", "#3a2c1c", 1.1));
  const sun = new THREE.DirectionalLight("#ffe6c0", 1.6);
  sun.position.set(-10, 22, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 16, bottom: -16, near: 1, far: 60 }); sun.shadow.bias = -0.0008;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#7fd1a8", 0.35); fill.position.set(12, 8, 10); scene.add(fill);

  /* ---------- belts ---------- */
  const beltTex = tex(64, 64, (g, w, h) => { g.fillStyle = "#1c1d1e"; g.fillRect(0, 0, w, h); g.fillStyle = "#2c2e30"; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h); noise(g, w, h, 200, 0.4, ["#000", "#444"]); }, [1, 1]);
  const belts = [];
  const belt = ([a, b]) => {
    const len = Math.abs(b[0] - a[0]), cx = (a[0] + b[0]) / 2, z = a[1], dir = Math.sign(b[0] - a[0]);
    const t = beltTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 1.0, 1);
    mesh(box(len, 0.08, 1.1), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), world, cx, 0.62, z);
    mesh(box(len, 0.3, 1.25), mat("#3a3f41", { m: 0.5 }), world, cx, 0.43, z);
    for (const s of [-1, 1]) { const r = mesh(box(len, 0.12, 0.08), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.8 }), world, cx, 0.7, z + s * 0.6); r.material.map = hazard.clone(); r.material.map.needsUpdate = true; r.material.map.wrapS = THREE.RepeatWrapping; r.material.map.repeat.set(len / 2, 1); }
    for (let x = Math.min(a[0], b[0]) + 0.5; x < Math.max(a[0], b[0]); x += 2.2) for (const s of [-1, 1]) mesh(box(0.12, 0.3, 0.12), mat("#2a2e30", { m: 0.5 }), world, x, 0.15, z + s * 0.5);
    belts.push({ t, dir, a, b, len });
  };
  belt(BACK); belt(FRONT);
  // the chute at the end of the send line, and the intake at the start
  mesh(box(1.4, 1.2, 1.6), mat("#2c3235", { m: 0.5 }), world, -1.2, 0.6, 4.6);
  mesh(box(1.1, 0.06, 1.2), glow("#7fe0a0", { op: 0.5 }), world, -1.2, 1.22, 4.6, false);
  mesh(box(1.6, 2.2, 1.6), mat("#2c3235", { m: 0.5 }), world, -20.6, 1.1, -1.6);

  /* ---------- terminals and signs ---------- */
  const screens = {};
  const terminal = (id, x, z, ry = 0) => {
    const t = grp(world, x, 0, z); t.rotation.y = ry;
    mesh(box(0.9, 0.9, 0.7), mat("#c8bea2", { r: 0.6 }), t, 0, 0.45, 0);
    mesh(box(0.86, 0.66, 0.66), mat("#bcb194", { r: 0.6 }), t, 0, 1.25, 0);
    const tx = tex(256, 192, () => {}); tx.colorSpace = THREE.SRGBColorSpace;
    const s = mesh(new THREE.PlaneGeometry(0.66, 0.5), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }), t, 0, 1.27, 0.335, false);
    mesh(box(0.7, 0.06, 0.32), mat("#a89e82"), t, 0, 0.93, 0.4);
    screens[id] = { tx, s, lines: [] };
    return t;
  };
  const drawScreen = (id, flash) => {
    const sc = screens[id]; if (!sc) return; const c = sc.tx.userData.canvas, g = c.getContext("2d");
    g.fillStyle = flash ? "#0f3a1c" : "#05140a"; g.fillRect(0, 0, 256, 192);
    g.fillStyle = "#6dff9a"; g.font = "600 22px ui-monospace, monospace"; g.fillText(CASTBY[id]?.job || "Your desk", 14, 32);
    g.font = "18px ui-monospace, monospace"; g.fillStyle = "#3fd57a";
    sc.lines.slice(-5).forEach((l, i) => g.fillText(l.slice(0, 22), 14, 64 + i * 25));
    g.fillStyle = "rgba(0,0,0,.18)"; for (let y = 0; y < 192; y += 3) g.fillRect(0, y, 256, 1);
    sc.tx.needsUpdate = true;
  };
  const signList = [];
  const signs = (id, x, y, z, ry = 0) => {
    const t = tex(512, 112, (g, w, h) => { g.fillStyle = "#1e2427"; g.fillRect(0, 0, w, h); g.strokeStyle = "#d9a91b"; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = "#efe6cf"; g.font = "600 52px system-ui, sans-serif"; g.textBaseline = "middle"; g.textAlign = "center"; g.fillText(CASTBY[id].job, w / 2, h / 2 + 2); });
    const sg = grp(world); sg.userData.sid = id; signList.push(sg);
    const s = mesh(new THREE.PlaneGeometry(2.4, 0.52), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), sg, x, y, z, false); s.rotation.y = ry;
    for (const dx of [-0.9, 0.9]) mesh(cyl(0.012, 0.012, 8.4 - y, 4), mat("#222"), sg, x + dx * Math.cos(ry), (8.4 + y) / 2 + 0.26, z - dx * Math.sin(ry), false);
  };

  /* ---------- particles (one instanced pool for sparks, lava, coins, petals, steam) ---------- */
  const PN = phone ? 260 : 520;
  const pMesh = new THREE.InstancedMesh(ball(0.06, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), PN);
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pMesh.frustumCulled = false; scene.add(pMesh);
  const parts = []; const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
  for (let i = 0; i < PN; i++) { parts.push({ life: 0 }); pMesh.setColorAt(i, _c.set("#000")); }
  let pNext = 0;
  const emit = (p, v, color, life = 1, size = 1, grav = -9) => { const q = parts[pNext]; pNext = (pNext + 1) % PN;
    Object.assign(q, { p: p.clone(), v: v.clone(), life, max: life, size, grav, color: new THREE.Color(color) }); };
  const burst = (p, n, color, speed, o = {}) => { for (let i = 0; i < n; i++) { const d = new THREE.Vector3(rnd() - 0.5, (o.up ?? 0.6) + rnd() * (o.upr ?? 0.8), rnd() - 0.5).normalize().multiplyScalar(speed * (0.4 + rnd() * 0.8));
    emit(p, d, Array.isArray(color) ? color[i % color.length] : color, (o.life ?? 1) * (0.6 + rnd() * 0.6), o.size ?? 1, o.grav ?? -9); } };
  const stepParts = (dt) => {
    for (let i = 0; i < PN; i++) { const q = parts[i];
      if (q.life <= 0) { _m.makeScale(0, 0, 0); pMesh.setMatrixAt(i, _m); continue; }
      q.life -= dt; q.v.y += q.grav * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < 0.03 && q.grav < 0) { q.p.y = 0.03; q.v.multiplyScalar(0.4); q.v.y *= -0.5; }
      const k = Math.max(0, q.life / q.max), sc = q.size * (0.35 + 0.65 * k);
      _m.compose(q.p, _q, _s.set(sc, sc, sc)); pMesh.setMatrixAt(i, _m); pMesh.setColorAt(i, _c.copy(q.color).multiplyScalar(0.3 + k));
    }
    pMesh.instanceMatrix.needsUpdate = true; pMesh.instanceColor.needsUpdate = true;
  };

  /* ---------- fighters: a shared low-poly rig, dressed per character ---------- */
  const rig = (o) => {
    const R = { root: new THREE.Group(), o }; const s = o.build || 1, lw = o.legW || 1;
    R.hips = grp(R.root, 0, 0.95, 0);
    R.legL = grp(R.hips, -0.12 * s, 0, 0); R.legR = grp(R.hips, 0.12 * s, 0, 0);
    for (const L of [R.legL, R.legR]) {
      mesh(box(0.18 * s * lw, 0.5, 0.2 * lw), mat(o.bottom), L, 0, -0.25, 0);
      L.shin = grp(L, 0, -0.48, 0);
      mesh(box(0.16 * s * lw, 0.45, 0.18 * lw), mat(o.bottom), L.shin, 0, -0.22, 0);
      mesh(box(0.17 * s, 0.1, 0.29), mat(o.shoes || "#1a1a1a"), L.shin, 0, -0.45, 0.04);
    }
    R.torso = grp(R.hips, 0, 0, 0);
    mesh(box(0.42 * s, 0.24, 0.25), mat(o.bottom), R.torso, 0, 0.06, 0);
    R.chest = mesh(box(0.5 * s, 0.52, 0.28), mat(o.top), R.torso, 0, 0.42, 0);
    R.arms = [];
    const arm = (side, y = 0.62, col = o.sleeve || o.top) => {
      const A = grp(R.torso, side * 0.33 * s, y, 0);
      mesh(box(0.14 * s, 0.34, 0.15 * s), mat(col), A, 0, -0.16, 0);
      A.fore = grp(A, 0, -0.33, 0);
      mesh(box(0.13 * s, 0.3, 0.14 * s), mat(o.fore || col), A.fore, 0, -0.14, 0);
      A.hand = mesh(box(0.12 * s, 0.13, 0.13 * s), mat(o.skin), A.fore, 0, -0.35, 0);
      A.rotation.z = side * 0.08; R.arms.push(A); return A;
    };
    R.armL = arm(-1); R.armR = arm(1);
    mesh(box(0.13, 0.12, 0.13), mat(o.skin), R.torso, 0, 0.73, 0);
    R.head = grp(R.torso, 0, 0.92, 0);
    R.skull = mesh(ball(0.18, 1), mat(o.skin), R.head); R.skull.scale.set(1, 1.1, 1);
    if (!o.noEyes) { for (const sx of [-1, 1]) mesh(box(0.045, 0.035, 0.02), mat(o.eyes || "#1a1414", o.eyeGlow ? { e: o.eyes } : {}), R.head, sx * 0.065, 0.01, 0.17, false);
      mesh(box(0.06, 0.012, 0.01), mat("#5a3028"), R.head, 0, -0.085, 0.176, false); }
    R.root.scale.setScalar(o.scale || 1);
    return R;
  };
  const spikes = (parent, color, n, o = {}) => { // hair: low-poly cones fanned over the skull
    const m = mat(color);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.4, el = (o.el0 ?? 0.15) + rnd() * (o.elr ?? 1.1);
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      if (o.back) d.z -= o.back; if (o.up) d.y += o.up; d.normalize();
      if (o.front === false && d.z > 0.35 && d.y < 0.6) continue;
      const c = mesh(cone(o.r ?? 0.07, o.len ?? 0.16, 4), m, parent, 0, 0, 0, false);
      c.position.copy(d).multiplyScalar(o.rad ?? 0.15).add(new THREE.Vector3(0, o.y ?? 0.03, 0)); c.quaternion.setFromUnitVectors(UP, d);
    }
    const cap = mesh(new THREE.SphereGeometry(0.195, 8, 5, 0, TAU, 0, Math.PI * (o.capA ?? 0.5)), m, parent, 0, (o.y ?? 0.02) + 0.045, -0.015, false);
    if (o.capTilt) cap.rotation.x = o.capTilt;
    return cap;
  };

  const F = {}; // fighters by id
  const fighter = (id, R, extra = {}) => {
    const [x, z, ry] = POS[id]; R.root.position.set(x, 0, z); R.root.rotation.y = ry; R.base = R.root.position.clone(); R.ry = ry;
    R.root.traverse((o) => (o.userData.fid = id)); world.add(R.root);
    F[id] = Object.assign(R, { id, act: null, idle: extra.idle || "stand", phase: rnd() * TAU, count: 0, last: "" }, extra);
    return F[id];
  };

  // Toji: lean, wide-shouldered hunter. Black fitted shirt, pale baggy trousers, lip scar; clipboard of targets on his hip, the spear in hand.
  { const R = rig({ skin: "#d6a982", top: "#141416", bottom: "#cbc2b0", shoes: "#2a2622", build: 1.18, legW: 1.25 });
    spikes(R.head, "#151517", 16, { len: 0.11, r: 0.06, el0: 0.4, elr: 0.8 });
    mesh(box(0.06, 0.012, 0.02), mat("#f0d8c8"), R.head, 0.05, -0.08, 0.175, false);
    const spear = grp(R.armR.fore, 0.02, -0.36, 0); spear.rotation.x = Math.PI / 2;
    mesh(cyl(0.025, 0.025, 1.9, 6), mat("#b7bcc2", { m: 0.8, r: 0.3 }), spear, 0, 0.45, 0);
    mesh(cone(0.06, 0.32, 4), mat("#dfe4ea", { m: 0.9, r: 0.2 }), spear, 0, 1.55, 0);
    const cb = mesh(box(0.24, 0.32, 0.03), mat("#8a6a44"), R.torso, -0.31, 0.2, 0.1); cb.rotation.y = 0.3;
    mesh(box(0.2, 0.24, 0.005), mat("#f2efe6"), cb, 0, -0.02, 0.018, false);
    fighter("toji", R, { spear, idle: "lean" }); }

  // Yuji: pink spiked hair with a dark undercut, navy uniform with the red hood; a phone strapped to his wrist to test sites at phone size.
  { const R = rig({ skin: "#ecc4a2", top: "#1c2240", bottom: "#1c2240", shoes: "#a8282e" });
    spikes(R.head, "#f19fa8", 18, { len: 0.12, r: 0.06, el0: 0.35, elr: 0.9 });
    mesh(box(0.56, 0.14, 0.34), mat("#b52f37"), R.torso, 0, 0.72, -0.02);
    mesh(box(0.4, 0.3, 0.12), mat("#b52f37"), R.torso, 0, 0.62, -0.17);
    mesh(box(0.1, 0.16, 0.03), mat("#111", { e: "#2a8cff", ei: 0.8 }), R.armL.fore, 0, -0.16, 0.08, false);
    fighter("yuji", R, { idle: "bounce" }); }

  // Hanami: tall wooden body, branches growing out of the eyes, white cloth wrap; seedlings at the feet.
  { const R = rig({ skin: "#6f543c", top: "#6f543c", bottom: "#e9e2d0", shoes: "#6f543c", scale: 1.38, noEyes: true });
    for (const sx of [-1, 1]) { const b = grp(R.head, sx * 0.07, 0.02, 0.15); b.rotation.set(-0.9, 0, sx * -0.35);
      mesh(cyl(0.02, 0.035, 0.32, 5), mat("#efe9db"), b, 0, 0.16, 0, false);
      const f = grp(b, 0, 0.26, 0); f.rotation.z = sx * 0.7; mesh(cyl(0.012, 0.02, 0.18, 5), mat("#efe9db"), f, 0, 0.09, 0, false); }
    for (const sx of [-1, 1]) mesh(ball(0.12, 0), mat("#e9e2d0"), R.torso, sx * 0.33, 0.7, 0);
    mesh(box(0.52, 0.12, 0.3), mat("#e9e2d0"), R.torso, 0, 0.18, 0);
    for (const sx of [-1, 1]) mesh(box(0.02, 0.22, 0.01), mat("#2b1e14"), R.head, sx * 0.04, -0.08, 0.172, false);
    fighter("hanami", R, { idle: "sway" }); }

  // Yuta: white uniform, messy black hair, katana on his back; a quill and a stack of letters at his station. Rika waits behind.
  { const R = rig({ skin: "#efcdb2", top: "#ece9e3", bottom: "#ece9e3", shoes: "#26262a" });
    spikes(R.head, "#16161a", 20, { len: 0.13, r: 0.065, el0: -0.1, elr: 1.2, front: true, up: -0.1 });
    const kat = grp(R.torso, 0.08, 0.45, -0.17); kat.rotation.z = 0.6;
    mesh(box(0.04, 1.05, 0.03), mat("#14141a"), kat); mesh(box(0.035, 0.28, 0.035), mat("#ece9e3"), kat, 0, 0.62, 0);
    mesh(box(0.012, 0.22, 0.012), mat("#f2e6c8", { e: "#4b6cff", ei: 0.4 }), R.armR.fore, 0, -0.4, 0.06, false);
    // Rika: a huge hunched spirit with long arms, glowing white eyes and a ring
    const rika = grp(R.root, 0, 0, -1.3); rika.scale.setScalar(0.001); rika.visible = false;
    const rm = mat("#2b2533", { r: 0.9 });
    mesh(box(1.5, 1.4, 0.9), rm, rika, 0, 2.1, 0).rotation.x = 0.35;
    mesh(ball(0.55, 1), rm, rika, 0, 2.95, 0.45);
    for (const sx of [-1, 1]) { mesh(ball(0.1, 0), glow("#ffffff"), rika, sx * 0.2, 3.02, 0.92, false);
      const a = grp(rika, sx * 0.85, 2.6, 0.2); a.rotation.set(-0.6, 0, sx * 0.3); mesh(box(0.32, 1.7, 0.32), rm, a, 0, -0.8, 0); a.userData.arm = 1; }
    mesh(box(0.5, 0.08, 0.05), glow("#ff4d6d"), rika, 0, 2.7, 0.95, false);
    fighter("yuta", R, { rika, idle: "write" }); }

  // Mahoraga: towering pale shikigami, four wing-blades on the head, the eight-handled wheel overhead, a long blade on the right arm.
  { const R = rig({ skin: "#e6e0d0", top: "#e6e0d0", bottom: "#2b2b33", shoes: "#e6e0d0", scale: 1.55, build: 1.15, noEyes: true });
    for (const [sx, y] of [[-1, 0.06], [1, 0.06], [-1, -0.06], [1, -0.06]]) { const w = mesh(box(0.34, 0.07, 0.03), mat("#e6e0d0"), R.head, sx * 0.25, y, -0.02, false); w.rotation.z = sx * (y > 0 ? 0.5 : -0.3); }
    const wheel = grp(R.head, 0, 0.62, 0);
    mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 24), mat("#c9a24a", { m: 0.7, r: 0.35 }), wheel, 0, 0, 0, false).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const sp = mesh(box(0.025, 0.025, 0.42), mat("#c9a24a", { m: 0.7, r: 0.35 }), wheel, Math.cos(a) * 0.21, 0, Math.sin(a) * 0.21, false); sp.rotation.y = -a + Math.PI / 2;
      mesh(cyl(0.035, 0.035, 0.16, 6), mat("#c9a24a", { m: 0.7 }), wheel, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, false).rotation.set(0, 0, Math.PI / 2); }
    mesh(cyl(0.05, 0.05, 0.6, 6), mat("#c9a24a", { m: 0.7 }), R.head, 0, 0.32, 0, false);
    mesh(box(0.07, 0.95, 0.025), mat("#d8dde3", { m: 0.85, r: 0.25 }), R.armR.fore, 0.05, -0.55, 0);
    const lamp = mesh(ball(0.07, 1), glow("#7cff9c"), wheel, 0, 0.06, 0, false);
    fighter("mahoraga", R, { wheel, lamp, idle: "loom" }); }

  // Todo: big, broad, topknot, scar, open uniform jacket with a white tee; clipboard of handoffs in his belt.
  { const R = rig({ skin: "#cf9f7a", top: "#ece7dc", sleeve: "#2a2d3c", bottom: "#2a2d3c", shoes: "#141414", build: 1.4, scale: 1.12 });
    spikes(R.head, "#1a1714", 0, {}).scale.set(1, 0.6, 1);
    const knot = mesh(ball(0.1, 1), mat("#1a1714"), R.head, 0, 0.22, -0.08, false);
    mesh(box(0.012, 0.13, 0.01), mat("#a8735a"), R.head, -0.08, 0.05, 0.172, false);
    for (const sx of [-1, 1]) mesh(box(0.12, 0.52, 0.29), mat("#2a2d3c"), R.torso, sx * 0.33, 0.42, 0);
    fighter("todo", R, { knot, idle: "flex" }); }

  // Gojo: tall, white hair standing up, black blindfold, high-collared black uniform; a satchel of approved letters.
  { const R = rig({ skin: "#f2d8c4", top: "#13162a", bottom: "#13162a", shoes: "#0d0d10", scale: 1.12, noEyes: true });
    spikes(R.head, "#f5f7fc", 24, { len: 0.24, r: 0.07, el0: 0.35, elr: 1.0, up: 0.5 });
    mesh(cyl(0.188, 0.188, 0.07, 12), mat("#0b0b0e"), R.head, 0, 0.0, 0, false);
    mesh(box(0.34, 0.2, 0.32), mat("#13162a"), R.torso, 0, 0.78, 0);
    const sat = mesh(box(0.3, 0.24, 0.1), mat("#6a5136"), R.torso, -0.3, 0.12, 0.08); sat.rotation.z = 0.15;
    mesh(box(0.2, 0.02, 0.005), mat("#f3f0e6"), sat, 0, 0.13, 0.04, false);
    fighter("gojo", R, { idle: "cool" }); }

  // Hakari: pale swept-up hair, dark jacket with gold trim, a fever visor; his pachinko cabinet beside him.
  { const R = rig({ skin: "#e1b998", top: "#1d2925", bottom: "#1c1c1f", shoes: "#d9c06a" });
    spikes(R.head, "#ddd6c2", 14, { len: 0.2, r: 0.07, el0: 0.6, elr: 0.7, back: 0.9, front: false });
    mesh(box(0.52, 0.04, 0.29), mat("#d4b24c", { m: 0.6 }), R.torso, 0, 0.66, 0);
    mesh(box(0.3, 0.05, 0.05), mat("#2bd17a", { e: "#2bd17a", ei: 0.6 }), R.head, 0, 0.04, 0.17, false);
    fighter("hakari", R, { idle: "groove" }); }

  // Nanami: blonde side part, cream suit, blue shirt, yellow tie, tinted goggles, a phone headset (he answers the calls), wrapped cleaver.
  { const R = rig({ skin: "#efcba9", top: "#c8b089", bottom: "#c8b089", shoes: "#4a2f1f" });
    const cap = spikes(R.head, "#e7cb72", 0, {}); cap.rotation.z = 0.25;
    mesh(box(0.22, 0.06, 0.2), mat("#e7cb72"), R.head, 0.06, 0.15, 0.04, false).rotation.z = -0.3;
    mesh(box(0.16, 0.4, 0.02), mat("#3e73ad"), R.torso, 0, 0.47, 0.142);
    mesh(box(0.05, 0.32, 0.015), mat("#d9b23d"), R.torso, 0, 0.44, 0.155);
    for (const sx of [-1, 1]) mesh(box(0.08, 0.05, 0.02), mat("#4f9a6a", { t: 0.85, m: 0.3 }), R.head, sx * 0.065, 0.015, 0.18, false);
    mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 14, Math.PI), mat("#222"), R.head, 0, 0.02, 0, false);
    const mic = mesh(box(0.012, 0.012, 0.16), mat("#222"), R.head, -0.15, -0.07, 0.1, false); mic.rotation.y = -0.5;
    const blade = grp(R.armR.fore, 0, -0.38, 0.05); blade.rotation.x = Math.PI / 2;
    mesh(box(0.1, 0.62, 0.025), mat("#efe9dc"), blade, 0, 0.33, 0);
    for (let i = 0; i < 4; i++) mesh(box(0.105, 0.02, 0.03), mat("#2a2a2a"), blade, 0, 0.12 + i * 0.13, 0, false);
    fighter("nanami", R, { blade, idle: "sit" }); }

  // Sukuna: four arms, four red eyes, face and arm markings, pink hair swept back, white kimono with a black sash.
  { const R = rig({ skin: "#e8c0a0", top: "#ebe5d8", bottom: "#ebe5d8", shoes: "#1a1414", scale: 1.15, eyes: "#ff2a2a", eyeGlow: true });
    spikes(R.head, "#ee98a2", 14, { len: 0.18, r: 0.07, el0: 0.3, elr: 0.8, back: 1.0, front: false });
    for (const sx of [-1, 1]) { mesh(box(0.035, 0.025, 0.02), mat("#ff2a2a", { e: "#ff2a2a" }), R.head, sx * 0.07, -0.04, 0.165, false);
      mesh(box(0.06, 0.012, 0.01), mat("#151010"), R.head, sx * 0.09, -0.07, 0.165, false); }
    mesh(box(0.08, 0.012, 0.01), mat("#151010"), R.head, 0, 0.1, 0.17, false);
    mesh(box(0.52, 0.1, 0.3), mat("#111"), R.torso, 0, 0.18, 0);
    R.armL2 = (() => { const A = grp(R.torso, -0.33, 0.36, 0); mesh(box(0.13, 0.34, 0.14), mat("#ebe5d8"), A, 0, -0.16, 0); A.fore = grp(A, 0, -0.33, 0); mesh(box(0.12, 0.3, 0.13), mat("#e8c0a0"), A.fore, 0, -0.16, 0); A.rotation.z = -0.5; return A; })();
    R.armR2 = (() => { const A = grp(R.torso, 0.33, 0.36, 0); mesh(box(0.13, 0.34, 0.14), mat("#ebe5d8"), A, 0, -0.16, 0); A.fore = grp(A, 0, -0.33, 0); mesh(box(0.12, 0.3, 0.13), mat("#e8c0a0"), A.fore, 0, -0.16, 0); A.rotation.z = 0.5; return A; })();
    for (const A of [R.armL, R.armR, R.armL2, R.armR2]) for (let i = 0; i < 2; i++) mesh(box(0.14, 0.02, 0.15), mat("#151010"), A.fore, 0, -0.08 - i * 0.07, 0, false);
    fighter("sukuna", R, { idle: "throne" }); }

  // Jogo: short, cream skin, a volcano for a head with a single eye, white robe with a dark sash; smoke rises while he waits.
  { const R = rig({ skin: "#e7dbbf", top: "#ede6d8", bottom: "#ede6d8", shoes: "#3a2a20", scale: 0.92, noEyes: true });
    R.skull.visible = false;
    const vol = grp(R.head, 0, 0.02, 0);
    mesh(cyl(0.11, 0.21, 0.42, 8), mat("#cfc3a6"), vol, 0, 0.06, 0, false);
    const lava = mesh(cyl(0.095, 0.095, 0.02, 8), glow("#ff6a1a"), vol, 0, 0.275, 0, false);
    mesh(ball(0.055, 1), mat("#111", { e: "#d0261a", ei: 0.7 }), vol, 0, 0.0, 0.17, false);
    mesh(box(0.52, 0.09, 0.3), mat("#2a2a2a"), R.torso, 0, 0.2, 0);
    mesh(cyl(0.22, 0.32, 0.5, 8), mat("#ede6d8"), R.hips, 0, -0.35, 0);
    fighter("jogo", R, { lava, idle: "fume" }); }

  /* ---------- stations: what stands round each fighter ---------- */
  terminal("toji", -16, -5.4, 0.2); signs("toji", -17.5, 3.6, -5.2);
  mesh(box(1.4, 1.8, 0.1), mat("#5a4a32"), world, -19, 1.6, -5.6); // the target board
  for (let i = 0; i < 9; i++) mesh(ball(0.05, 0), glow(i % 3 ? "#ff5a4a" : "#ffd34a"), world, -19.5 + rnd(), 1.1 + rnd() * 1.1, -5.53, false);
  terminal("yuji", -9, -5.4, -0.15); signs("yuji", -10.5, 3.6, -5.2);
  const gate = grp(world, -10.5, 0, -1.6); // the phone-size scanner arch the leads pass through
  for (const sx of [-1, 1]) mesh(box(0.18, 2.1, 0.3), mat("#323a3e", { m: 0.5 }), gate, sx * 0.8, 1.05, 0);
  mesh(box(1.78, 0.2, 0.3), mat("#323a3e", { m: 0.5 }), gate, 0, 2.1, 0);
  const gateBar = mesh(box(1.4, 0.04, 0.04), glow("#ff3b3b"), gate, 0, 1.95, 0.16, false);
  terminal("hanami", -2, -5.6, -0.1); signs("hanami", -3.5, 3.9, -5.6);
  const siteFrame = grp(world, -1.4, 0, -3.9); // the preview grows here: a tall phone-shaped frame
  mesh(box(1.2, 2.2, 0.1), mat("#2c2620"), siteFrame, 0, 1.3, 0);
  const site = mesh(new THREE.PlaneGeometry(1.02, 1.95), new THREE.MeshBasicMaterial({ color: "#1a1a1a", toneMapped: false }), siteFrame, 0, 1.3, 0.06, false);
  const siteTex = tex(128, 256, (g, w, h) => { g.fillStyle = "#f6f3ec"; g.fillRect(0, 0, w, h); g.fillStyle = "#1f3b5c"; g.fillRect(0, 0, w, 54); g.fillStyle = "#e8a33d"; g.fillRect(14, 70, 100, 22); g.fillStyle = "#c9c2b4"; for (let y = 108; y < 240; y += 18) g.fillRect(14, y, 60 + (y % 40), 8); g.fillStyle = "#fff"; g.font = "600 15px system-ui"; g.fillText("Call now", 32, 86); });
  const roots = grp(world, -3.5, 0, -3.2);
  for (let i = 0; i < 9; i++) { const r = grp(roots, (rnd() - 0.5) * 3.2, 0, (rnd() - 0.5) * 1.6); r.rotation.set((rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6);
    mesh(cyl(0.03, 0.09, 1.4, 5), mat("#6f543c"), r, 0, 0.7, 0); mesh(ball(0.09, 0), mat("#f3a7c2", { e: "#f3a7c2", ei: 0.3 }), r, 0, 1.42, 0, false); r.scale.y = 0.001; r.visible = false; }
  terminal("yuta", 5, -5.4, -0.15); signs("yuta", 3.5, 3.6, -5.2);
  mesh(box(1.1, 0.75, 0.6), mat("#6b4e32"), world, 2.1, 0.38, -4.2); mesh(box(0.5, 0.18, 0.36), mat("#2a2a2c", { m: 0.4 }), world, 2.1, 0.85, -4.2);
  terminal("mahoraga", 12.4, -5.6, -0.2); signs("mahoraga", 10.5, 4.4, -5.6);
  terminal("todo", 17.4, -0.2, Math.PI / 2 + 0.3);
  terminal("gojo", 12.8, 1.6, 0); signs("gojo", 11, 3.6, 1.6);
  const tube = grp(world, 11, 0, 4.6);
  mesh(cyl(0.55, 0.55, 7.2, 16, 1), new THREE.MeshStandardMaterial({ color: "#9fd6ff", transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.2, depthWrite: false }), tube, 0, 4.6, 0, false);
  for (const y of [1.0, 4.6, 8.2]) mesh(new THREE.TorusGeometry(0.58, 0.06, 6, 20), mat("#3a4448", { m: 0.6 }), tube, 0, y, 0, false).rotation.x = Math.PI / 2;
  const tubeGlow = mesh(new THREE.TorusGeometry(0.58, 0.03, 4, 20), glow("#6fc8ff", { op: 0.0 }), tube, 0, 1.2, 0, false); tubeGlow.rotation.x = Math.PI / 2;
  terminal("hakari", 2.2, 1.6, 0.1); signs("hakari", 4, 3.6, 1.6);
  const cab = grp(world, 6.2, 0, 2.2); cab.rotation.y = -0.35; // the pachinko cabinet: three reels and a ring of lights
  mesh(box(1.3, 2.4, 0.8), mat("#2a1f3a", { r: 0.5 }), cab, 0, 1.2, 0);
  const reelTex = [0, 1, 2].map(() => { const t = tex(64, 448, (g) => { for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? "#f5efe0" : "#fff8ea"; g.fillRect(0, i * 64, 64, 64); g.fillStyle = i === 6 ? "#d4263a" : "#2a2a2a"; g.font = "700 44px system-ui"; g.textAlign = "center"; g.fillText(String(i + 1), 32, i * 64 + 48); } }); t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1 / 7); return t; });
  const reels = reelTex.map((t, i) => mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }), cab, -0.36 + i * 0.36, 1.55, 0.41, false));
  const cabLights = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; cabLights.push(mesh(ball(0.045, 0), glow("#ffd34a"), cab, Math.cos(a) * 0.58, 1.55 + Math.sin(a) * 0.5, 0.42, false)); }
  const reelState = reels.map(() => ({ off: 0, v: 0, stop: null }));
  const booth = grp(world, -5.5, 0, 6.6); // Nanami's front desk: a switchboard, a desk phone and a wall clock past five
  mesh(box(2.6, 0.8, 0.9), mat("#6b4e32"), booth, 0, 0.4, 0.5);
  mesh(box(2.6, 2.3, 0.25), mat("#2f3a36", { m: 0.4 }), booth, 0, 1.15, -0.5);
  const jacks = []; for (let i = 0; i < 18; i++) jacks.push(mesh(ball(0.05, 0), glow("#3a3a3a", { add: false }), booth, -1.0 + (i % 9) * 0.25, 1.4 + Math.floor(i / 9) * 0.45, -0.36, false));
  const phoneSet = mesh(box(0.3, 0.12, 0.22), mat("#151515"), booth, 0.8, 0.86, 0.5);
  const clock = tex(128, 128, (g) => { g.fillStyle = "#efe9dc"; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.strokeStyle = "#222"; g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 28 * Math.cos(-0.35), 64 + 28 * Math.sin(-0.35)); g.moveTo(64, 64); g.lineTo(64, 18); g.stroke(); });
  mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshBasicMaterial({ map: clock }), booth, 1.0, 2.0, -0.36, false);
  const ratioBoard = grp(booth, -0.6, 1.2, -0.35);
  const slash = mesh(box(1.2, 0.035, 0.01), glow("#ff4040"), ratioBoard, 0, 0, 0.02, false); slash.visible = false;
  signs("nanami", -5.5, 3.4, 6.0);
  const shrine = grp(world, -13.5, 0, 5.6); // the shrine stays sunk under the floor until money lands
  const sm = mat("#1a1014", { r: 0.7 }), sr = mat("#5a1218", { r: 0.6 });
  mesh(box(4, 0.4, 2.4), sm, shrine, 0, 0.2, 0); for (const sx of [-1.6, -0.55, 0.55, 1.6]) mesh(box(0.22, 2.2, 0.22), sr, shrine, sx, 1.5, 0.8);
  const roof = mesh(box(4.6, 0.3, 2.8), sm, shrine, 0, 2.75, 0.2); mesh(box(3.6, 0.5, 2.2), sm, shrine, 0, 3.1, 0.2);
  for (const sx of [-1, 1]) { const h = mesh(cone(0.18, 1.1, 5), mat("#e9e2d2"), shrine, sx * 2.25, 3.2, 1.4); h.rotation.z = sx * -0.9; }
  mesh(box(1.4, 1.0, 0.1), mat("#0a0506", { e: "#3a0408", ei: 1 }), shrine, 0, 1.4, -0.9);
  shrine.position.y = -3.6; shrine.visible = false;
  const cuts = []; for (let i = 0; i < (phone ? 26 : 48); i++) { const c = mesh(new THREE.PlaneGeometry(2.6, 0.035), glow("#ff2840", { side: THREE.DoubleSide }), world, 0, 0, 0, false); c.visible = false; cuts.push(c); }
  mesh(box(2.6, 0.18, 2.6), mat("#3a1418"), world, -13.5, 0.09, 7.4); signs("sukuna", -13.5, 3.6, 8.4);
  const boiler = grp(world, -22.6, 0, 2.5); // Jogo's furnace and its pressure gauge
  mesh(cyl(1.1, 1.2, 3.2, 12), mat("#5c3a28", { m: 0.5, r: 0.55 }), boiler, 0, 1.6, 0);
  mesh(cyl(0.3, 0.3, 4.2, 8), mat("#3a3230", { m: 0.5 }), boiler, 0, 5.3, 0);
  const mouth = mesh(box(0.1, 0.7, 0.9), glow("#ff5a14", { op: 0.65 }), boiler, 1.12, 0.9, 0, false);
  const gauge = grp(boiler, 0.95, 2.3, 0.6); gauge.rotation.y = 1.0; mesh(cyl(0.22, 0.22, 0.06, 14), mat("#e8e2d2"), gauge, 0, 0, 0, false).rotation.x = Math.PI / 2;
  const needle = mesh(box(0.02, 0.17, 0.02), mat("#c41e1e"), gauge, 0, 0, 0.05, false); needle.geometry = new THREE.BoxGeometry(0.02, 0.17, 0.02).translate(0, 0.08, 0);
  signs("jogo", -21.6, 3.8, 0.2, Math.PI / 2);
  const throne = grp(world, 21, 0, 1.5); throne.rotation.y = -Math.PI / 2; // TJ's desk: nothing goes out without your tap
  mesh(box(1.3, 0.5, 1.2), mat("#3a2a1c"), throne, 0, 0.45, 0); mesh(box(1.3, 2.0, 0.25), mat("#3a2a1c"), throne, 0, 1.45, -0.55);
  mesh(box(1.2, 0.12, 1.1), mat("#8a2a1c", { r: 0.9 }), throne, 0, 0.75, 0);
  const tjLight = mesh(box(1.0, 0.06, 0.06), glow("#ffb547"), throne, 0, 2.5, -0.5, false);
  const holoCards = grp(throne, 0, 1.9, 0.9); for (let i = 0; i < 3; i++) mesh(new THREE.PlaneGeometry(0.42, 0.28), glow("#ffb547", { op: 0.35, side: THREE.DoubleSide }), holoCards, (i - 1) * 0.5, 0, 0, false);
  { const t = tex(512, 112, (g, w, h) => { g.fillStyle = "#1e2427"; g.fillRect(0, 0, w, h); g.strokeStyle = "#ffb547"; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = "#efe6cf"; g.font = "600 52px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Your desk", w / 2, h / 2 + 2); });
    const s = mesh(new THREE.PlaneGeometry(2.4, 0.52), new THREE.MeshStandardMaterial({ map: t }), world, 21.6, 3.8, 1.5, false); s.rotation.y = -Math.PI / 2; }
  signs("todo", 17.2, 3.8, -0.6);


  /* ---------- crash-test dummies: every move lands on one, and each breaks its own way (TJ, 2026-10-24) ---------- */
  const targetTex = tex(64, 64, (g) => { g.fillStyle = "#f1cf3a"; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill(); g.fillStyle = "#151515"; for (const a of [0, Math.PI]) { g.beginPath(); g.moveTo(32, 32); g.arc(32, 32, 30, a, a + Math.PI / 2); g.fill(); } });
  const targetMat = new THREE.MeshBasicMaterial({ map: targetTex, transparent: true });
  const DOFF = { mahoraga: 1.9, hanami: 1.7, gojo: 1.4, jogo: 2.0, sukuna: 1.7, todo: 1.5 };
  const dummies = {}, debris = [];
  const after = (sec, fn) => effect(sec, () => {}, fn);
  const makeDummy = (id, rise = true) => {
    const f = F[id]; if (!f) return;
    const ms = { body: new THREE.MeshStandardMaterial({ color: "#e3be3a", roughness: 0.55, flatShading: true, transparent: true }), dark: new THREE.MeshStandardMaterial({ color: "#26262a", roughness: 0.7, flatShading: true, transparent: true }) };
    const g = new THREE.Group(); const off = new THREE.Vector3((DOFF[id] || 1.3) * 0.9, 0, 0.55).applyAxisAngle(UP, f.ry);
    g.position.copy(f.base).add(off); g.rotation.y = Math.atan2(f.base.x - g.position.x, f.base.z - g.position.z); world.add(g);
    const lower = grp(g), upper = grp(g, 0, 0.95, 0);
    for (const sx of [-1, 1]) { mesh(box(0.16, 0.9, 0.18), ms.body, lower, sx * 0.11, 0.45, 0); mesh(box(0.17, 0.06, 0.19), ms.dark, lower, sx * 0.11, 0.48, 0); }
    mesh(box(0.4, 0.2, 0.24), ms.dark, lower, 0, 0.95, 0);
    mesh(box(0.46, 0.5, 0.26), ms.body, upper, 0, 0.35, 0); mesh(box(0.47, 0.04, 0.27), ms.dark, upper, 0, 0.2, 0);
    for (const sx of [-1, 1]) { const a = mesh(box(0.13, 0.62, 0.14), ms.body, upper, sx * 0.31, 0.3, 0); a.rotation.z = sx * 0.12; }
    const head = mesh(ball(0.17, 1), ms.body, upper, 0, 0.82, 0);
    for (const sx of [-1, 1]) { const t = mesh(new THREE.CircleGeometry(0.08, 12), targetMat, head, sx * 0.172, 0, 0, false); t.rotation.y = sx * Math.PI / 2; }
    const d = dummies[id] = { id, g, upper, lower, ms, alive: true, home: g.position.clone() };
    if (rise) { g.position.y = -2; effect(0.9, (q) => (g.position.y = -2 + 2 * out(q))); burst(d.home.clone().setY(0.1), 10, ["#e0b21c", "#ffffff"], 2, { life: 0.5 }); }
    return d;
  };
  const respawn = (id, sec = 3.2) => after(sec, () => { dummies[id]?.g.parent && world.remove(dummies[id].g); makeDummy(id); });
  const toss = (o, v, w, life = 2.6, grav = -12) => { // hand a piece to the debris sim, keeping where it is in the world
    const p = o.getWorldPosition(new THREE.Vector3()), q = o.getWorldQuaternion(new THREE.Quaternion()), sc = o.getWorldScale(new THREE.Vector3());
    scene.add(o); o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc);
    debris.push({ o, v, w: w || new THREE.Vector3((rnd() - 0.5) * 12, (rnd() - 0.5) * 12, (rnd() - 0.5) * 12), life, max: life, grav });
  };
  const shatter = (d, base, spread = 3, o = {}) => { // every part flies off on its own
    const parts = []; d.g.traverse((m) => m.isMesh && m.material !== targetMat && parts.push(m));
    parts.forEach((m) => { const side = new THREE.Vector3(m.getWorldPosition(new THREE.Vector3()).x - d.g.position.x, 0, 0);
      toss(m, base.clone().add(new THREE.Vector3((rnd() - 0.5) * spread, rnd() * spread * 0.8, (rnd() - 0.5) * spread)).addScaledVector(side, o.side || 0), null, o.life, o.grav); });
    world.remove(d.g);
  };
  const tint = (d, color, emissive, sec) => { const c0 = d.ms.body.color.clone(), c1 = new THREE.Color(color); effect(sec, (q) => { d.ms.body.color.lerpColors(c0, c1, q); d.ms.dark.color.lerpColors(new THREE.Color("#26262a"), c1, q * 0.7); if (emissive) { d.ms.body.emissive.set(emissive); d.ms.body.emissiveIntensity = q; } }); };
  const away = (id, d) => d.g.position.clone().sub(F[id].base).setY(0).normalize();
  const kill = (id, style) => {
    const d = dummies[id]; if (!d || !d.alive) return; d.alive = false; const P = d.g.position.clone(), mid = P.clone().setY(1.1);
    switch (style) {
      case "launch": { const a = away(id, d); burst(mid, 30, ["#ff2a3a", "#e3be3a", "#111"], 6, { life: 0.7 }); shatter(d, a.multiplyScalar(10).setY(5), 4); break; } // Black Flash: blown back in pieces
      case "pin": { const a = away(id, d); effect(0.5, (q) => { d.g.position.copy(P).addScaledVector(a, out(q) * 3); d.g.position.y = Math.sin(q * Math.PI) * 0.8; d.g.rotation.x = -q * 1.4; }, () => { burst(d.g.position.clone().setY(0.4), 20, ["#e3be3a", "#cfc6b5"], 4, { life: 0.6 }); shatter(d, new THREE.Vector3(0, 2, 0), 3); }); break; } // Toji: spear through, flung and pinned to the floor
      case "vines": { const vs = []; for (let i = 0; i < 6; i++) { const v = mesh(cyl(0.03, 0.05, 2.2, 5), mat("#5a8a3a"), world, P.x + Math.cos(i) * 0.25, 0, P.z + Math.sin(i) * 0.25, false); v.rotation.set(Math.sin(i * 2) * 0.3, 0, Math.cos(i * 2) * 0.3); v.scale.y = 0.01; vs.push(v); }
        effect(2.2, (q) => { vs.forEach((v) => (v.scale.y = Math.max(0.01, out(bump(q, 0, 0.35))))); const k = bump(q, 0.45, 1); d.g.position.y = -2.4 * ease(k); vs.forEach((v) => (v.position.y = -2.4 * ease(k) + 0.9)); if (q > 0.5 && rnd() < 0.4) burst(P.clone().setY(0.1), 2, ["#f3a7c2", "#6f543c"], 2, { life: 0.8 }); },
          () => { vs.forEach((v) => world.remove(v)); world.remove(d.g); }); break; } // Hanami: wrapped in roots and dragged under
      case "crush": effect(0.25, (q) => { d.g.scale.set(1 + q * 0.6, 1 - q * 0.85, 1 + q * 0.6); }, () => { burst(P.clone().setY(0.2), 26, ["#e3be3a", "#2b2533", "#ff4d6d"], 4, { life: 0.6, up: 0.2 }); shatter(d, new THREE.Vector3(0, 1.5, 0), 5, { grav: -14 }); }); break; // Rika: squashed flat, then pops
      case "chop": { flash = Math.max(flash, 0.2); const cut = mesh(box(0.03, 2.4, 0.6), glow("#ffffff"), world, P.x, 1.1, P.z, false); effect(0.25, (q) => (cut.material.opacity = 1 - q), () => world.remove(cut)); shatter(d, new THREE.Vector3(0, 1, 0), 0.6, { side: 6 }); break; } // Mahoraga: one chop, left and right halves fall apart
      case "halves": { const top = d.upper; const tilt = new THREE.Vector3(1.6, 1.2, 0.4).applyAxisAngle(UP, d.g.rotation.y); const ln = mesh(box(1.1, 0.025, 0.025), glow("#ff4040"), world, P.x, 1.0, P.z, false); ln.rotation.set(0, d.g.rotation.y, 0.35);
        effect(0.4, (q) => (ln.material.opacity = 1 - q), () => world.remove(ln));
        toss(top, tilt, new THREE.Vector3(0, 0, -3), 2.8); after(0.6, () => { d.lower.children.forEach((m) => toss(m, new THREE.Vector3((rnd() - 0.5) * 0.8, 0.5, (rnd() - 0.5) * 0.8), new THREE.Vector3(rnd() * 3, 0, rnd() * 3), 2.4)); world.remove(d.g); }); break; } // Nanami 7:3: one clean cut at the weak point, the top slides off
      case "swap": { burst(mid, 18, ["#ffffff", "#9fd6ff"], 3, { life: 0.4 }); d.g.position.y = 4; d.g.rotation.z = 1.2; let vy = 0; effect(0.9, (q) => { vy -= 14 * 0.03; d.g.position.y = Math.max(0, 4 - 4 * q * q); }, () => { shake = Math.max(shake, 0.2); burst(P.clone().setY(0.2), 24, ["#e3be3a", "#111"], 4, { life: 0.5 }); shatter(d, new THREE.Vector3(0, 1, 0), 4); }); break; } // Todo: clapped into the air, drops and smashes
      case "dust": { tint(d, "#d6ecff", "#6fb8ff", 0.6); after(1.2, () => { for (let i = 0; i < 40; i++) emit(P.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.5, rnd() * 1.8, (rnd() - 0.5) * 0.5)), new THREE.Vector3((rnd() - 0.5) * 0.6, 0.6 + rnd(), (rnd() - 0.5) * 0.6), rnd() < 0.5 ? "#cfe6ff" : "#6fb8ff", 1.6, 1, 0.4);
        effect(0.6, (q) => d.g.scale.set(1 - q, 1 - q * 0.4, 1 - q), () => world.remove(d.g)); }); break; } // Gojo: frozen in the void, then gone to dust
      case "coins": effect(1.0, (q) => { d.g.rotation.y += 0.6 * q * 3; d.g.position.y = out(q) * 2.2; }, () => { burst(d.g.position.clone().setY(2.6), 50, ["#ffd34a", "#ffe9a0"], 6, { life: 1.4, size: 1.3 }); shatter(d, new THREE.Vector3(0, 3, 0), 5); }); break; // Hakari jackpot: spun into the air and paid out in coins
      case "knock": effect(0.8, (q) => { d.g.rotation.x = -1.45 * out(q); }, () => after(1.2, () => effect(0.6, (q) => (d.g.rotation.x = -1.45 * (1 - q)), () => (d.alive = true)))); return; // Hakari miss: knocked flat, gets back up
      case "slice": { for (let i = 0; i < 8; i++) { const c = mesh(new THREE.PlaneGeometry(1.4, 0.02), glow("#ff2840", { side: THREE.DoubleSide }), world, P.x, 0.5 + rnd() * 1.4, P.z, false); c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); after(0.1 + i * 0.03, () => world.remove(c)); }
        after(0.35, () => { d.g.traverse((m) => m.isMesh && m !== d.g && m.scale.multiplyScalar(0.9)); shatter(d, new THREE.Vector3(0, 0.3, 0), 1.2, { grav: -16 }); for (let i = 0; i < 14; i++) { const cube = mesh(box(0.12, 0.12, 0.12), d.ms.body, scene, 0, 0, 0, false); cube.position.copy(P).add(new THREE.Vector3((rnd() - 0.5) * 0.4, 0.2 + rnd() * 1.5, (rnd() - 0.5) * 0.4)); debris.push({ o: cube, v: new THREE.Vector3((rnd() - 0.5) * 2, rnd(), (rnd() - 0.5) * 2), w: new THREE.Vector3(rnd() * 6, rnd() * 6, 0), life: 2.4, max: 2.4, grav: -16 }); } }); break; } // Sukuna: diced
      case "ash": { tint(d, "#1b1714", null, 0.5); after(0.6, () => { for (let i = 0; i < 50; i++) emit(P.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.5, rnd() * 1.8, (rnd() - 0.5) * 0.5)), new THREE.Vector3((rnd() - 0.5) * 1.2, 0.3 + rnd() * 1.5, (rnd() - 0.5) * 1.2), rnd() < 0.3 ? "#ff7a1a" : "#2a2420", 1.8, 1.2, -1);
        effect(0.8, (q) => d.g.scale.set(1 - q * 0.3, Math.max(0.02, 1 - q), 1 - q * 0.3), () => world.remove(d.g)); }); break; } // Jogo: burnt to ash where it stood
    }
    respawn(id, style === "dust" || style === "ash" ? 4 : 3.4);
  };
  const stepDebris = (dt) => {
    for (let i = debris.length - 1; i >= 0; i--) { const b = debris[i]; b.life -= dt; b.v.y += b.grav * dt; b.o.position.addScaledVector(b.v, dt);
      if (b.o.position.y < 0.08) { b.o.position.y = 0.08; b.v.multiplyScalar(0.45); b.v.y = Math.abs(b.v.y) * 0.35; b.w.multiplyScalar(0.5); }
      b.o.rotation.x += b.w.x * dt; b.o.rotation.y += b.w.y * dt; b.o.rotation.z += b.w.z * dt;
      const k = b.life / b.max; if (k < 0.3) b.o.traverse((m) => { if (m.isMesh && m.material.transparent) m.material.opacity = Math.max(0, k / 0.3); });
      if (b.life <= 0) { scene.remove(b.o); debris.splice(i, 1); } }
  };
  ["toji", "yuji", "hanami", "yuta", "mahoraga", "todo", "gojo", "hakari", "nanami", "sukuna", "jogo"].forEach((id) => makeDummy(id, false));

  /* ---------- crates: one per shop, riding the line ---------- */
  const crateM = mat("#9a7448", { r: 0.85 }), crateEdge = mat("#5c4228"), envM = mat("#efe8d6", { r: 0.7 });
  const crates = [];
  const makeCrate = () => {
    const g = grp(world); const body = grp(g, 0, 0.32, 0);
    mesh(box(0.56, 0.48, 0.56), crateM, body); for (const sx of [-1, 1]) mesh(box(0.06, 0.5, 0.58), crateEdge, body, sx * 0.26, 0, 0);
    const tag = mesh(box(0.2, 0.12, 0.02), glow("#ff3b3b"), body, 0, 0.1, 0.29, false); tag.visible = false;
    const screen = mesh(box(0.32, 0.5, 0.04), mat("#111", { e: "#4aa3ff", ei: 0.9 }), body, 0, 0.5, 0, false); screen.visible = false;
    const env = grp(g, 0, 0.32, 0); env.visible = false;
    mesh(box(0.62, 0.05, 0.42), envM, env); const flap = mesh(cone(0.38, 0.2, 4), mat("#e3dac4"), env, 0, 0.03, -0.06, false); flap.rotation.set(Math.PI / 2, Math.PI / 4, 0); flap.scale.set(1.1, 1, 0.12);
    const ok = mesh(ball(0.06, 0), glow("#7cff9c"), env, 0.22, 0.06, 0.14, false); ok.visible = false;
    return { g, body, tag, screen, env, ok, line: 0, x: BACK[0][0] + 1, stage: 0, wait: 0, gone: false, hot: false };
  };

  /* ---------- moves: a tiny timeline per fighter ---------- */
  const acts = [];
  const play = (id, dur, fn, end) => { const f = F[id]; if (f) { if (f.act) { const e = f.act.end; f.act = null; e && e(f); resetPose(f); } f.act = { t: 0, dur, fn, end }; } return f; };
  let shake = 0, flash = 0;
  const flashQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
  flashQuad.renderOrder = 999; flashQuad.frustumCulled = false; camera.add(flashQuad); flashQuad.position.z = -0.2; scene.add(camera);
  const worldOf = (o) => o.getWorldPosition(new THREE.Vector3());

  const bolt = (from, len, colorOuter) => { // a jagged lightning bolt: black core, red outer, the Black Flash look
    const g = grp(scene); let p = from.clone(); const dir = new THREE.Vector3(rnd() - 0.5, rnd() - 0.2, rnd() - 0.5).normalize();
    for (let i = 0; i < 6; i++) { const step = dir.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.9)).normalize().multiplyScalar(len / 6);
      const q = p.clone().add(step), mid = p.clone().add(q).multiplyScalar(0.5), L = step.length();
      for (const [w, m] of [[0.15, glow(colorOuter)], [0.075, new THREE.MeshBasicMaterial({ color: "#000000", depthTest: false })]]) {
        const s = new THREE.Mesh(box(w, L, w), m); s.renderOrder = w < 0.1 ? 10 : 9; s.position.copy(mid); s.quaternion.setFromUnitVectors(UP, step.clone().normalize()); g.add(s); }
      p = q; }
    return g;
  };
  const fx = []; // timed effects: {t, dur, update(u), done()}
  const effect = (dur, update, done) => fx.push({ t: 0, dur, update, done });

  // Domain sphere: black void full of light streaks (Unlimited Void), with a bright rim seen from outside
  const voidMat = new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uA: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vD; uniform float uT, uA; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){ vec3 d = normalize(vD); vec3 q = floor(d * 90.); float s = step(.975, h(q)) * (.6 + .4 * sin(uT * 4. + h(q) * 30.));
        float a = atan(d.z, d.x); float st = pow(abs(sin(a * 19. + d.y * 6. - uT * 1.4)), 60.) * (1. - abs(d.y));
        vec3 c = vec3(.008, .01, .03) + vec3(.75, .85, 1.) * s + vec3(.35, .5, 1.) * st * .7 + vec3(.25,.15,.6) * pow(1.-abs(d.y), 6.) * .4;
        gl_FragColor = vec4(c, uA); }` });
  const rimMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 } },
    vertexShader: `varying float vF; void main(){ vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vF = pow(1. - abs(dot(n, normalize(-mv.xyz))), 3.); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vF; uniform float uA; void main(){ gl_FragColor = vec4(vec3(.55,.75,1.) * vF * 1.6, vF * uA); }` });
  const domain = grp(scene); domain.visible = false;
  mesh(new THREE.SphereGeometry(1, 40, 24), voidMat, domain, 0, 0, 0, false);
  const domainSeal = mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: tex(1024, 1024, (g) => { g.strokeStyle = "#9fd0ff"; g.lineWidth = 4; g.shadowColor = "#6fb8ff"; g.shadowBlur = 12; metatron(g, 512, 512, 95); flowerOfLife(g, 512, 512, 95); }), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), scene, 0, 0.03, 0, false);
  domainSeal.rotation.x = -Math.PI / 2; mesh(new THREE.SphereGeometry(1.01, 40, 24), rimMat, domain, 0, 0, 0, false);

  /* ---------- the director: cuts the camera to the big moves ---------- */
  const cam = { az: 0, el: 0.66, r: 38, tx: 0, ty: 0.5, tz: 1.5 };
  const home = () => phone ? { az: 1.25, el: 0.62, r: 40, tx: 2, ty: 0, tz: 1.5 } : { az: 0.0, el: 0.6, r: 35, tx: 0, ty: 0, tz: 0.2 };
  Object.assign(cam, home());
  let goal = home(), focusUntil = 0, curPri = 0, focusId = null, userUntil = 0, director = opts.director ?? true, now = 0, idleCut = 6;
  const focus = (id, hold = 3, o = {}) => {
    const pri = o.pri ?? 1; if (!director || now < userUntil || (now < focusUntil && pri <= curPri && pri < 3)) return; const f = F[id]; if (!f) return; curPri = pri; focusId = id;
    const p = f.root.position; const s = f.root.scale.x;
    goal = { az: (o.az ?? 0.18 * Math.sign(p.x || 1)) + (Math.abs(f.ry) > 1 ? -f.ry * 0.6 : 0), el: o.el ?? 0.32, r: (o.r ?? 7.5) * (phone ? 1.3 : 1) * Math.max(1, s * 0.85), tx: p.x, ty: (o.ty ?? 1.3) * s, tz: p.z };
    focusUntil = now + hold;
  };

  /* ---------- the moves ---------- */
  const title = (txt, sub) => opts.onMove?.(txt, sub);
  const log = (id, line, txt) => { const f = F[id]; if (f) { f.count++; f.last = line; } const sc = screens[id]; if (sc) { sc.lines.push(txt || line); drawScreen(id, true); setTimeout(() => drawScreen(id), 400); } opts.onEvent?.(id, line); };

  const MOVES = {
    pick(c) { // Toji: vanishes, reappears at the intake with the spear, a crate drops onto the belt; afterimages behind him
      const f = F.toji; focus("toji", 2.6, { r: 7 });
      const ghosts = [];
      play("toji", 2.2, (u, R) => {
        const go = bump(u, 0.1, 0.35), back = bump(u, 0.7, 0.95);
        R.root.position.x = R.base.x + (go - back) * -1.6; R.root.position.z = R.base.z + (go - back) * 1.6;
        R.armR.rotation.x = -1.4 * bump(u, 0.35, 0.45) + 1.4 * bump(u, 0.55, 0.7); R.torso.rotation.y = -0.4 * (go - back);
        R.legL.rotation.x = Math.sin(u * 40) * 0.6 * (go - back > 0 && go - back < 1 ? 1 : 0); R.legR.rotation.x = -R.legL.rotation.x;
        if (u > 0.12 && u < 0.35 && ghosts.length < 4 && rnd() < 0.5) { const gh = R.root.clone(true); gh.traverse((o) => { if (o.isMesh) { o.material = glow("#9fb3c8", { op: 0.25 }); o.castShadow = false; } }); scene.add(gh); ghosts.push(gh);
          effect(0.6, (k) => gh.traverse((o) => o.isMesh && (o.material.opacity = 0.25 * (1 - k))), () => scene.remove(gh)); }
        if (u > 0.4 && !R._k) { R._k = true; kill("toji", "pin"); }
        if (u > 0.45 && !c.g.visible) { c.g.visible = true; burst(new THREE.Vector3(c.x, 0.9, -1.6), 14, ["#cfc6b5", "#ffffff"], 3, { life: 0.5 }); }
      }, (R) => (R._k = false));
      log("toji", "Picked a shop off the cold list", "pick: 1 shop");
    },
    flaw(c) { // Yuji: wind-up, step in, the punch; black and red lightning and a white flash on impact
      focus("yuji", 3.4, { pri: 2, r: 7, el: 0.42, az: 0.75 }); title("Black Flash", "Yuji found a flaw");
      play("yuji", 2.3, (u, R) => {
        const w = bump(u, 0, 0.35), hit = bump(u, 0.35, 0.45), rec = bump(u, 0.75, 1);
        R.torso.rotation.y = 0.7 * w - 1.1 * hit + 0.4 * rec; R.armR.rotation.x = -0.6 * w - 1.0 * hit + 1.6 * rec; R.armR.fore.rotation.x = -1.2 * w + 1.2 * hit - 0 * rec;
        { const st = 0.9 * hit * (1 - rec), ya = R.root.rotation.y; R.root.position.x = R.base.x + Math.sin(ya) * st; R.root.position.z = R.base.z + Math.cos(ya) * st; } R.legL.rotation.x = -0.6 * hit * (1 - rec); R.legR.rotation.x = 0.4 * hit * (1 - rec);
        R.hips.position.y = 0.95 - 0.12 * w * (1 - rec);
        if (hit >= 1 && !R._hit) { R._hit = true; const p = worldOf(R.armR.hand);
          shake = 0.55; flash = 0.75;
          for (let i = 0; i < 7; i++) { const b = bolt(p, 1.2 + rnd() * 1.3, "#ff1f3d"); effect(0.45 + rnd() * 0.25, (k) => b.scale.setScalar(1 + k * 0.3), () => scene.remove(b)); }
          burst(p, 40, ["#ff2a3a", "#1a0000", "#ffffff"], 6, { life: 0.6, grav: -2 });
          kill("yuji", "launch"); c.tag.visible = true; gateBar.material.color.set("#ffffff"); setTimeout(() => gateBar.material.color.set("#ff3b3b"), 300); }
      }, (R) => (R._hit = false));
      log("yuji", "Landed a real flaw", "flaw: 1 found");
    },
    flawMiss() { // no provable flaw: Yuji swings at air, the shop is skipped
      play("yuji", 1.4, (u, R) => { R.armR.rotation.x = -1.4 * Math.sin(u * Math.PI); R.torso.rotation.y = -0.6 * Math.sin(u * Math.PI); R.head.rotation.z = 0.3 * bump(u, 0.6, 1); });
      log("yuji", "No provable flaw, skipped", "flaw: skip");
    },
    mockup(c) { // Hanami: kneels, roots and blossoms burst up round the frame and the new phone site lights up
      focus("hanami", 3.6, { pri: 2, r: 8.5, ty: 1.4 }); title("Root garden", "Hanami grew the preview");
      play("hanami", 3.2, (u, R) => { const k = bump(u, 0, 0.25) - bump(u, 0.8, 1); R.hips.position.y = 0.95 - 0.35 * k; R.armL.rotation.x = -1.2 * k; R.armR.rotation.x = -1.2 * k; R.legL.rotation.x = -0.9 * k; R.legL.shin.rotation.x = 1.4 * k; });
      roots.children.forEach((r, i) => { r.visible = true; effect(3.2, (k) => { const g = out(bump(k, 0.08 + i * 0.03, 0.4 + i * 0.03)) * (1 - bump(k, 0.85, 1)); r.scale.y = Math.max(0.001, g); }, () => (r.visible = false)); });
      after(0.9, () => kill("hanami", "vines"));
      site.material.map = null; site.material.color.set("#1a1a1a"); site.material.needsUpdate = true;
      effect(3.2, (k) => { if (k > 0.5 && !site.material.map) { site.material.map = siteTex; site.material.color.set("#ffffff"); site.material.needsUpdate = true; burst(new THREE.Vector3(-1.4, 2.2, -3.8), 30, ["#f3a7c2", "#ffd9e6", "#9be07c"], 3, { life: 1.4, grav: -1.2 }); } });
      setTimeout(() => (c.screen.visible = true), 1700);
      log("hanami", "Grew a new phone site", "mockup: built");
    },
    draft(c) { // Yuta: Rika rises behind him, his words fly out as glowing rings into the crate, which folds into a letter
      focus("yuta", 3.6, { pri: 2, r: 9, ty: 1.8, el: 0.28 }); title("Cursed Speech", "Yuta wrote the email");
      const f = F.yuta; f.rika.visible = true;
      play("yuta", 3.2, (u, R) => { const k = bump(u, 0.05, 0.3) - bump(u, 0.8, 1); R.rika.scale.setScalar(Math.max(0.001, out(k))); R.rika.children.forEach((a) => a.userData.arm && (a.rotation.x = -0.6 - 0.5 * Math.sin(u * 9) * k));
        R.armR.rotation.x = -1.3 * k; R.head.rotation.x = -0.2 * k;
        if (u > 0.35 && u < 0.75 && rnd() < 0.18) { const from = worldOf(R.head); const to = c.g.position.clone().add(new THREE.Vector3(0, 0.5, 0));
          const ring = mesh(new THREE.TorusGeometry(0.18, 0.02, 4, 16), glow("#9fb0ff"), scene, 0, 0, 0, false);
          effect(0.6, (q) => { ring.position.lerpVectors(from, to, out(q)); ring.lookAt(to); ring.scale.setScalar(1 + q); ring.material.opacity = 1 - q * 0.6; }, () => scene.remove(ring)); }
      }, (R) => (R.rika.visible = false));
      after(1.6, () => kill("yuta", "crush"));
      setTimeout(() => { c.body.visible = false; c.env.visible = true; burst(c.g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 16, ["#c9d2ff", "#ffffff"], 2.5, { life: 0.6 }); }, 2300);
      log("yuta", "Wrote a three-sentence email", "draft: written");
    },
    check(c, ok = true) { // Mahoraga: the wheel turns one eighth with a clank and a ring of light; green passes, red stops it
      focus("mahoraga", 2.8, { r: 9.5, ty: 1.9 }); if (!ok) title("Adaptation", "Mahoraga stopped a made-up fact");
      const f = F.mahoraga, from = f.wheel.rotation.y;
      f.lamp.material.color.set(ok ? "#7cff9c" : "#ff3b3b");
      play("mahoraga", 1.8, (u, R) => { R.wheel.rotation.y = from + (Math.PI / 4) * out(bump(u, 0.15, 0.5)); R.head.rotation.x = 0.15 * Math.sin(bump(u, 0.15, 0.5) * Math.PI);
        if (u > 0.5 && !R._k) { R._k = true; const p = worldOf(R.wheel); const ring = mesh(new THREE.TorusGeometry(0.5, 0.03, 4, 32), glow(ok ? "#ffe39a" : "#ff3b3b"), scene, p.x, p.y, p.z, false); ring.rotation.x = Math.PI / 2;
          effect(0.8, (q) => { ring.scale.setScalar(1 + q * 4); ring.material.opacity = 1 - q; }, () => scene.remove(ring)); burst(p, 12, "#ffd77a", 3, { life: 0.5 }); kill("mahoraga", "chop"); } }, (R) => (R._k = false));
      if (ok) c.ok.visible = true;
      log("mahoraga", ok ? "Every claim matched the site" : "Stopped a claim with no source", ok ? "check: pass" : "check: STOP");
    },
    approve(c) { // TJ's desk lights, then Todo claps: the card swaps from the back line onto the send line
      focus("todo", 2.6, { r: 7.5, az: -0.8 }); title("Boogie Woogie", "Todo moved your approved card");
      play("todo", 2.0, (u, R) => { const k = Math.sin(bump(u, 0.2, 0.5) * Math.PI); R.armL.rotation.set(-1.3 * k, 0, -0.6 * k); R.armR.rotation.set(-1.3 * k, 0, 0.6 * k); R.armL.fore.rotation.x = -0.5 * k; R.armR.fore.rotation.x = -0.5 * k;
        if (u > 0.42 && !R._c) { R._c = true; const p = worldOf(R.armR.hand); const ring = mesh(new THREE.RingGeometry(0.2, 0.32, 24), glow("#ffffff", { side: THREE.DoubleSide }), scene, p.x, p.y, p.z, false);
          effect(0.4, (q) => { ring.scale.setScalar(1 + q * 6); ring.material.opacity = 1 - q; ring.lookAt(camera.position); }, () => scene.remove(ring));
          const a = c.g.position.clone(); burst(a.clone().setY(0.8), 18, ["#ffffff", "#9fd6ff"], 3, { life: 0.4 });
          kill("todo", "swap"); c.line = 1; c.x = FRONT[0][0] - 0.2; c.g.position.set(c.x, 0.62, FRONT[0][1]); burst(c.g.position.clone().setY(0.8), 18, ["#ffffff", "#9fd6ff"], 3, { life: 0.4 }); flash = 0.25; } }, (R) => (R._c = false));
      tjLight.material.color.set("#ffffff"); setTimeout(() => tjLight.material.color.set("#ffb547"), 500);
      log("todo", "Swapped your approved card onto the send line", "handoff: ok");
    },
    send(batch) { // Gojo: Domain Expansion. The void opens round him, the batch rises up the tube, the void closes
      const f = F.gojo; focus("gojo", 5.2, { pri: 2, r: 13, el: 0.3, ty: 1.6 }); title("Domain Expansion", "Unlimited Void: Gojo sent " + batch.length + (batch.length === 1 ? " email" : " emails"));
      domain.visible = true; domain.position.set(f.base.x, 1.2, f.base.z + 0.8);
      play("gojo", 5, (u, R) => { const k = out(bump(u, 0.05, 0.3)) * (1 - bump(u, 0.85, 1));
        domain.scale.setScalar(0.01 + k * 5.2); domainSeal.position.set(domain.position.x, 0.03, domain.position.z); domainSeal.material.opacity = k; domainSeal.rotation.z = u * 1.2; domainSeal.scale.setScalar(0.4 + 0.6 * out(bump(u, 0, 0.3))); voidMat.uniforms.uA.value = k * 0.92; rimMat.uniforms.uA.value = k; voidMat.uniforms.uT.value = u * 5;
        R.armR.rotation.x = -1.6 * bump(u, 0, 0.12) * (1 - bump(u, 0.85, 1)); R.armR.fore.rotation.x = -0.4 * k; R.armR.rotation.z = 0.2;
        R.hips.position.y = 0.95 + 0.25 * k; tubeGlow.material.opacity = k; tubeGlow.position.y = 1.2 + ((u * 3) % 1) * 7;
      }, () => { domain.visible = false; tubeGlow.material.opacity = 0; });
      batch.forEach((c, i) => { const p0 = c.g.position.clone(); setTimeout(() => { c.line = 2; effect(1.4, (q) => { c.g.position.set(tube.position.x, 0.62 + out(q) * 8, tube.position.z); c.g.rotation.y += 0.2; }, () => { c.gone = true; }); }, 900 + i * 500); });
      flash = 0.4; shake = 0.25; after(1.4, () => kill("gojo", "dust")); after(1.7, () => kill("hakari", "dust"));
      log("gojo", `Sent ${batch.length} approved ${batch.length === 1 ? "email" : "emails"}`, `send: ${batch.length}`);
    },
    followup(jackpot) { // Hakari: the reels spin; a follow-up stops on a miss, a real reply is 7-7-7 and coins everywhere
      const f = F.hakari; focus("hakari", jackpot ? 4.6 : 2.6, { pri: jackpot ? 2 : 1, r: jackpot ? 7.5 : 8, az: 0.35, ty: 1.4 }); if (jackpot) title("Jackpot", "Hakari caught a real reply");
      const res = jackpot ? [6, 6, 6] : [Math.floor(rnd() * 6), Math.floor(rnd() * 6), 6 - 1 - Math.floor(rnd() * 3)];
      reelState.forEach((r, i) => {
      if (r.stop && now > r.stop.at) { const target = 1 - (r.stop.idx + 1) / 7, d = (((target - r.off) % 1) + 1) % 1; if (d < 0.03) { r.off = target; r.stop = null; r.v = 0; } else r.off += Math.min(0.03, d); }
      else if (r.v) r.off += r.v * dt * 0.1;
      reelTex[i].offset.y = r.off; });
      play("hakari", jackpot ? 4 : 2.2, (u, R) => { R.hips.position.y = 0.95 + Math.abs(Math.sin(u * 22)) * 0.08; R.armL.rotation.x = -2.6 * (jackpot ? bump(u, 0.55, 0.65) : 0); R.armR.rotation.x = R.armL.rotation.x; R.torso.rotation.y = Math.sin(u * 11) * 0.3;
        if (jackpot && u > 0.55 && !R._j) { R._j = true; flash = 0.35; const p = cab.position.clone().setY(2.2);
          burst(p, 90, ["#ffd34a", "#ffe9a0", "#2bd17a"], 7, { life: 1.6, up: 1.2, size: 1.3 }); kill("hakari", "coins"); }
        if (!jackpot && u > 0.5 && !R._j) { R._j = true; kill("hakari", "knock"); } }, (R) => (R._j = false));
      log("hakari", jackpot ? "A shop replied: follow-ups stopped" : "Day 3 follow-up spun out", jackpot ? "reply: JACKPOT" : "follow-up: sent");
    },
    receptionist() { // Nanami: the board lights, he stands, one clean slash at the 7:3 point, back to the phone
      focus("nanami", 3, { pri: 2, r: 7, el: 0.3, ty: 1.2 }); title("Ratio 7:3", "Nanami took an after-hours call");
      jacks.forEach((j, i) => setTimeout(() => j.material.color.set(i % 3 ? "#3a3a3a" : "#7cff9c"), i * 30));
      play("nanami", 2.6, (u, R) => { const st = bump(u, 0.05, 0.25) - bump(u, 0.8, 1); R.hips.position.y = 0.62 + 0.33 * st; R.legL.rotation.x = R.legR.rotation.x = -1.5 * (1 - st); R.legL.shin.rotation.x = R.legR.shin.rotation.x = 1.5 * (1 - st);
        const s = bump(u, 0.4, 0.52); R.armR.rotation.set(-2.4 * (1 - s) * st + 0.2 * s, 0, 0.4 * s); R.torso.rotation.y = -0.5 * s * (1 - bump(u, 0.7, 0.9));
        if (s > 0.5 && !R._s) { R._s = true; slash.visible = true; slash.scale.x = 0.01; effect(0.7, (q) => { slash.scale.x = out(q * 3); slash.material.opacity = 1 - bump(q, 0.6, 1); }, () => (slash.visible = false)); shake = 0.15; kill("nanami", "halves"); burst(worldOf(ratioBoard), 16, ["#ff4040", "#ffffff"], 3, { life: 0.4 }); } }, (R) => { R._s = false; jacks.forEach((j) => j.material.color.set("#3a3a3a")); });
      log("nanami", "Answered an after-hours call, booked a window", "call: booked");
    },
    paid() { // Sukuna: the shrine rises out of the floor, cuts fill the air, a red sky for a moment
      focus("sukuna", 5.5, { pri: 2, r: 13, el: 0.3, ty: 2 }); title("Malevolent Shrine", "Sukuna: a client paid");
      shrine.visible = true;
      play("sukuna", 5.2, (u, R) => { const k = out(bump(u, 0, 0.25)) * (1 - bump(u, 0.85, 1)); shrine.position.y = -3.6 + 3.6 * k;
        R.armL.rotation.x = R.armR.rotation.x = -1.2 * k; R.armL2.rotation.x = R.armR2.rotation.x = -0.6 * k; R.hips.position.y = 0.95 + 0.2 * k;
        const on = u > 0.3 && u < 0.85; cuts.forEach((c) => { if (on && rnd() < 0.25) { c.visible = true; c.position.set(R.base.x + (rnd() - 0.5) * 9, 0.4 + rnd() * 3.4, R.base.z + (rnd() - 0.5) * 7); c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); } else if (rnd() < 0.4) c.visible = false; });
        scene.background.lerpColors(new THREE.Color("#0b0e11"), new THREE.Color("#2a0408"), k * 0.8); scene.fog.color.copy(scene.background);
        if (u > 0.3 && !R._p) { R._p = true; shake = 0.4; flash = 0.3; burst(new THREE.Vector3(R.base.x, 1, R.base.z), 50, ["#ff2840", "#ffd34a"], 5, { life: 1 }); for (const id in dummies) if (dummies[id].g.position.distanceTo(R.base) < 10) after(0.2 + rnd() * 1.2, () => kill(id, "slice")); } },
        (R) => { R._p = false; shrine.visible = false; cuts.forEach((c) => (c.visible = false)); scene.background.set("#0b0e11"); scene.fog.color.set("#0b0e11"); });
      log("sukuna", "Client paid the $299 setup", "stripe: paid");
    },
    fail(why) { // Jogo: the head erupts, lava everywhere and a meteor drops into the furnace
      focus("jogo", 4.2, { pri: 2, r: 10, az: 0.9, el: 0.35, ty: 1.6 }); title("Maximum: Meteor", "Jogo: " + (why || "a step failed"));
      const f = F.jogo; const tgt = dummies.jogo?.g.position || f.base; const met = mesh(ball(0.7, 1), glow("#ff7a1a"), scene, f.base.x + 2, 14, f.base.z, false);
      play("jogo", 3.6, (u, R) => { R.root.position.y = Math.abs(Math.sin(u * 30)) * 0.12 * (1 - u); R.armL.rotation.z = -1.0 - 0.5 * Math.sin(u * 20); R.armR.rotation.z = 1.0 + 0.5 * Math.sin(u * 20);
        if (u < 0.6 && rnd() < 0.7) { const p = worldOf(R.lava); burst(p, 3, ["#ff6a1a", "#ffd34a", "#3a2a20"], 5, { up: 2.5, upr: 1, life: 1.2 }); }
        met.position.set(tgt.x + 3 - 3 * bump(u, 0.2, 0.6), 14 - 13.3 * out(bump(u, 0.2, 0.6)), tgt.z); met.visible = u < 0.6;
        if (u > 0.6 && !R._m) { R._m = true; shake = 0.6; flash = 0.35; burst(met.position.clone(), 60, ["#ff6a1a", "#ffd34a", "#1a1010"], 8, { life: 1.2 }); kill("jogo", "ash"); } },
        (R) => { R._m = false; scene.remove(met); });
      log("jogo", why || "A step failed", "FAIL: " + (why || "step"));
    },
  };

  /* ---------- the line: crates move, stop at each station, the station plays its move ---------- */
  const STOPS0 = [{ id: "yuji", x: -10.5 }, { id: "hanami", x: -3.5 }, { id: "yuta", x: 3.5 }, { id: "mahoraga", x: 10.5 }, { id: "throne", x: 18.4 }];
  const STOPS1 = [{ id: "gojo", x: 11 }, { id: "hakari", x: 4 }];
  const busy = (id) => F[id]?.act;
  let mode = "demo", demoOn = true, queue = [], gojoHold = [];
  const live = { rows: [], seen: new Set() };

  const spawn = () => { const c = makeCrate(); c.g.visible = false; c.x = BACK[0][0] + 2.2; c.g.position.set(c.x, 0.62, BACK[0][1]); crates.push(c); MOVES.pick(c); return c; };
  const stepLine = (dt) => {
    const speed = 1.6;
    for (const c of crates) {
      if (c.gone || c.line === 2) continue;
      const stops = c.line === 0 ? STOPS0 : STOPS1, dir = c.line === 0 ? 1 : -1;
      const nx = stops[c.stage]; const ahead = crates.some((o) => o !== c && !o.gone && o.line === c.line && (o.x - c.x) * dir > 0 && (o.x - c.x) * dir < 0.95);
      if (c.wait > 0) { c.wait -= dt; continue; }
      if (nx && Math.abs(nx.x - c.x) < 0.05) {
        if (busy(nx.id) && nx.id !== "throne") continue;
        if (!c.done?.[c.line + nx.id]) { (c.done ||= {})[c.line + nx.id] = 1; c.wait = arrive(c, nx.id); if (c.wait == null) c.wait = 0; continue; }
        c.stage++; continue;
      }
      if (ahead || !c.g.visible) continue;
      const tx = nx ? nx.x : (c.line === 0 ? BACK[1][0] : FRONT[1][0]);
      c.x += Math.sign(tx - c.x) * Math.min(speed * dt, Math.abs(tx - c.x));
      c.g.position.x = c.x;
      if (!nx && Math.abs(tx - c.x) < 0.05 && c.line === 1) { c.gone = true; }
    }
    for (let i = crates.length - 1; i >= 0; i--) if (crates[i].gone) { world.remove(crates[i].g); crates.splice(i, 1); }
  };
  const arrive = (c, id) => { // demo outcomes; in live mode the crates only carry what the log says
    if (mode === "live") return 0;
    if (id === "yuji") { if (rnd() < 0.12) { MOVES.flawMiss(); setTimeout(() => (c.gone = true), 1200); return 99; } MOVES.flaw(c); return 2.4; }
    if (id === "hanami") { MOVES.mockup(c); return 3.3; }
    if (id === "yuta") { MOVES.draft(c); return 3.3; }
    if (id === "mahoraga") { const ok = rnd() > 0.12; MOVES.check(c, ok); if (!ok) { setTimeout(() => { MOVES.fail("Checker stopped a draft with a claim it couldn't prove"); }, 1500); setTimeout(() => (c.gone = true), 1500); return 99; } return 1.9; }
    if (id === "throne") { holoPulse = 1.2; setTimeout(() => MOVES.approve(c), 1500); return 99; }
    if (id === "gojo") { gojoHold.push(c); if (gojoHold.length >= 2 && !busy("gojo")) { const b = gojoHold.splice(0); setTimeout(() => MOVES.send(b), 400); } return 99; }
    return 0;
  };
  let holoPulse = 0;

  // demo director: keeps the line full and drops the rarer moments in at believable gaps
  let tSpawn = 1, tCall = 14, tPay = 40, tReply = 22;
  const demoTick = (dt) => {
    tSpawn -= dt; tCall -= dt; tPay -= dt; tReply -= dt;
    if (tSpawn <= 0 && !busy("toji") && crates.filter((c) => c.line === 0).length < 5) { spawn(); tSpawn = 6 + rnd() * 3; }
    if (tCall <= 0 && !busy("nanami")) { MOVES.receptionist(); tCall = 28 + rnd() * 20; }
    if (tReply <= 0 && !busy("hakari")) { MOVES.followup(rnd() < 0.3); tReply = 18 + rnd() * 12; }
    if (tPay <= 0 && !busy("sukuna")) { MOVES.paid(); tPay = 80 + rnd() * 40; }
    if (gojoHold.length && !busy("gojo") && gojoHold.every((c) => c.x <= 11.05)) { if (gojoHold._t === undefined) gojoHold._t = 9; gojoHold._t -= dt; if (gojoHold._t < 0) { const b = gojoHold.splice(0); gojoHold._t = undefined; MOVES.send(b); } }
  };

  /* live mode: each new event row plays its move (rows come from the agency's events table via the host) */
  const STEP_MOVE = { flaw: "flaw", mockup: "mockup", draft: "draft", approve: "approve", send: "send", inbox: "inbox", receptionist: "receptionist", call_review: "receptionist", stripe: "paid", client: "paid", golive: "paid" };
  const playRow = (r) => {
    if (!r.ok) return MOVES.fail(`${r.step} failed${r.reason ? ": " + r.reason : ""}`);
    const c = crates.find((x) => x.pid === r.prospect_id) || null;
    const need = (line = 0) => { const n = c || makeCrate(); if (!c) { n.pid = r.prospect_id; n.line = line; n.x = line ? FRONT[0][0] : BACK[0][0] + 2.2; n.g.position.set(n.x, 0.62, line ? FRONT[0][1] : BACK[0][1]); crates.push(n); } n.g.visible = true; return n; };
    switch (r.step) {
      case "flaw": { const n = need(); if (!c) MOVES.pick(n); setTimeout(() => MOVES.flaw(n), 1800); break; }
      case "mockup": MOVES.mockup(need()); break;
      case "draft": { const n = need(); MOVES.draft(n); setTimeout(() => MOVES.check(n, true), 3400); break; }
      case "approve": MOVES.approve(need()); break;
      case "send": if (r.detail?.followup || r.detail?.kind === "followup") MOVES.followup(false); else MOVES.send([need(1)]); break;
      case "inbox": MOVES.followup(/repl/i.test(JSON.stringify(r.detail || r.reason || ""))); break;
      case "receptionist": case "call_review": MOVES.receptionist(); break;
      case "stripe": case "client": case "golive": MOVES.paid(); break;
    }
  };
  const liveTick = (dt) => {
    if (busyAny() || !queue.length) return; playRow(queue.shift());
  };
  const busyAny = () => Object.values(F).some((f) => f.act && f.act.dur > 2.5);

  /* ---------- idle life: everyone fidgets in character ---------- */
  const idle = (f, t) => {
    const R = f, ph = f.phase + t; if (R.act) return;
    R.hips.position.y = 0.95; R.torso.rotation.set(0, 0, 0);
    switch (f.idle) {
      case "bounce": R.hips.position.y = 0.95 + Math.abs(Math.sin(ph * 4)) * 0.05; R.armL.rotation.x = -1.2 + Math.sin(ph * 8) * 0.25; R.armR.rotation.x = -1.2 - Math.sin(ph * 8) * 0.25; R.armL.fore.rotation.x = R.armR.fore.rotation.x = -1.2; break;
      case "lean": R.torso.rotation.z = 0.06; R.armL.rotation.set(0, 0, -0.08); R.armR.rotation.x = -0.15; R.head.rotation.y = Math.sin(ph * 0.4) * 0.5; break;
      case "sway": R.torso.rotation.z = Math.sin(ph * 0.7) * 0.05; R.armL.rotation.x = R.armR.rotation.x = Math.sin(ph * 0.7) * 0.1; break;
      case "write": R.armR.rotation.x = -0.9; R.armR.fore.rotation.x = -0.6 + Math.sin(ph * 9) * 0.12; R.head.rotation.x = 0.25; break;
      case "loom": R.hips.position.y = 0.95 + Math.sin(ph * 1.2) * 0.02; R.wheel.rotation.y += 0.0; R.head.rotation.y = Math.sin(ph * 0.3) * 0.3; break;
      case "flex": { const k = (Math.sin(ph * 0.8) + 1) / 2; R.armL.rotation.set(-0.2, 0, -1.4 * k); R.armR.rotation.set(-0.2, 0, 1.4 * k); R.armL.fore.rotation.x = R.armR.fore.rotation.x = -1.6 * k; break; }
      case "cool": R.armL.rotation.set(0, 0, -0.05); R.armR.rotation.set(-0.1, 0, 0.1); R.head.rotation.set(-0.12, Math.sin(ph * 0.3) * 0.25, 0); R.hips.position.y = 0.95 + Math.sin(ph * 1.4) * 0.03; break;
      case "groove": R.hips.position.y = 0.95 + Math.abs(Math.sin(ph * 3.3)) * 0.06; R.torso.rotation.y = Math.sin(ph * 3.3) * 0.25; R.armL.rotation.x = Math.sin(ph * 3.3) * 0.5; R.armR.rotation.x = -R.armL.rotation.x; break;
      case "sit": R.hips.position.y = 0.62; R.legL.rotation.x = R.legR.rotation.x = -1.5; R.legL.shin.rotation.x = R.legR.shin.rotation.x = 1.5; R.armR.rotation.x = -0.9; R.armL.rotation.set(-2.4, 0, -0.4); R.armL.fore.rotation.x = -1.8; R.head.rotation.z = -0.15; break;
      case "throne": R.armL.rotation.z = -0.3; R.armR.rotation.z = 0.3; R.armL2.rotation.x = R.armR2.rotation.x = -0.9 + Math.sin(ph) * 0.05; R.head.rotation.y = Math.sin(ph * 0.25) * 0.4; break;
      case "fume": R.armL.rotation.z = -0.4; R.armR.rotation.z = 0.4; if (rnd() < 0.08) emit(worldOf(R.lava), new THREE.Vector3((rnd() - 0.5) * 0.3, 1 + rnd(), (rnd() - 0.5) * 0.3), "#6a6460", 2, 2.2, 0.15); break;
    }
    R.armL.fore.rotation.x ||= 0;
  };

  /* ---------- input: drag to orbit, pinch or wheel to zoom, tap a fighter for their card ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let drag = null, pinch = 0;
  const ptrs = new Map();
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
  canvas.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId)) return; const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoom(pinch / d); pinch = d; drag && (drag.moved = 99); return; }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; if (drag) drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag && drag.moved > 6) { userUntil = now + 20; goal.az -= dx * 0.005; goal.el = clamp(goal.el + dy * 0.004, 0.12, 1.25); }
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (drag && drag.moved < 6 && e.type === "pointerup") pick(e); drag = null; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
  const zoom = (k) => { userUntil = now + 20; goal.r = clamp(goal.r * k, 4, 80); };
  const pick = (e) => {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(Object.values(F).map((f) => f.root), true)[0];
    const id = hit?.object.userData.fid; if (id) { userUntil = now + 20; userUntil = 0; focus(id, 1e9, { r: 6, el: 0.22, ty: 1.2, az: 0.55, pri: 3 }); userUntil = now + 20; opts.onPick?.(profile(id)); }
  };
  const profile = (id) => ({ ...CASTBY[id], count: F[id].count, lastLine: F[id].last, portrait: () => portrait(id) });

  /* ---------- Mii portrait: render a fighter's head and shoulders into a small image for the card ---------- */
  const pCam = new THREE.PerspectiveCamera(26, 1, 0.05, 30), pRT = new THREE.WebGLRenderTarget(256, 256, { colorSpace: THREE.SRGBColorSpace });
  const pScene = new THREE.Scene(); pScene.background = new THREE.Color("#dfe8ee");
  pScene.add(new THREE.HemisphereLight("#ffffff", "#8a7a66", 2.2)); { const k = new THREE.DirectionalLight("#fff3e0", 2.2); k.position.set(2, 3, 4); pScene.add(k); }
  const portrait = (id) => { // the fighter alone on a soft backdrop, standing straight, head and shoulders
    const f = F[id]; if (!f.act) resetPose(f);
    const parent = f.root.parent, pos = f.root.position.clone(), rot = f.root.rotation.y;
    pScene.add(f.root); f.root.position.set(0, 0, 0); f.root.rotation.y = 0; f.root.updateMatrixWorld(true);
    const head = worldOf(f.head), s = f.root.scale.x;
    pCam.position.set(0, head.y + 0.05 * s, 2.4 * s); pCam.lookAt(0, head.y - 0.28 * s, 0);
    renderer.setRenderTarget(pRT); renderer.render(pScene, pCam); renderer.setRenderTarget(null);
    parent.add(f.root); f.root.position.copy(pos); f.root.rotation.y = rot;
    const px = new Uint8Array(256 * 256 * 4); renderer.readRenderTargetPixels(pRT, 0, 0, 256, 256, px);
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) img.data.set(px.subarray((255 - y) * 1024, (256 - y) * 1024), y * 1024);
    g.putImageData(img, 0, 0); return c.toDataURL("image/png");
  };

  /* ---------- labels: the acting fighter's name floats over them ---------- */
  const tags = {};
  if (opts.labels !== false) for (const id in F) { const el = document.createElement("div"); el.className = "vault-tag"; el.textContent = `${CASTBY[id].name} · ${CASTBY[id].job}`; container.append(el); tags[id] = el; }
  const _v = new THREE.Vector3();
  const placeTags = () => { const r = canvas.getBoundingClientRect();
    for (const id in tags) { const f = F[id], el = tags[id]; const on = !!f.act || f.hover; el.classList.toggle("on", on); if (!on) continue;
      _v.copy(worldOf(f.head)); _v.y += 0.6 * f.root.scale.x + (id === "mahoraga" ? 1 : 0); _v.project(camera); if (_v.z > 1 || Math.abs(_v.x) > 1.05 || _v.y < -1 || (-_v.y * 0.5 + 0.5) * r.height < 76) { el.classList.remove("on"); continue; }
      el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * r.width}px, ${(-_v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`; } };

  /* ---------- loop ---------- */
  const layout = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(layout).observe(container); layout();
  Object.keys(screens).forEach((id) => drawScreen(id));
  let last = performance.now(), running = true, raf = 0, acc = 0;
  const frame = (ts) => {
    raf = requestAnimationFrame(frame);
    if (!running || document.hidden) { last = ts; return; }
    let dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    if (phone) { acc += dt; if (acc < 1 / 31) return; dt = acc; acc = 0; }
    now += dt; tick(dt); render();
  };
  const tick = (dt) => {
    if (mode === "demo") { if (demoOn) demoTick(dt); } else liveTick(dt);
    stepLine(dt);
    for (const b of belts) b.t.offset.x -= (dt * 1.6 * b.dir) / 1.0;
    for (const f of Object.values(F)) {
      const d = dummies[f.id], want = f.act && d && d.g.parent && f.id !== "gojo" ? Math.atan2(d.home.x - f.base.x, d.home.z - f.base.z) : f.ry;
      let da = ((want - f.root.rotation.y + Math.PI) % TAU + TAU) % TAU - Math.PI; f.root.rotation.y += da * Math.min(1, dt * 9);
      if (f.act) { f.act.t += dt; const u = Math.min(1, f.act.t / f.act.dur); f.act.fn(u, f); if (u >= 1) { const e = f.act.end; f.act = null; e && e(f); resetPose(f); } }
      else idle(f, now);
    }
    for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; const u = Math.min(1, e.t / e.dur); e.update(u); if (u >= 1) { e.done && e.done(); fx.splice(i, 1); } }
    stepParts(dt); stepDebris(dt);
    // reels
    reelState.forEach((r, i) => { if (r.stop && now > r.stop.at) { const target = 1 - (r.stop.idx + 1) / 7; const cur = ((r.off % 1) + 1) % 1; r.off += Math.min(0.02, ((target - cur + 1) % 1)); if (Math.abs(((r.off % 1) + 1) % 1 - target) < 0.004) { r.off = target; r.stop = null; r.v = 0; } } else if (r.v) r.off += r.v * dt * 0.1; reelTex[i].offset.y = r.off; });
    cabLights.forEach((l, i) => l.material.color.setHSL(F.hakari.act ? ((now * 2 + i / 14) % 1) : 0.13, 0.9, F.hakari.act ? 0.6 : 0.35 + 0.15 * Math.sin(now * 3 + i)));
    holoPulse = Math.max(0, holoPulse - dt); holoCards.children.forEach((c, i) => { c.position.y = Math.sin(now * 1.5 + i) * 0.05; c.material.opacity = 0.25 + 0.5 * holoPulse; });
    geo.forEach((g, i) => (g.material.emissiveIntensity = 0.3 + 0.12 * Math.sin(now * 0.5 + i * 1.7))); // slow breath, about 5 a minute
    needle.rotation.z = 0.9 - 0.15 * Math.sin(now * 0.7) - (F.jogo.act ? 2.2 : 0);
    mouth.material.opacity = 0.5 + 0.2 * Math.sin(now * 7) + (F.jogo.act ? 0.3 : 0);
    F.mahoraga.wheel.rotation.z = Math.sin(now * 0.6) * 0.03;
    if (!F.mahoraga.act && rnd() < 0.002) F.mahoraga.lamp.material.color.set("#7cff9c");
    if (rnd() < (phone ? 0.08 : 0.18)) emit(new THREE.Vector3(-25 + rnd() * 0.4, 7.5, -2 + rnd()), new THREE.Vector3(0.4, 0.6, 0), "#4a5054", 3, 3, 0.05); // steam off the vent pipe
    // camera
    if (now > focusUntil && now > userUntil) { idleCut -= dt; if (director && idleCut < 0) { const ids = ["toji", "yuji", "hanami", "yuta", "mahoraga", "todo", "gojo", "hakari", "nanami", "sukuna", "jogo"]; idleCut = 9; goal = rnd() < 0.5 ? (focusId = null, home()) : (focus(ids[Math.floor(rnd() * ids.length)], 4, { r: 9, el: 0.36, pri: 0 }), goal); } }
    const k = 1 - Math.exp(-dt * 2.4);
    for (const key of ["az", "el", "r", "tx", "ty", "tz"]) cam[key] += (goal[key] - cam[key]) * k;
    const target = new THREE.Vector3(cam.tx, cam.ty, cam.tz);
    camera.position.set(target.x + Math.sin(cam.az) * Math.cos(cam.el) * cam.r, target.y + Math.sin(cam.el) * cam.r, target.z + Math.cos(cam.az) * Math.cos(cam.el) * cam.r);
    if (shake > 0) { camera.position.x += (rnd() - 0.5) * shake; camera.position.y += (rnd() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.6); }
    camera.lookAt(target);
    flashQuad.material.opacity = flash; flash = Math.max(0, flash - dt * 2.5);
    const close = cam.r < 20; signList.forEach((g) => (g.visible = !close || g.userData.sid === focusId));
    placeTags();
  };
  const resetPose = (R) => { for (const k of ["armL", "armR", "legL", "legR", "torso", "head"]) R[k].rotation.set(0, 0, 0); R.armL.fore.rotation.set(0, 0, 0); R.armR.fore.rotation.set(0, 0, 0); R.legL.shin.rotation.set(0, 0, 0); R.legR.shin.rotation.set(0, 0, 0); R.root.position.copy(R.base); R.hips.position.y = 0.95; };
  const render = () => { if (phone) renderer.render(scene, camera); else composer.render(); };
  raf = requestAnimationFrame(frame);
  // warm start: a few crates already on the line so the floor is never empty
  { const c1 = makeCrate(); c1.x = -6; c1.stage = 1; c1.tag.visible = true; c1.g.position.set(c1.x, 0.62, BACK[0][1]); crates.push(c1);
    const c2 = makeCrate(); c2.x = 7.5; c2.stage = 3; c2.tag.visible = true; c2.screen.visible = true; c2.body.visible = false; c2.env.visible = true; c2.g.position.set(c2.x, 0.62, BACK[0][1]); crates.push(c2);
    const c3 = makeCrate(); c3.line = 1; c3.x = 13.5; c3.body.visible = false; c3.env.visible = true; c3.ok.visible = true; c3.g.position.set(c3.x, 0.62, FRONT[0][1]); crates.push(c3); }

  return {
    CAST, moves: MOVES, scene, camera,
    setDirector(on) { director = on; if (!on) { goal = home(); focusUntil = 0; curPri = 0; focusId = null; } },
    home() { userUntil = 0; focusUntil = 0; curPri = 0; focusId = null; goal = home(); },
    focus(id) { userUntil = 0; focus(id, 1e9, { r: 6, el: 0.22, ty: 1.2, az: 0.55, pri: 3 }); },
    profile, portrait,
    // rows from the events table, newest last; once any arrive the demo stops and only real events play
    feed(rows) { const fresh = rows.filter((r) => !live.seen.has(r.id)); fresh.forEach((r) => live.seen.add(r.id)); if (!rows.length) return; if (mode === "demo") { mode = "live"; crates.forEach((c) => (c.gone = true)); return; } queue.push(...fresh); },
    get mode() { return mode; },
    demo(on) { demoOn = on; if (!on) crates.forEach((c) => (c.gone = true)); },
    pause() { running = false; }, resume() { running = true; last = performance.now(); },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); canvas.remove(); Object.values(tags).forEach((t) => t.remove()); },
    _jump(t) { for (let i = 0; i < t * 30; i++) tick(1 / 30); }, // tests and screenshots: fast-forward the sim
  };
}
