/* ---------- Canvas: 3D brain, 4D layer and the core ---------- */
const cv = $("sky"), cx = cv.getContext("2d");
let W, H, DPR;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize(); addEventListener("resize", resize);

/* The brain is a real 3D sphere of notes you can orbit, with a 4D tesseract turning inside it.
   Each look (theme) has its own core, drawn between the far and near halves of the brain. */
const nodes = BRAIN.notes.map((n, i, all) => { // even spread on a sphere (Fibonacci lattice)
  const k = i + 0.5, phi = Math.acos(1 - 2 * k / all.length), th = Math.PI * (1 + Math.sqrt(5)) * k;
  return { ...n, x: Math.sin(phi) * Math.cos(th), y: Math.cos(phi), z: Math.sin(phi) * Math.sin(th), vx: 0, vy: 0, vz: 0, hot: 0, la: 0 };
});
const nodeBy = new Map(nodes.map((n) => [n.name, n]));
const edges = [];
for (const n of nodes) for (const l of n.links) if (nodeBy.has(l) && l !== n.name) edges.push([n, nodeBy.get(l)]);
for (const n of nodes) n.deg = edges.filter(([a, b]) => a === n || b === n).length;
edges.forEach((e, i) => { e.seed = (i * 0.618) % 1; });
const TYPE_COLOR = { hub: "#5fc9c0", rules: "#e07a6b", log: "#f5a623", list: "#d8c39a", week: "#b8b0a2", personal: "#7fbf8f" };

let cinemaK = 0; // 0 = normal layout, 1 = Show off cinema (brain centred and bigger)
function coreBox() {
  const r = $("slot").getBoundingClientRect();
  const box = { ox: r.left + r.width / 2, oy: r.top + r.height / 2, base: Math.max(34, Math.min(r.width, r.height) * 0.21) };
  if (cinemaK < 0.001) return box;
  const k = cinemaK * cinemaK * (3 - 2 * cinemaK), big = Math.max(box.base, Math.min(W, H * 0.62) * 0.16);
  return { ox: box.ox + (W / 2 - box.ox) * k, oy: box.oy + (H * 0.46 - box.oy) * k, base: box.base + (big - box.base) * k };
}
// Linked notes pull together, every note pushes the others away, and all of them stay near the sphere's skin.
function physics() {
  for (const a of nodes) {
    for (const b of nodes) if (a !== b) {
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, d2 = dx * dx + dy * dy + dz * dz + 0.002;
      a.vx += dx * 0.0016 / d2; a.vy += dy * 0.0016 / d2; a.vz += dz * 0.0016 / d2;
    }
    const r = Math.hypot(a.x, a.y, a.z) || 1, f = (1 - r) * 0.04;
    a.vx += a.x / r * f; a.vy += a.y / r * f; a.vz += a.z / r * f;
  }
  for (const [a, b] of edges) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1, f = (d - 0.7) * 0.006 / d;
    a.vx += dx * f; a.vy += dy * f; a.vz += dz * f; b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
  }
  for (const n of nodes) { n.vx *= 0.82; n.vy *= 0.82; n.vz *= 0.82; n.x += n.vx; n.y += n.vy; n.z += n.vz; n.hot *= 0.985; }
}
for (let i = 0; i < 240; i++) physics(); // settle before the first frame

const MODE_COLOR = { idle: [79, 216, 255], speaking: [120, 230, 255], listening: [92, 242, 165], thinking: [255, 178, 62] };
let col = [79, 216, 255], t = 0, ARC = "79,216,255", THEME = "arc", BG = "#03070c";
const RINGS = { arc: " J.A.R.V.I.S. · TJ'S BRAIN · ONLINE · ", steel: " J.A.R.V.I.S. · TJ'S BRAIN · ONLINE · ", agency: " J.A.R.V.I.S. · AGENCY HQ · CLEARANCE GRANTED · ",
  spy: " J.A.R.V.I.S. · SECRET SERVICE · EYES ONLY · ", hunter: " J.A.R.V.I.S. · HUNTER'S LOG · SALT AND IRON · ",
  showoff: " J.A.R.V.I.S. · ALL SYSTEMS · FIVE DIMENSIONS · ONE BRAIN · " };
