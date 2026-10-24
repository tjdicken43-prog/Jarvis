/* ---------- Show off: every Jarvis system on screen at once ---------- */
// Iridescent colour that drifts cyan to violet to magenta, a 5D hypercube cage around the brain, a warp
// starfield, a scan plane, Jarvis's systems orbiting the core with live numbers, and a guided tour of every note.
const HUE = Array.from({ length: 360 }, (_, h) => { // hsl(h, 100%, 68%) as "r,g,b"
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (0.68 - 0.32 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return `${f(0)},${f(8)},${f(4)}`;
});
const hue = (h) => HUE[(((h | 0) % 360) + 360) % 360];
const SHOW = () => THEME === "showoff";
edges.forEach((e, i) => { e.h = 175 + (i * 37) % 150; });

// 5D: a penteract (32 corners, 80 edges) turning in five planes, folded 5D to 4D to 3D
const PV = [], PE = [];
for (let i = 0; i < 32; i++) PV.push([0, 1, 2, 3, 4].map((b) => (i >> b & 1 ? 1 : -1)));
for (let i = 0; i < 32; i++) for (let b = 0; b < 5; b++) { const j = i ^ (1 << b); if (j > i) PE.push([i, j, b]); }
const PLANES = [[0, 4, 0.23], [1, 3, 0.17], [2, 4, 0.11], [3, 4, 0.29], [0, 2, 0.07]];
function penteract(time) {
  return PV.map((v0) => {
    const v = [...v0];
    for (const [a, b, sp] of PLANES) { const c = Math.cos(time * sp), s = Math.sin(time * sp); [v[a], v[b]] = [v[a] * c - v[b] * s, v[a] * s + v[b] * c]; }
    const k5 = 2.2 / (3.4 - v[4]), w = v[3] * k5, k4 = 1.7 / (3.2 - w) * k5 * 0.62;
    return [v[0] * k4, v[1] * k4, v[2] * k4, v[4]];
  });
}

// warp starfield: streaks fly out of the core, faster when he talks or thinks
const STARS = Array.from({ length: 170 }, (_, i) => { const r = rng(300 + i); return { x: r() * 2 - 1, y: r() * 2 - 1, z: 0.05 + r() * 0.95 }; });
function warp(ox, oy) {
  const sp = 0.0022 + warpBoost + level * 0.012 + (mode === "thinking" ? 0.01 : 0);
  cx.lineCap = "round";
  for (let i = 0; i < STARS.length; i += lowPower ? 2 : 1) {
    const s = STARS[i], z0 = s.z; s.z -= sp;
    const X = ox + s.x * W * 0.25 / s.z, Y = oy + s.y * H * 0.25 / s.z;
    if (s.z <= 0.03 || X < -20 || X > W + 20 || Y < -20 || Y > H + 20) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; continue; }
    const X0 = ox + s.x * W * 0.25 / z0, Y0 = oy + s.y * H * 0.25 / z0, near = 1 - s.z;
    cx.strokeStyle = `rgba(${hue(200 + s.x * 90)},${Math.min(0.85, near * 0.95)})`; cx.lineWidth = 0.4 + near * 1.6;
    cx.beginPath(); cx.moveTo(X0, Y0); cx.lineTo(X, Y); cx.stroke();
  }
  cx.lineCap = "butt";
}
function drawPenteract() {
  const pv = penteract(t).map(([x, y, z, v]) => [...view(x, y, z), v]);
  cx.lineWidth = 0.8;
  for (const [i, j, axis] of PE) {
    const a = pv[i], b = pv[j], vv = (a[4] + b[4]) / 2, za = (a[2] + b[2]) / 2;
    cx.strokeStyle = `rgba(${hue(200 + axis * 30 + t * 8)},${(0.1 + (vv + 1) * 0.09) * Math.max(0.35, 1 - za * 0.4)})`;
    cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
  }
  for (const v of pv) { cx.fillStyle = `rgba(${hue(290 + v[4] * 40)},${0.4 + (v[4] + 1) * 0.25})`; cx.fillRect(v[0] - 1.5, v[1] - 1.5, 3, 3); }
}
// a scan plane sweeps the brain top to bottom; notes it crosses light up
function scanPlane() {
  const ys = Math.sin(t * 0.37) * 0.95, rr = Math.sqrt(1 - ys * ys) * 1.05;
  cx.strokeStyle = `rgba(${hue(185 + t * 10)},.4)`; cx.lineWidth = 1; cx.beginPath();
  for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, [x, y] = view(Math.cos(a) * rr, ys, Math.sin(a) * rr); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }
  cx.stroke();
  for (const n of nodes) if (Math.abs(n.y - ys) < 0.07) n.hot = Math.max(n.hot, 0.4);
}