function setTheme(name) {
  if (!RINGS[name]) name = "arc";
  THEME = name;
  document.documentElement.dataset.theme = name; store.set("theme", name);
  ARC = getComputedStyle(document.documentElement).getPropertyValue("--arc-rgb").trim().replace(/\s/g, "") || "79,216,255";
  const c = ARC.split(",").map(Number);
  MODE_COLOR.idle = c; MODE_COLOR.speaking = c.map((v) => Math.min(255, v + 40));
  RING_TEXT = RINGS[name];
  BG = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#03070c";
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = BG;
}
let RING_TEXT = RINGS.arc;
setTheme(store.get("theme", "arc"));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Camera: drag to orbit, pinch or wheel to zoom, flick to spin ---------- */
const cam = { yaw: 0.5, pitch: -0.28, vYaw: 0.0016, vPitch: 0, zoom: 1, idleAt: 0 };
let view = null; // per-frame projection
// Tilt the phone to look around the brain a little (Android sends this without asking).
const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("deviceorientation", (e) => {
  if (e.gamma == null) return;
  tilt.tx = Math.max(-1, Math.min(1, e.gamma / 35)); tilt.ty = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 35));
});
function camera(ox, oy, s) {
  tilt.x += (tilt.tx - tilt.x) * 0.06; tilt.y += (tilt.ty - tilt.y) * 0.06;
  const yaw = cam.yaw + tilt.x * 0.35, pitch = Math.max(-1.4, Math.min(1.4, cam.pitch + tilt.y * 0.25));
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (x, y, z) => {
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    const f = 3.4 / (3.4 + z2); // z2 > 0 is away from you
    return [ox + x1 * s * f, oy + y1 * s * f, z2, f];
  };
}

/* ---------- 4D: a tesseract turning through the fourth dimension ---------- */
const TV = [], TE = [];
for (let i = 0; i < 16; i++) TV.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (j > i) TE.push([i, j, b]); }
function tesseract(time) {
  const a = time * 0.31, b = time * 0.19, c = time * 0.13;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  return TV.map(([x, y, z, w]) => {
    [x, w] = [x * ca - w * sa, x * sa + w * ca]; // XW plane
    [y, w] = [y * cb - w * sb, y * sb + w * cb]; // YW plane
    [z, w] = [z * cc - w * sc, z * sc + w * cc]; // ZW plane
    const k = 1.6 / (3 - w); // 4D to 3D perspective
    return [x * k * 0.42, y * k * 0.42, z * k * 0.42, w];
  });
}

/* ---------- Drifting particles: dust in the brain's own space ---------- */
const DUST = Array.from({ length: 150 }, (_, i) => {
  const r = 0.25 + ((i * 0.7548) % 1) * 1.5, phi = Math.acos(1 - 2 * ((i * 0.5698) % 1)), th = i * 2.399;
  return { r, phi, th, sp: 0.02 + ((i * 0.3183) % 1) * 0.05, tw: (i * 0.1347) % 1 };
});

/* ---------- Seeded glyphs for the Agency ring and Hunter sigils ---------- */
function rng(seed) { // Park-Miller, scrambled and warmed up so nearby seeds don't start out alike
  seed = (Math.imul(seed + 1, 2654435761) >>> 0) % 2147483646 + 1;
  const next = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4; i++) next();
  return next;
}
const GLYPHS = Array.from({ length: 28 }, (_, i) => {
  const r = rng(97 + i * 13), strokes = [];
  for (let s = 0; s < 3; s++) strokes.push([r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5, r() < 0.3]);
  return strokes;
});
function glyph(g, size) {
  cx.beginPath();
  for (const [x1, y1, x2, y2, arc] of g) {
    if (arc) { cx.moveTo(x1 * size + size * 0.2, y1 * size); cx.arc(x1 * size, y1 * size, size * 0.2, 0, Math.PI * 1.4); }
    else { cx.moveTo(x1 * size, y1 * size); cx.lineTo(x2 * size, y2 * size); }
  }
  cx.stroke();
}
const SALT = Array.from({ length: 220 }, (_, i) => { const r = rng(7 + i); return [r() * Math.PI * 2, r(), r()]; });
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/* ---------- Cores ---------- */
/* The calm looks' core: an instrument dial drawn from live data, read from the outside in.
   Outer ring: the notes by kind. Radial bars: one per note, as long as its links (white while a question touches it).
   Bezel: 60 ticks; a sweep runs round it while thinking. Inner rings: jobs (done, running, needs you), lessons (filed, waiting).
   Centre: the note count, or a live waveform while Jarvis talks or listens. */