// Jarvis's systems, orbiting the core with their live numbers
const showStats = { chats: null };
const SYSTEMS = [
  { key: "voice", name: () => "VOICE · " + ($("voice").value || "builtin:butler").replace("builtin:", "").toUpperCase(),
    text: "Five built-in voices, made right on the phone. No cloud voice, no bill." },
  { key: "memory", name: () => `MEMORY · ${lessons.length} LESSON${lessons.length === 1 ? "" : "S"}`,
    text: "Everything you tell me is saved, then filed into the notes by Jarvis backend." },
  { key: "chats", name: () => `CHATS · ${showStats.chats ?? "…"} SAVED`,
    text: "Every conversation kept, on every device. CHATS reopens any of them." },
  { key: "jobs", name: () => { const v = Object.values(jobsSeen || {}); return `JOBS · ${v.filter((s) => s === "queued" || s === "working").length} LIVE · ${v.length} RUN`; },
    text: "Big asks go to Jarvis backend in the cloud: code, research, PRs. Answers land here." },
  { key: "brain", name: () => `BRAIN · ${nodes.length} NOTES · ${edges.length} LINKS`,
    text: "Every note a star, every link a nerve. The pulses are me thinking." },
  { key: "dims", name: () => "4D TESSERACT · 5D PENTERACT",
    text: "A hypercube turning through the 4th dimension, caged in one turning through the 5th." },
];
function satellites(ox, oy) {
  cx.font = "600 9px 'IBM Plex Mono', monospace"; cx.textAlign = "center";
  SYSTEMS.forEach((s, i) => {
    const a = t * 0.16 + i * Math.PI * 2 / SYSTEMS.length;
    const [x, y, z, f] = view(Math.cos(a) * 1.32, Math.sin(a * 2 + i) * 0.22 - 0.05, Math.sin(a) * 1.32);
    const on = tour.sys === s.key && t - tour.at < 6, al = Math.max(0.25, Math.min(1, 0.9 - z * 0.5)) * Math.min(1, boot * 1.6), c = hue(200 + i * 25 + t * 6);
    // data link: a beam to the core with packets riding it
    cx.strokeStyle = `rgba(${c},${(on ? 0.5 : 0.14) * al})`; cx.lineWidth = on ? 1.4 : 0.8;
    cx.beginPath(); cx.moveTo(ox, oy); cx.lineTo(x, y); cx.stroke();
    for (let k = 0; k < 2; k++) { const u = (t * 0.5 + i * 0.17 + k * 0.5) % 1; cx.fillStyle = `rgba(${c},${0.8 * al})`; cx.fillRect(ox + (x - ox) * u - 1.2, oy + (y - oy) * u - 1.2, 2.4, 2.4); }
    const r = (on ? 7 : 4.5) * f;
    cx.globalAlpha = al; cx.fillStyle = `rgb(${c})`; cx.beginPath(); cx.moveTo(x, y - r); cx.lineTo(x + r, y); cx.lineTo(x, y + r); cx.lineTo(x - r, y); cx.closePath(); cx.fill();
    cx.strokeStyle = `rgba(${c},.8)`; cx.lineWidth = 1; cx.beginPath(); cx.arc(x, y, r + 4 + Math.sin(t * 3 + i) * 1.5, 0, Math.PI * 2); cx.stroke();
    if (on || (cinemaK > 0.9 && z < 0)) {
      const label = s.name(), w = cx.measureText(label).width + 10, lx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
      cx.fillStyle = "rgba(2,1,8,.75)"; cx.fillRect(lx - w / 2, y + r + 5, w, 13); cx.fillStyle = on ? "#fff" : `rgba(${c},.95)`; cx.fillText(label, lx, y + r + 15);
    }
    cx.globalAlpha = 1;
  });
}