function mindData() {
  const kinds = new Map();
  for (const n of nodes) { const k = TYPE_COLOR[n.type] ? n.type : "note"; kinds.set(k, (kinds.get(k) || 0) + 1); }
  let js = [], ls = [];
  try { js = Object.values(jobsSeen || {}); ls = lessons; } catch {} // jobs.js and memory.js may not be loaded on the first frame
  return { kinds: [...kinds.entries()].sort((a, b) => b[1] - a[1]), links: edges.length,
    done: js.filter((s) => s === "done").length, live: js.filter((s) => s === "queued" || s === "working").length, need: js.filter((s) => s === "needs-tj").length,
    filed: ls.filter((l) => l.filed).length, waiting: ls.filter((l) => !l.filed).length };
}
function coreMind(R, C, spin) {
  const d = mindData(), TAU = Math.PI * 2, top = -Math.PI / 2, talk = mode === "speaking" || mode === "listening";
  const ray = (an, a, b) => { cx.beginPath(); cx.moveTo(Math.cos(an) * a, Math.sin(an) * a); cx.lineTo(Math.cos(an) * b, Math.sin(an) * b); cx.stroke(); };
  cx.shadowBlur = 0; cx.lineCap = "butt";
  // face and hairlines
  cx.fillStyle = BG; cx.globalAlpha *= 0.82; cx.beginPath(); cx.arc(0, 0, R * 2.1, 0, TAU); cx.fill(); cx.globalAlpha /= 0.82;
  cx.strokeStyle = "rgba(255,255,255,.08)"; cx.lineWidth = 1;
  for (const r of [0.92, 1.3, 2.1]) { cx.beginPath(); cx.arc(0, 0, R * r, 0, TAU); cx.stroke(); }
  // outer ring: notes by kind, proportional
  let a = top; const total = nodes.length || 1;
  cx.lineWidth = Math.max(2.5, R * 0.065);
  for (const [k, c] of d.kinds) {
    const span = c / total * TAU;
    cx.strokeStyle = TYPE_COLOR[k] || "rgba(255,255,255,.35)";
    cx.beginPath(); cx.arc(0, 0, R * 1.97, a + 0.02, a + span - 0.02); cx.stroke();
    a += span;
  }
  // radial bars: links per note
  const maxDeg = Math.max(1, ...nodes.map((n) => n.deg)), r0 = R * 1.42;
  cx.lineWidth = Math.max(1.5, Math.min(4, TAU * r0 / Math.max(1, nodes.length) * 0.42));
  nodes.forEach((n, i) => {
    const an = top + (i + 0.5) / nodes.length * TAU + spin * 0.04, k = n.deg / maxDeg;
    const len = Math.min(R * 0.44, R * 0.4 * (0.12 + 0.88 * k) * (1 + (talk ? level * 0.8 * Math.abs(Math.sin(i * 1.7 + t * 8)) : 0)));
    cx.strokeStyle = n.hot > 0.05 ? `rgba(255,255,255,${0.55 + n.hot * 0.45})` : `rgba(${ARC},${0.22 + 0.55 * k})`;
    ray(an, r0, r0 + len);
  });
  // bezel ticks, and a sweep while thinking
  cx.strokeStyle = "rgba(255,255,255,.14)"; cx.lineWidth = 1;
  for (let i = 0; i < 60; i++) ray(i / 60 * TAU, R * 1.3, R * (i % 5 ? 1.26 : 1.22));
  if (mode === "thinking") { cx.strokeStyle = C(0.95); cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, R * 1.3, spin * 2, spin * 2 + 0.9); cx.stroke(); }
  // inner rings: jobs and lessons
  const ring = (r, parts) => {
    const sum = parts.reduce((s, [v]) => s + v, 0);
    cx.lineWidth = Math.max(2.5, R * 0.07); cx.strokeStyle = "rgba(255,255,255,.07)"; cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke();
    let b = top;
    for (const [v, c] of parts) { if (!v) continue; const s = v / sum * TAU; cx.strokeStyle = c; cx.beginPath(); cx.arc(0, 0, r, b + 0.03, b + s - 0.03); cx.stroke(); b += s; }
  };
  ring(R * 1.12, [[d.done, "#6cc59a"], [d.live, "#d9a85b"], [d.need, "#e07a6b"]]);
  ring(R * 1.0, [[d.filed, C(0.85)], [d.waiting, "#d9a85b"]]);
  // centre
  cx.textAlign = "center"; cx.textBaseline = "middle";
  if (talk) {
    cx.strokeStyle = mode === "listening" ? "#6cc59a" : C(1); cx.lineWidth = Math.max(2, R * 0.05); cx.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * R * 0.15, h = R * (0.06 + level * 0.55 * Math.abs(Math.sin(i * 1.3 + t * 9) * Math.cos(i * 0.7 - t * 5)));
      cx.beginPath(); cx.moveTo(x, -h); cx.lineTo(x, h); cx.stroke();
    }
    cx.lineCap = "butt";
  } else {
    cx.fillStyle = "rgba(236,238,240,.96)"; cx.font = `600 ${R * 0.56 | 0}px system-ui, -apple-system, Roboto, sans-serif`;
    cx.fillText(String(nodes.length), 0, -R * 0.1);
    cx.fillStyle = "rgba(149,154,162,.95)"; cx.font = `500 ${Math.max(9, R * 0.15) | 0}px system-ui, -apple-system, Roboto, sans-serif`;
    cx.fillText(mode === "thinking" ? "thinking" : "notes", 0, R * 0.36);
  }
}

function coreArc(R, C, spin) {
  // ten copper-wound coils, each with its winding lines
  cx.strokeStyle = C(0.85); cx.lineWidth = R * 0.16;
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + spin * 0.4;
    cx.beginPath(); cx.arc(0, 0, R * 0.78, a + 0.06, a + Math.PI / 5 - 0.06); cx.stroke();
  }
  cx.lineWidth = 0.8; cx.strokeStyle = "rgba(255,190,120,.45)"; cx.shadowBlur = 0;
  for (let i = 0; i < 120; i++) {
    if (i % 12 === 0 || i % 12 === 11) continue; // gaps between coils
    const a = i / 120 * Math.PI * 2 + spin * 0.4;
    cx.beginPath(); cx.moveTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7); cx.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86); cx.stroke();
  }
  cx.shadowBlur = 16;
  // the Mark VI triangle (the "new element" core), with a faint second triangle
  cx.lineWidth = 2; cx.strokeStyle = C(0.95);
  for (const [k, off, al] of [[0.5, 0, 0.95], [0.36, Math.PI, 0.35]]) {
    cx.globalAlpha = al; cx.beginPath();
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + off + i * Math.PI * 2 / 3 - spin * 0.25; cx.lineTo(Math.cos(a) * R * k, Math.sin(a) * R * k); }
    cx.closePath(); cx.stroke();
  }
  cx.globalAlpha = 1;
  // faint hex lattice behind the triangle, the element as Howard drew it
  cx.strokeStyle = C(0.18); cx.lineWidth = 0.6; cx.shadowBlur = 0;
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
    const hx = (q + r / 2) * R * 0.17, hy = r * R * 0.147; if (Math.hypot(hx, hy) > R * 0.42) continue;
    cx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; cx.lineTo(hx + Math.cos(a) * R * 0.085, hy + Math.sin(a) * R * 0.085); } cx.closePath(); cx.stroke();
  }
  cx.shadowBlur = 16;
  cx.beginPath(); cx.arc(0, 0, R * 0.22, 0, Math.PI * 2); cx.fillStyle = "rgba(240,253,255,.9)"; cx.fill();
  cx.lineWidth = 1.5; cx.strokeStyle = C(0.7);
  cx.beginPath(); cx.arc(0, 0, R, 0, Math.PI * 2); cx.stroke();
  // output readout, tiny, like the suit's diagnostics
  cx.shadowBlur = 0; cx.fillStyle = C(0.55); cx.font = `500 ${Math.max(7, R * 0.075) | 0}px 'IBM Plex Mono', monospace`;
  cx.fillText(`${(3 + level * 2.4).toFixed(2)} GJ/s`, 0, R * 0.52);
  // the new element replaced palladium, so blood toxicity reads zero
  cx.fillText("Pd TOXICITY 0.0% · NEW ELEMENT STABLE", 0, -R * 1.1);
}
function coreAgency(R, C, spin) {
  // brushed-chrome rings: a vertical gradient fakes the metal
  const g = cx.createLinearGradient(0, -R, 0, R);
  g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.45, "rgba(150,160,168,.7)"); g.addColorStop(0.55, "rgba(60,66,72,.8)"); g.addColorStop(1, "rgba(220,228,234,.9)");
  cx.shadowBlur = 0; cx.strokeStyle = g;
  for (const [k, w] of [[1, 3], [0.9, 1], [0.62, 2]]) { cx.lineWidth = w; cx.beginPath(); cx.arc(0, 0, R * k, 0, Math.PI * 2); cx.stroke(); }
  // alien script turning around the rim
  cx.strokeStyle = C(0.75); cx.lineWidth = 1.1;
  for (let i = 0; i < GLYPHS.length; i++) {
    const a = i / GLYPHS.length * Math.PI * 2 + spin * 0.15;
    cx.save(); cx.rotate(a); cx.translate(0, -R * 0.76); glyph(GLYPHS[i], R * 0.14); cx.restore();
  }
  // the galaxy on the cat's collar: a tiny two-arm spiral in the middle
  for (let i = 0; i < 140; i++) {
    const arm = i % 2, d = (i / 140) * R * 0.5, a = d / (R * 0.5) * 4.2 + arm * Math.PI + t * 0.6;
    const j = Math.sin(i * 12.9) * R * 0.025;
    cx.fillStyle = i < 20 ? "rgba(255,255,255,.95)" : `rgba(${i % 7 ? "200,220,255" : "255,200,240"},${0.85 - i / 200})`;
    cx.fillRect(Math.cos(a) * d + j, Math.sin(a) * d * 0.62 + j, 1.4, 1.4);
  }
  const core = cx.createRadialGradient(0, 0, 0, 0, 0, R * 0.14); core.addColorStop(0, "rgba(255,255,255,1)"); core.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = core; cx.beginPath(); cx.arc(0, 0, R * 0.14, 0, Math.PI * 2); cx.fill();
  // neuralyzer: a red lens at the top, and every 20 seconds a soft flash
  const ph = (t % 20) / 20, flash = ph > 0.97 ? Math.sin((ph - 0.97) / 0.03 * Math.PI) : 0;
  cx.fillStyle = `rgba(255,60,60,${0.55 + 0.45 * Math.sin(t * 3)})`; cx.shadowColor = "#ff3c3c"; cx.shadowBlur = 10;
  cx.beginPath(); cx.arc(0, -R * 1.08, R * 0.045, 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0;
  if (flash > 0) { cx.fillStyle = `rgba(255,255,255,${flash * 0.35})`; cx.beginPath(); cx.arc(0, 0, R * 3, 0, Math.PI * 2); cx.fill(); }
  cx.fillStyle = "rgba(255,120,120,.75)"; cx.font = `600 ${Math.max(7, R * 0.07) | 0}px 'IBM Plex Mono', monospace`;
  cx.fillText(flash > 0 ? "LOOK HERE" : `NEURALYZE IN ${Math.ceil(20 - t % 20)}s`, 0, -R * 1.16);
  // unregistered alien activity: blips ping on the galaxy, logged with a case number
  const k = Math.floor(t / 3), bp = (t % 3) / 3, br = rng(k + 11);
  const bx = (br() - 0.5) * R * 0.8, by = (br() - 0.5) * R * 0.5;
  cx.strokeStyle = `rgba(120,255,170,${(1 - bp) * 0.9})`; cx.lineWidth = 1;
  cx.beginPath(); cx.arc(bx, by, 2 + bp * R * 0.12, 0, Math.PI * 2); cx.stroke();
  cx.fillStyle = `rgba(120,255,170,${(1 - bp) * 0.8})`; cx.font = `500 ${Math.max(6, R * 0.06) | 0}px 'IBM Plex Mono', monospace`;
  cx.fillText(`CASE ${String(4000 + (k * 37) % 997)}`, bx, by - 6 - bp * R * 0.12);
}
function coreSpy(R, C, spin) {
  // gun barrel: dark bore with six spiral rifling grooves
  const bore = cx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
  bore.addColorStop(0, "rgba(0,0,0,.95)"); bore.addColorStop(0.7, "rgba(20,16,10,.9)"); bore.addColorStop(1, "rgba(60,48,30,.85)");
  cx.shadowBlur = 0; cx.fillStyle = bore; cx.beginPath(); cx.arc(0, 0, R, 0, Math.PI * 2); cx.fill();
  cx.strokeStyle = "rgba(216,176,74,.45)"; cx.lineWidth = 1.2;
  for (let g = 0; g < 6; g++) {
    cx.beginPath();
    for (let s = 0; s <= 30; s++) { const d = R * (0.22 + s / 30 * 0.78), a = g / 6 * Math.PI * 2 + s / 30 * 1.6 + spin * 0.5; cx.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    cx.stroke();
  }
  for (const k of [0.4, 0.6, 0.8]) { cx.strokeStyle = `rgba(216,176,74,${0.08 + k * 0.1})`; cx.beginPath(); cx.arc(0, 0, R * k, 0, Math.PI * 2); cx.stroke(); }
  // the white aperture that tracks you, breathing with his voice
  const ap = R * (0.15 + level * 0.06), jx = Math.sin(t * 0.7) * R * 0.04, jy = Math.cos(t * 0.5) * R * 0.03;
  const w = cx.createRadialGradient(jx, jy, 0, jx, jy, ap * 1.6); w.addColorStop(0, "rgba(255,250,235,1)"); w.addColorStop(0.6, "rgba(255,245,220,.9)"); w.addColorStop(1, "rgba(255,240,210,0)");
  cx.fillStyle = w; cx.beginPath(); cx.arc(jx, jy, ap * 1.6, 0, Math.PI * 2); cx.fill();
  // roulette wheel (single zero, the casino royale kind) with the ball riding the track
  const n = WHEEL.length, r1 = R * 1.1, r2 = R * 1.36, rot = -spin * 0.2;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rot, v = WHEEL[i];
    cx.fillStyle = v === 0 ? "rgba(30,140,70,.8)" : RED.has(v) ? "rgba(196,48,58,.75)" : "rgba(14,10,6,.9)";
    cx.beginPath(); cx.arc(0, 0, r2, a, a + Math.PI * 2 / n); cx.arc(0, 0, r1, a + Math.PI * 2 / n, a, true); cx.closePath(); cx.fill();
  }
  cx.strokeStyle = "rgba(216,176,74,.8)"; cx.lineWidth = 1;
  for (const r of [r1, r2]) { cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.stroke(); }
  if (R > 40) {
    cx.fillStyle = "rgba(245,234,210,.85)"; cx.font = `600 ${Math.max(6, R * 0.075) | 0}px 'IBM Plex Mono', monospace`;
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2 + rot; cx.save(); cx.rotate(a + Math.PI / 2); cx.fillText(String(WHEEL[i]), 0, -(r1 + r2) / 2 + R * 0.03); cx.restore(); }
  }
  // every 15 seconds a laser creeps across the bore ("No, I expect you to die")
  const lp = (t % 15) / 15;
  if (lp < 0.25) {
    const lx = -R * 0.9 + lp / 0.25 * R * 1.8, half = Math.sqrt(Math.max(0, R * R * 0.81 - lx * lx));
    cx.strokeStyle = "rgba(255,40,40,.85)"; cx.shadowColor = "#ff2828"; cx.shadowBlur = 10; cx.lineWidth = 1.4;
    cx.beginPath(); cx.moveTo(lx, -half); cx.lineTo(lx, half); cx.stroke(); cx.shadowBlur = 0;
  }
  cx.fillStyle = "rgba(216,176,74,.7)"; cx.font = `600 ${Math.max(7, R * 0.07) | 0}px 'IBM Plex Mono', monospace`;
  cx.fillText("00 SECTION · LICENCE ISSUED", 0, R * 1.52);
  const ba = t * 1.3; cx.fillStyle = "#fff"; cx.shadowColor = "#fff"; cx.shadowBlur = 6;
  cx.beginPath(); cx.arc(Math.cos(ba) * R * 1.43, Math.sin(ba) * R * 1.43, R * 0.035, 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0;
}
function coreHunter(R, C, spin) {
  // the lights flicker now and then: something's here
  if ((t % 9) < 0.35 && Math.sin(t * 90) > 0) cx.globalAlpha = 0.35;
  // devil's trap: double ring, pentagram, sigils between the rings
  const turn = spin * 0.05;
  cx.save(); cx.rotate(turn);
  cx.shadowBlur = 12; cx.strokeStyle = C(0.9); cx.lineWidth = 2;
  for (const k of [1, 0.84]) { cx.beginPath(); cx.arc(0, 0, R * k, 0, Math.PI * 2); cx.stroke(); }
  cx.lineWidth = 1.6; cx.beginPath();
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; cx.lineTo(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84); }
  cx.stroke();
  cx.shadowBlur = 0; cx.strokeStyle = C(0.7); cx.lineWidth = 1;
  for (let i = 0; i < 15; i++) { const a = i / 15 * Math.PI * 2; cx.save(); cx.rotate(a); cx.translate(0, -R * 0.92); glyph(GLYPHS[i], R * 0.09); cx.restore(); }
  cx.restore(); cx.shadowBlur = 0; // blur on hundreds of grains would cost frames
  // the anti-possession sun in the middle
  cx.strokeStyle = C(0.85); cx.lineWidth = 1.2;
  cx.beginPath(); cx.arc(0, 0, R * 0.16, 0, Math.PI * 2); cx.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + turn * 2, r = i % 2 ? 0.26 : 0.32; cx.beginPath(); cx.moveTo(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18); cx.lineTo(Math.cos(a) * R * r, Math.sin(a) * R * r); cx.stroke(); }
  // a salt line, grain by grain
  // when the EMF climbs, something breaks the salt line, and the lights flicker
  const emfNow = level * 6, gap = emfNow > 3 ? 0.5 : 0, gapAt = -Math.PI / 4;
  for (const [a, u, v] of SALT) {
    if (gap && Math.abs(Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt))) < gap) continue;
    cx.fillStyle = `rgba(255,248,235,${0.25 + v * 0.5})`; const d = R * (1.12 + u * 0.08); cx.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.1, 1.1);
  }
  // EMF meter: five bars that spike when he speaks
  const emf = Math.min(5, Math.round(1 + level * 6 + Math.max(0, Math.sin(t * 0.9)) * (mode === "idle" ? 0.6 : 0)));
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i - 2) * 0.13;
    cx.strokeStyle = i < emf ? (i > 2 ? "rgba(255,80,60,.95)" : C(0.95)) : "rgba(255,255,255,.12)"; cx.lineWidth = R * 0.05;
    cx.beginPath(); cx.arc(0, 0, R * 1.3, a - 0.05, a + 0.05); cx.stroke();
  }
  cx.fillStyle = C(0.6); cx.font = `600 ${Math.max(7, R * 0.07) | 0}px 'IBM Plex Mono', monospace`; cx.fillText("EMF", 0, R * 1.46);
  // embers rising off the trap
  for (let i = 0; i < 26; i++) {
    const life = (t * 0.12 + i * 0.137) % 1, x = Math.sin(i * 7.1 + t * 0.4) * R * 0.9, y = R * 0.6 - life * R * 2.4;
    cx.fillStyle = `rgba(255,${140 + (i % 5) * 20},60,${(1 - life) * 0.8})`; cx.fillRect(x, y, 1.6, 1.6);
  }
  cx.globalAlpha = 1;
}