// the guided tour: when you leave it alone, Jarvis walks through every system, then every note
const tour = { i: -1, at: -99, shock: -99, cap: null, sys: null };
let lastInput = 0, capBox = null; // the controls stay up for the first few seconds after opening
cv.addEventListener("pointerdown", () => { wokeFromCinema = cinema; lastInput = t; runCinema(); }, { passive: true });
addEventListener("wheel", () => { lastInput = t; }, { passive: true });
function firstLine(md) {
  const l = md.replace(/^---[\s\S]*?---\s*/, "").split("\n").map((x) => x.trim()).find((x) => x && !x.startsWith("#")) || "";
  return l.replace(/^[-*] (\[[ x]\] )?/, "").replace(/\[\[|\]\]|\*\*|`/g, "");
}
let cinema = false, wokeFromCinema = false;
addEventListener("keydown", () => { lastInput = t; });
function runCinema() {
  const want = SHOW() && t - lastInput > 14 && (mode === "idle" || demo) && !$("card").classList.contains("show") && !document.querySelector("dialog[open]") && !reduce;
  if (want !== cinema) { cinema = want; document.body.classList.toggle("cinema", want); uiAt = -1; }
  cinemaK += ((cinema ? 1 : 0) - cinemaK) * 0.03;
}
function runTour() {
  const busy = t - lastInput < 9 || $("card").classList.contains("show") || mode !== "idle" || boot < 1;
  if (!busy) cam.zoom += ((tour.sys ? 0.92 : 1.18) - cam.zoom) * 0.02;
  if (busy || t - tour.at < 6.5) return;
  const order = [...nodes].sort((a, b) => b.deg - a.deg), total = SYSTEMS.length + order.length;
  tour.i = (tour.i + 1) % total; tour.at = t; tour.shock = t;
  if (tour.i < SYSTEMS.length) {
    const s = SYSTEMS[tour.i]; focus = null; tour.sys = s.key;
    tour.cap = { tag: `SYSTEM ${tour.i + 1} OF ${SYSTEMS.length}`, title: s.name(), line: s.text };
  } else {
    const n = order[tour.i - SYSTEMS.length]; tour.sys = null; focus = n; light([n.name]);
    cam.go = [Math.atan2(n.x, -n.z), Math.max(-1.2, Math.min(1.2, Math.atan2(-n.y, Math.hypot(n.x, n.z))))];
    tour.cap = { tag: `NOTE ${tour.i - SYSTEMS.length + 1} OF ${order.length} · ${(n.type || "note").toUpperCase()} · ${n.deg} LINKS`, title: n.name.toUpperCase(), line: firstLine(n.text) };
  }
}
function shockwave(ox, oy, R) {
  const k = (t - tour.shock) / 1.3; if (k < 0 || k > 1) return;
  cx.strokeStyle = `rgba(${hue(280 + k * 60)},${(1 - k) * 0.6})`; cx.lineWidth = 2 * (1 - k) + 0.5;
  cx.beginPath(); cx.arc(ox, oy, R * (1.2 + k * 5), 0, Math.PI * 2); cx.stroke();
}
function caption(ox, oy, R) {
  capBox = null;
  const c = tour.cap; if (!c || t - tour.at > 6.2 || t - lastInput < 9) return;
  const age = t - tour.at, fade = Math.min(1, age * 3, (6.2 - age) * 2), w = Math.min(W - 24, 360), x0 = ox - w / 2;
  const st = $("status").getBoundingClientRect();
  let y0 = cinemaK > 0.5 ? H - 96 : st.top - 70;
  capBox = [x0, y0, x0 + w, y0 + 60];
  cx.globalAlpha = fade;
  cx.fillStyle = "rgba(4,2,14,.78)"; cx.fillRect(x0, y0, w, 60);
  cx.fillStyle = `rgb(${hue(190 + t * 20)})`; cx.fillRect(x0, y0, Math.min(1, age / 6) * w, 1.5); // progress to the next stop
  cx.textAlign = "left";
  cx.fillStyle = `rgba(${hue(300)},.9)`; cx.font = "500 8.5px 'IBM Plex Mono', monospace"; cx.fillText(c.tag, x0 + 10, y0 + 14);
  cx.fillStyle = "#fff"; cx.font = "600 14px 'Chakra Petch', sans-serif"; cx.fillText(c.title, x0 + 10, y0 + 31);
  cx.fillStyle = "rgba(226,220,255,.9)"; cx.font = "400 11.5px 'IBM Plex Sans', sans-serif";
  let line = c.line.slice(0, Math.floor(age * 50)); // typed out
  while (line && cx.measureText(line).width > w - 20) line = line.slice(0, -2);
  if (line.length < c.line.length && age * 50 > c.line.length) line = line.replace(/\s*\S*$/, "…");
  cx.fillText(line, x0 + 10, y0 + 49);
  cx.globalAlpha = 1; cx.textAlign = "center";
  if (cinemaK > 0.9) { cx.fillStyle = `rgba(${ARC},${0.35 + 0.25 * Math.sin(t * 2)})`; cx.font = "500 9px 'IBM Plex Mono', monospace"; cx.fillText("TAP ANYWHERE FOR THE CONTROLS", W / 2, H - 22); }
}
const glowCv = document.createElement("canvas"), glow = glowCv.getContext("2d");
function bloom() {
  const gw = Math.max(1, (W / 10) | 0), gh = Math.max(1, (H / 10) | 0);
  if (glowCv.width !== gw || glowCv.height !== gh) { glowCv.width = gw; glowCv.height = gh; }
  if (!(frame & 1)) { glow.clearRect(0, 0, gw, gh); glow.drawImage(cv, 0, 0, gw, gh); } // every other frame is plenty for a glow
  cx.save(); cx.globalCompositeOperation = "lighter"; cx.globalAlpha = 0.55; cx.imageSmoothingEnabled = true;
  cx.drawImage(glowCv, 0, 0, W, H); cx.restore();
}
function coreShow(R, C, spin) {
  // gimbal: three rings tilting through 3D around the core
  cx.shadowBlur = 0;
  for (let k = 0; k < 3; k++) {
    cx.save(); cx.rotate(k * Math.PI / 3 + spin * 0.35);
    const sq = Math.abs(Math.cos(t * 0.6 + k * 2.1)) * 0.92 + 0.08;
    cx.strokeStyle = `rgba(${hue(200 + k * 45 + t * 15)},.85)`; cx.lineWidth = 1.6;
    cx.beginPath(); cx.ellipse(0, 0, R * 1.08, R * 1.08 * sq, 0, 0, Math.PI * 2); cx.stroke();
    const ea = t * (1.4 + k * 0.4); // an electron riding each ring
    cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(Math.cos(ea) * R * 1.08, Math.sin(ea) * R * 1.08 * sq, 2.2, 0, Math.PI * 2); cx.fill();
    cx.restore();
  }
  // twelve-cell reactor ring
  cx.lineWidth = R * 0.11;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 - spin * 0.5;
    cx.strokeStyle = `rgba(${hue(250 + i * 8 + t * 25)},${0.55 + 0.35 * Math.sin(t * 2 + i)})`;
    cx.beginPath(); cx.arc(0, 0, R * 0.74, a + 0.05, a + Math.PI / 6 - 0.05); cx.stroke();
  }
  // hex shield, slowly counter-turning
  cx.lineWidth = 0.8; cx.strokeStyle = C(0.35);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + spin * 0.2, hx = Math.cos(a) * R * 0.45, hy = Math.sin(a) * R * 0.45;
    cx.beginPath(); for (let j = 0; j < 6; j++) { const b = j * Math.PI / 3 + a; cx.lineTo(hx + Math.cos(b) * R * 0.17, hy + Math.sin(b) * R * 0.17); } cx.closePath(); cx.stroke();
  }
  // the element triangle and a white-hot plasma heart
  cx.lineWidth = 2; cx.strokeStyle = "rgba(255,255,255,.9)"; cx.beginPath();
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3 + spin * 0.3; cx.lineTo(Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36); }
  cx.closePath(); cx.stroke();
  const p = cx.createRadialGradient(0, 0, 0, 0, 0, R * 0.3);
  p.addColorStop(0, "rgba(255,255,255,1)"); p.addColorStop(0.45, `rgba(${hue(300 + t * 30)},.85)`); p.addColorStop(1, `rgba(${hue(200)},0)`);
  cx.fillStyle = p; cx.beginPath(); cx.arc(0, 0, R * 0.3 * (1 + level * 0.25), 0, Math.PI * 2); cx.fill();
}
function loadShowStats() {
  dbPromise.then(async (db) => { if (!db) return; try { const q = await db.collection("chats").orderBy("started", "desc").limit(500).get(); showStats.chats = q.docs.length; } catch {} });
}

/* ---------- Show off flight: into the brain, past the factory, to the core ---------- */
// In cinema the camera flies through the shell of notes, parks at the factory gate (the live Sites by TJ floor from
// factory.js, wired to the core), then finishes at the core.
const FK = 6; // the brain's radius in flight space
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u],
};
const ease = (u) => u * u * (3 - 2 * u);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const jobCounts = () => { const v = Object.values(jobsSeen || {}); return [v.filter((s) => s === "queued" || s === "working").length, v.filter((s) => s === "done").length]; };
// The factory gate: the Sites by TJ factory floats inside the brain, live, wired to the core (hud/factory.js)
const GATE = { pos: [2.4, 0.3, 1.6], r: 0.85, rect: null };
const factoryLine = () => { const s = window.JarvisFactory?.status?.() || {}; return `${plural(s.working || 0, "worker")} busy, ${plural(s.rail || 0, "job")} on the rail. Tap the gate to walk in.`; };
{ const o = V.norm(GATE.pos); GATE.stop = { p: V.add(GATE.pos, V.add(V.mul(o, 1.8), [0, 0.15, 0])), l: GATE.pos, hold: 14, gate: true,
  cap: () => ({ tag: "THE FACTORY · SITES BY TJ", title: "THE FACTORY", line: factoryLine() }) }; }
const FSTOPS = [
  { p: [0, 2, -15], l: [0, 0, 0], hold: 2.6, cap: () => ({ tag: "LIVE DEMO · FLYING IN", title: `THE BRAIN · ${nodes.length} NOTES`, line: "Every star a note, every line a link. Going in." }) },
  GATE.stop,
  { p: [0, 0.8, -2.6], l: [0, 0, 0], hold: 5, cap: () => { const [l, d] = jobCounts(); return { tag: "THE CENTRE", title: "JARVIS CORE", line: `${nodes.length} notes, ${edges.length} links, ${plural(l, "job")} live, ${d} done. This is me thinking.` }; } },
];
const TRAVEL = 3.6;
function orbitAround(p, l, a) { const d = V.sub(p, l), c = Math.cos(a), s = Math.sin(a); return V.add(l, [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c]); }
function flightPose(ft) {
  const period = FSTOPS.reduce((a, s) => a + s.hold + TRAVEL, 0);
  let x = ft % period, k = 0;
  while (x > FSTOPS[k].hold + TRAVEL) { x -= FSTOPS[k].hold + TRAVEL; k++; }
  const A = FSTOPS[k], B = FSTOPS[(k + 1) % FSTOPS.length];
  if (x < A.hold) return { p: orbitAround(A.p, A.l, Math.sin(x / A.hold * Math.PI - Math.PI / 2) * 0.18), l: A.l, k, moving: false };
  const raw = (x - A.hold) / TRAVEL, u = ease(raw), ul = ease(Math.min(1, raw * 1.3)); // the eyes turn a moment before the body
  const p = V.lerp(orbitAround(A.p, A.l, 0.18), orbitAround(B.p, B.l, -0.18), u);
  return { p: V.add(p, [0, Math.sin(raw * Math.PI) * 1.4, 0]), l: V.lerp(A.l, B.l, ul), k, moving: true };
}
function lookAt(p, l, fl) {
  const F = V.norm(V.sub(l, p)), R = V.norm(V.cross([0, 1, 0], F)), U = V.cross(F, R);
  return (X) => { const d = V.sub(X, p), z = V.dot(d, F); if (z < 0.06) return null; const s = fl / z; return [W / 2 + V.dot(d, R) * s, H / 2 - V.dot(d, U) * s, z, s]; };
}

// The gate: an octagon portal showing the live factory floor, drawn facing the camera
function octPath(x, y, hw, hh, cut) { cx.beginPath(); cx.moveTo(x - hw + cut, y - hh); cx.lineTo(x + hw - cut, y - hh); cx.lineTo(x + hw, y - hh + cut); cx.lineTo(x + hw, y + hh - cut); cx.lineTo(x + hw - cut, y + hh); cx.lineTo(x - hw + cut, y + hh); cx.lineTo(x - hw, y + hh - cut); cx.lineTo(x - hw, y - hh + cut); cx.closePath(); }
function drawGate(q, core) {
  const [x, y, , s] = q, hw = GATE.r * s, F = window.JarvisFactory, hh = hw * (F?.ASPECT || 340 / 480), cut = hw * 0.16;
  if (x + hw < 0 || x - hw > W || y + hh < 0 || y - hh > H) { GATE.rect = null; return; }
  if (core) { // a fat conduit from the core feeds the factory
    cx.strokeStyle = `rgba(${ARC},.25)`; cx.lineWidth = Math.max(1, s * 0.02); cx.beginPath(); cx.moveTo(core[0], core[1]); cx.lineTo(x, y); cx.stroke();
    for (let k = 0; k < 5; k++) { const u = (t * 0.4 + k / 5) % 1; cx.fillStyle = `rgba(${hue(170 + k * 30)},.95)`; cx.fillRect(core[0] + (x - core[0]) * u - 2, core[1] + (y - core[1]) * u - 2, 4, 4); }
  }
  const halo = cx.createRadialGradient(x, y, hw * 0.6, x, y, hw * 1.5);
  halo.addColorStop(0, "rgba(63,242,208,.22)"); halo.addColorStop(1, "rgba(63,242,208,0)");
  cx.fillStyle = halo; cx.fillRect(x - hw * 1.5, y - hw * 1.5, hw * 3, hw * 3);
  cx.save(); octPath(x, y, hw, hh, cut); cx.clip();
  cx.fillStyle = "#020106"; cx.fillRect(x - hw, y - hh, hw * 2, hh * 2);
  if (F && hw > 30) { cx.drawImage(F.tick(), x - hw, y - hh, hw * 2, hh * 2); }
  const sweep = ((t * 0.35) % 1.4 - 0.2) * hh * 2; // a scan line rolls down the portal
  cx.fillStyle = "rgba(159,232,255,.08)"; cx.fillRect(x - hw, y - hh + sweep, hw * 2, hh * 0.12);
  cx.restore();
  // the frame: thick alien metal, gold corner lights, a rotating dash ring
  cx.lineWidth = Math.max(2, hw * 0.035); cx.strokeStyle = "#2c3a4e"; octPath(x, y, hw, hh, cut); cx.stroke();
  cx.lineWidth = Math.max(1, hw * 0.01); cx.strokeStyle = `rgba(${hue(170 + Math.sin(t) * 20)},.9)`; octPath(x, y, hw + hw * 0.03, hh + hw * 0.03, cut); cx.stroke();
  cx.setLineDash([hw * 0.05, hw * 0.07]); cx.lineDashOffset = -t * hw * 0.2; cx.strokeStyle = "rgba(255,211,74,.65)"; octPath(x, y, hw * 1.08, hh + hw * 0.08, cut * 1.2); cx.stroke(); cx.setLineDash([]);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { cx.fillStyle = `rgba(255,211,74,${0.5 + 0.5 * Math.sin(t * 3 + sx + sy * 2)})`; cx.fillRect(x + sx * (hw - cut * 0.5) - 3, y + sy * (hh - cut * 0.5) - 3, 6, 6); }
  if (hw > 40) {
    cx.font = `600 ${Math.max(11, Math.min(16, hw * 0.06))}px 'Chakra Petch', sans-serif`; cx.textAlign = "center"; cx.fillStyle = "#ffd34a";
    cx.fillText("THE FACTORY · TAP TO ENTER", x, y - hh - hw * 0.11);
  }
  GATE.rect = [x - hw, y - hh, x + hw, y + hh, t];
}

// SHOW ME OFF: Jarvis flies guests through the brain and the factory and narrates each stop out loud, once round
let demo = false, demoSaid = new Set();
const DEMO_LINES = [
  () => `Welcome inside my brain. Every star out there is one of TJ's notes, ${nodes.length} of them. Let's fly in.`,
  () => "This is the factory. My crew finds local businesses with bad websites, builds them a better one, and writes the email. Nothing goes out until TJ taps approve on his throne.",
  () => "And this is my core, wired to every station in the factory. Thanks for visiting. Tap anywhere when you're done.",
];
const flight = { on: false, t0: 0, k: -1, flash: 0, inside: null, lastP: null };
let warpBoost = 0;
function drawFlight() {
  const pose = flightPose(t - flight.t0), fl = Math.min(W, H) * 0.95, P = lookAt(pose.p, pose.l, fl);
  if (flight.lastP) warpBoost = Math.min(0.035, Math.hypot(...V.sub(pose.p, flight.lastP)) * 0.3);
  flight.lastP = pose.p;
  const inside = Math.hypot(...pose.p) < FK; // punching through the shell of notes flashes the screen
  if (flight.inside !== null && inside !== flight.inside) flight.flash = 1;
  flight.inside = inside; flight.flash *= 0.93;
  if (!pose.moving && pose.k !== flight.k) {
    flight.k = pose.k; tour.cap = FSTOPS[pose.k].cap(); tour.at = t; tour.shock = t;
    if (demo && !demoSaid.has(pose.k)) { demoSaid.add(pose.k); speak(DEMO_LINES[pose.k](), true); }
  }
  cx.clearRect(0, 0, W, H);
  warp(W / 2, H / 2);
  for (const n of nodes) n.fp = P([n.x * FK, n.y * FK, n.z * FK]);
  cx.lineWidth = 1;
  for (const e of edges) {
    const a = e[0].fp, b = e[1].fp; if (!a || !b) continue;
    const near = Math.min(1, 9 / ((a[2] + b[2]) / 2)), ec = hue(e.h + t * 12);
    cx.strokeStyle = `rgba(${ec},${0.08 + near * 0.3})`; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
    const u = (t * 0.22 + e.seed) % 1; cx.fillStyle = `rgba(${ec},${0.9 * Math.sin(u * Math.PI) * near})`;
    cx.fillRect(a[0] + (b[0] - a[0]) * u - 1.5, a[1] + (b[1] - a[1]) * u - 1.5, 3, 3);
  }
  const C = (al) => `rgba(${ARC},${al})`, core = P([0, 0, 0]);
  cx.font = "600 12px 'Chakra Petch', sans-serif"; cx.textAlign = "center";
  for (const n of [...nodes].filter((n) => n.fp).sort((a, b) => b.fp[2] - a.fp[2])) {
    const [x, y, , s] = n.fp, r = Math.min(46, Math.max(1.5, 0.11 * s)), c = nodeColor(n);
    if (x < -r * 3 || x > W + r * 3 || y < -r * 3 || y > H + r * 3) continue;
    cx.globalAlpha = 1; orb(x, y, r, c, n, 0.22);
    if (r > 4.5 && r < 40 && y > 130 && (pose.moving || !FSTOPS[pose.k].gate)) { cx.fillStyle = "rgba(235,246,255,.9)"; cx.fillText(n.name, x, y - r - 6); }
  }
  // the core
  if (core) {
    const Rc = 0.42 * core[3];
    if (Rc < W * 2) {
      const g = cx.createRadialGradient(core[0], core[1], 0, core[0], core[1], Rc * 3);
      g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.15, C(0.6)); g.addColorStop(1, C(0));
      cx.fillStyle = g; cx.beginPath(); cx.arc(core[0], core[1], Rc * 3, 0, Math.PI * 2); cx.fill();
      cx.save(); cx.translate(core[0], core[1]); coreShow(Rc, C, t * 0.18); cx.restore();
    }
  }
  // the factory gate, live
  { const q = P(GATE.pos); if (q) drawGate(q, core); else GATE.rect = null; }
  if (!lowPower) bloom();
  const fade = Math.max(0, 1 - (t - flight.t0) / 1.2); // fade in from black when the flight starts
  if (fade > 0 || flight.flash > 0.02) { cx.fillStyle = fade > 0 ? `rgba(2,1,8,${fade})` : `rgba(${hue(200 + t * 20)},${flight.flash * 0.55})`; cx.fillRect(0, 0, W, H); }
  const top = Math.min(110, H * 0.13);
  cx.fillStyle = cached(`vt${BG}${top}`, () => { const g = cx.createLinearGradient(0, 0, 0, top); g.addColorStop(0, BG); g.addColorStop(1, BG + "00"); return g; });
  cx.fillRect(0, 0, W, top);
  caption(W / 2, H / 2, 0);
}

