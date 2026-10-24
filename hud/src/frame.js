const CORES = { arc: coreArc, agency: coreAgency, spy: coreSpy, hunter: coreHunter, showoff: coreShow }; // coreShow lives in showoff.js
/* ---------- Frame ---------- */
function nodeColor(n) { return n.type === "hub" || !TYPE_COLOR[n.type] ? `rgb(${ARC})` : TYPE_COLOR[n.type]; }
// Each note is a little lit planet: shaded sphere, a ring if it's a hub, one moon per section (## heading),
// and a gold factory ring on the notes that open the factory.
const rgbOf = (() => { const m = new Map(); return (c) => { if (!m.has(c)) { const h = c[0] === "#" ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/\d+/g).map(Number); m.set(c, h); } return m.get(c); }; })();
function orb(x, y, r, c, n, glowA) {
  const [R0, G0, B0] = rgbOf(c), mix = (k) => k > 0 ? `rgb(${R0 + (255 - R0) * k | 0},${G0 + (255 - G0) * k | 0},${B0 + (255 - B0) * k | 0})` : `rgb(${R0 * (1 + k) | 0},${G0 * (1 + k) | 0},${B0 * (1 + k) | 0})`;
  const detail = r > 3.5 && !lowPower, spin = t * (0.6 + (n.seed ?? 0.5) * 0.5);
  n.secs ??= ((n.text || "").match(/^## /gm) || []).length;
  if (glowA) { cx.globalAlpha *= glowA; cx.fillStyle = c; cx.beginPath(); cx.arc(x, y, r * 2.1, 0, Math.PI * 2); cx.fill(); cx.globalAlpha /= glowA; }
  const ring = detail && n.type === "hub", tilt = -0.35;
  if (ring) { cx.strokeStyle = `rgba(${R0},${G0},${B0},.55)`; cx.lineWidth = Math.max(1, r * 0.14); cx.beginPath(); cx.ellipse(x, y, r * 1.75, r * 0.5, tilt, Math.PI, Math.PI * 2); cx.stroke(); }
  const g = cx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
  g.addColorStop(0, mix(0.7)); g.addColorStop(0.45, c); g.addColorStop(1, mix(-0.62));
  cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  if (detail) { // a band of weather across the face, and a thin rim of light
    cx.strokeStyle = "rgba(255,255,255,.14)"; cx.lineWidth = Math.max(0.6, r * 0.12); cx.beginPath(); cx.ellipse(x, y + r * 0.15, r * 0.82, r * 0.22, 0, 0.2, Math.PI - 0.2); cx.stroke();
    cx.strokeStyle = "rgba(255,255,255,.45)"; cx.lineWidth = Math.max(0.6, r * 0.07); cx.beginPath(); cx.arc(x, y, r * 0.96, Math.PI * 1.05, Math.PI * 1.6); cx.stroke();
  }
  if (ring) { cx.strokeStyle = `rgba(${R0},${G0},${B0},.8)`; cx.lineWidth = Math.max(1, r * 0.14); cx.beginPath(); cx.ellipse(x, y, r * 1.75, r * 0.5, tilt, 0, Math.PI); cx.stroke(); }
  if (detail) for (let k = 0; k < Math.min(5, n.secs); k++) { // moons: one per section of the note
    const a = spin * (1 - k * 0.15) + k * 2.3, d = r * (1.9 + k * 0.42), mx = x + Math.cos(a) * d, my = y + Math.sin(a) * d * 0.38;
    cx.fillStyle = Math.sin(a) > 0 ? "rgba(235,240,255,.95)" : "rgba(170,180,210,.6)"; cx.beginPath(); cx.arc(mx, my, Math.max(1, r * 0.15), 0, Math.PI * 2); cx.fill();
  }
  if (detail && FACTORY_NOTES.test(n.name)) { // a gold octagon: this note opens the factory
    cx.strokeStyle = `rgba(255,211,74,${0.55 + 0.3 * Math.sin(t * 2)})`; cx.lineWidth = 1.2; cx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8 + t * 0.3; cx.lineTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45); }
    cx.closePath(); cx.stroke();
  }
}
function drawNode(n) {
  const [x, y, z, f] = n.p, depth = Math.max(0.25, Math.min(1, 0.85 - z * 0.45)) * Math.min(1, boot * 1.6);
  const r = (2.2 + Math.sqrt(n.deg) * 1.25 + n.hot * 4) * f * cam.zoom ** 0.5, c = nodeColor(n);
  cx.globalAlpha = depth;
  cx.shadowColor = c; cx.shadowBlur = 8 + n.hot * 20; cx.fillStyle = c;
  cx.beginPath(); cx.arc(x, y, r * 0.9, 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0;
  orb(x, y, r, c, n, 0);
  if (n === focus) { cx.strokeStyle = c; cx.lineWidth = 1; cx.beginPath(); cx.arc(x, y, r + 7 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2); cx.stroke(); }
  if (n.isNew) { // new section: pulsing green ring
    cx.strokeStyle = `rgba(92,242,165,${0.45 + 0.4 * Math.sin(t * 4)})`; cx.lineWidth = 1.5;
    cx.beginPath(); cx.arc(x, y, r + 6 + 2 * Math.sin(t * 4), 0, Math.PI * 2); cx.stroke();
  }
  cx.globalAlpha = 1;
  n.sx = x; n.sy = y; n.sr = Math.max(r + 10, 18); n.sz = z;
}
// Labels never sit on top of buttons or text: collect the on-screen UI boxes now and then.
let uiBoxes = [], uiAt = -1;
function uiRects() {
  if (t - uiAt < 0.5) return uiBoxes;
  uiAt = t; uiBoxes = [];
  for (const el of document.querySelectorAll(".top > *, .tabs, .status, .readout, .log .msg, .chips, #ask, .mid > .panel, #card.show")) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height && getComputedStyle(el).display !== "none") uiBoxes.push([r.left, r.top, r.right, r.bottom]);
  }
  return uiBoxes;
}
function drawLabels(R, ox, oy) {
  const phone = W < 700, max = phone ? 6 : 12, fs = phone ? 12 : 12.5;
  cx.font = `500 ${fs}px system-ui, -apple-system, Roboto, sans-serif`; cx.textAlign = "center"; cx.textBaseline = "middle";
  const order = [...nodes].sort((a, b) => score(b) - score(a));
  function score(n) { return (n === focus ? 1e4 : 0) + n.hot * 400 + (n.isNew ? 300 : 0) + (touches?.counts?.[n.name] || 0) * 5 + n.deg * 6 - n.sz * 120; }
  const fixed = [[ox - R * 1.25, oy - R * 1.25, ox + R * 1.25, oy + R * 1.25], [ox - 150, oy - R * 2.32 - 10, ox + 150, oy - R * 2.32 + 4], ...uiRects(), ...(capBox ? [capBox] : [])];
  const taken = [];
  for (const n of order) {
    const w = (n.lw ??= cx.measureText(n.name).width) + 14, h = fs + 9, x0 = n.sx - w / 2, y0 = n.sy - n.sr - h + 2;
    let ok = taken.length < max && n.sz < 0.55 && x0 > 2 && x0 + w < W - 2 && y0 > 2;
    if (ok && n !== focus) for (const [a, b, c, d] of [...fixed, ...taken]) if (x0 < c + 4 && x0 + w > a - 4 && y0 < d + 3 && y0 + h > b - 3) { ok = false; break; }
    if (n === focus) ok = true;
    if (ok) taken.push([x0, y0, x0 + w, y0 + h]);
    n.la += ((ok ? 1 : 0) - n.la) * (ok ? 0.12 : 0.3); // fade in gently, get out of the way fast
    if (n.la < 0.03) continue;
    cx.globalAlpha = n.la;
    cx.fillStyle = "rgba(3,7,12,.78)"; cx.strokeStyle = `rgba(${ARC},.4)`; cx.lineWidth = 1;
    cx.beginPath(); cx.roundRect ? cx.roundRect(x0, y0, w, h, 3) : cx.rect(x0, y0, w, h); cx.fill(); cx.stroke();
    cx.strokeStyle = `rgba(${ARC},.35)`; cx.beginPath(); cx.moveTo(n.sx, y0 + h); cx.lineTo(n.sx, n.sy - n.sr * 0.5); cx.stroke();
    cx.fillStyle = n === focus || n.hot > 0.5 ? "#fff" : "rgba(230,246,255,.95)"; cx.fillText(n.name, n.sx, y0 + h / 2 + 0.5);
  }
  cx.globalAlpha = 1; cx.textBaseline = "alphabetic";
}

let focus = null;
const BOOT0 = performance.now(); // the brain assembles out of the core when the page opens
let boot = reduce ? 1 : 0;
const gradCache = new Map(); // gradients only change when the layout or theme does
function cached(key, make) {
  if (!gradCache.has(key)) { if (gradCache.size > 40) gradCache.clear(); gradCache.set(key, make()); }
  return gradCache.get(key);
}
let frame = 0, lastNow = 0, frameMs = 16, lowPower = false;
function draw() {
  if (!$("night").hidden) { requestAnimationFrame(draw); return; } // night mode: no brain, no battery drain
  if (document.hidden || window.JarvisFactory?.isOpen?.()) { requestAnimationFrame(draw); return; } // the factory covers the brain: draw nothing behind it
  frame++;
  // if the phone can't keep up in Show off, drop the glow pass and half the stars instead of stuttering
  const now = performance.now(); if (lastNow) frameMs += (Math.min(100, now - lastNow) - frameMs) * 0.05; lastNow = now;
  if (SHOW() && !lowPower && frame > 45 && frameMs > 26) lowPower = true;
  t += reduce ? 0.004 : 1 / 60;
  const { ox, oy, base } = coreBox();
  if (SHOW()) { ARC = hue(250 + Math.sin(t * 0.15) * 70); MODE_COLOR.idle = ARC.split(",").map(Number); MODE_COLOR.speaking = MODE_COLOR.idle.map((v) => Math.min(255, v + 40)); if (!cinema) runTour(); }
  runCinema();
  if (SHOW() && cinema) { // cinema in Show off is the flight through the brain
    if (!flight.on) Object.assign(flight, { on: true, t0: t, k: -1, flash: 0, inside: null, lastP: null });
    physics(); drawFlight(); requestAnimationFrame(draw); return;
  }
  if (flight.on) { flight.on = false; warpBoost = 0; tour.cap = null; if (demo) { demo = false; stopVoice(); setMode("idle"); } }
  physics();
  if (!SHOW()) { // Workshop look: src/workshop.js draws the brain in 3D; this loop keeps the physics, the glow decay and the voice level
    const live = voiceLevel();
    const want = mode === "speaking" ? (live !== null ? 0.3 + live * 0.7 : 0.45 + 0.4 * Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3)))
      : mode === "listening" ? 0.3 + 0.15 * Math.abs(Math.sin(t * 5)) : mode === "thinking" ? 0.32 : 0.1 + 0.05 * Math.sin(t * 1.6);
    level += (want - level) * 0.18;
    if (cv.dataset.clear !== "1") { cx.clearRect(0, 0, W, H); cv.dataset.clear = "1"; }
    requestAnimationFrame(draw); return;
  }
  cv.dataset.clear = "";
  if (cam.go && !grab) { // glide so the tapped note faces you
    let dy = cam.go[0] - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    cam.yaw += dy * 0.08; cam.pitch += (cam.go[1] - cam.pitch) * 0.08; cam.vYaw = 0; cam.vPitch = 0;
    if (Math.abs(dy) < 0.003 && Math.abs(cam.go[1] - cam.pitch) < 0.003) cam.go = null;
  } else if (!grab) {
    cam.yaw += cam.vYaw; cam.pitch = Math.max(-1.35, Math.min(1.35, cam.pitch + cam.vPitch));
    cam.vYaw += ((reduce ? 0 : 0.0016) - cam.vYaw) * 0.02; cam.vPitch *= 0.95;
    // when left alone, the view drifts back to a slow breathing tilt
    if (Math.abs(cam.vPitch) < 0.001 && !reduce) cam.pitch += (-0.28 + Math.sin(t * 0.21) * 0.14 - cam.pitch) * 0.004;
  }
  const target = MODE_COLOR[mode];
  col = col.map((c, i) => c + (target[i] - c) * 0.08);
  const C = (a) => `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`;
  const spin = t * (mode === "thinking" ? 1.4 : 0.18);
  if (boot < 1) boot = Math.min(1, (performance.now() - BOOT0) / 2600);
  const bootE = 1 - Math.pow(1 - boot, 3);
  const S = Math.max(Math.min(W, H) * (W < 700 ? 0.44 : 0.4), base * (SHOW() ? 3.1 : 2.75)) * cam.zoom * (0.08 + 0.92 * bootE);
  view = camera(ox, oy, S);
  cx.clearRect(0, 0, W, H);

  // grid with a touch of parallax as you orbit (Show off only: the everyday look stays clean)
  if (SHOW()) {
  cx.strokeStyle = `rgba(${ARC},.035)`; cx.lineWidth = 1;
  const gx = (ox + cam.yaw * 60) % 44, gy = (oy + cam.pitch * 60) % 44;
  for (let x = gx; x < W; x += 44) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
  for (let y = gy; y < H; y += 44) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
  }
  if (SHOW() && !reduce) warp(ox, oy);

  // project everything
  for (const n of nodes) n.p = view(n.x, n.y, n.z);
  const dust = DUST.map((d) => {
    const th = d.th + t * d.sp;
    return view(d.r * Math.sin(d.phi) * Math.cos(th), d.r * Math.cos(d.phi), d.r * Math.sin(d.phi) * Math.sin(th));
  });
  const dustDot = ([x, y, z], i) => {
    const a = (0.15 + 0.35 * Math.abs(Math.sin(t * 1.3 + DUST[i].tw * 9))) * Math.max(0.2, 0.8 - z * 0.4);
    cx.fillStyle = `rgba(${ARC},${a})`; cx.fillRect(x, y, 1.3, 1.3);
  };
  // far half: dust, links, notes behind the core
  dust.forEach((p, i) => { if (p[2] > 0) dustDot(p, i); });
  for (const e of edges) {
    const [a, b] = e, za = (a.p[2] + b.p[2]) / 2, hot = Math.max(a.hot, b.hot);
    const ec = SHOW() ? hue(e.h + t * 12) : ARC;
    cx.strokeStyle = `rgba(${ec},${((SHOW() ? 0.16 : 0.06) + hot * 0.5) * Math.max(0.35, 1 - za * 0.5)})`; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(a.p[0], a.p[1]); cx.lineTo(b.p[0], b.p[1]); cx.stroke();
    // a pulse travels every link, so the brain looks like it's thinking
    const u = (t * 0.22 + e.seed) % 1, px = a.p[0] + (b.p[0] - a.p[0]) * u, py = a.p[1] + (b.p[1] - a.p[1]) * u;
    cx.fillStyle = `rgba(${ec},${(SHOW() ? 0.95 : 0.5) * Math.sin(u * Math.PI) * Math.max(0.3, 1 - za * 0.5)})`; cx.fillRect(px - 1, py - 1, 2, 2);
  }
  const sorted = [...nodes].sort((a, b) => b.p[2] - a.p[2]);
  for (const n of sorted) if (n.p[2] > 0) drawNode(n);

  // a dark lens behind the core hides the far side's links, so the core reads cleanly
  const fx = cached(`lens${ox}|${oy}|${base}`, () => {
    const g = cx.createRadialGradient(ox, oy, 0, ox, oy, base * 2.3);
    g.addColorStop(0, "rgba(0,0,0,.72)"); g.addColorStop(0.7, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
    return g;
  });
  cx.fillStyle = fx; cx.beginPath(); cx.arc(ox, oy, base * 2.3, 0, Math.PI * 2); cx.fill();

  // the 4D layer
  const tv = tesseract(t).map(([x, y, z, w]) => [...view(x, y, z), w]);
  cx.lineWidth = 1;
  for (const [i, j, axis] of TE) {
    const a = tv[i], b = tv[j], wv = (a[4] + b[4]) / 2;
    cx.strokeStyle = axis === 3 ? `rgba(${ARC},.12)` : `rgba(${ARC},${0.16 + (wv + 1) * 0.1})`;
    cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
  }
  for (const v of tv) { cx.fillStyle = `rgba(${ARC},${0.35 + (v[4] + 1) * 0.25})`; cx.fillRect(v[0] - 1.2, v[1] - 1.2, 2.4, 2.4); }
  if (SHOW()) { drawPenteract(); scanPlane(); }

  // energy level
  const live = voiceLevel();
  const want = mode === "speaking" ? (live !== null ? 0.3 + live * 0.7 : 0.45 + 0.4 * Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3)))
    : mode === "listening" ? 0.3 + 0.15 * Math.abs(Math.sin(t * 5)) : mode === "thinking" ? 0.32 : 0.1 + 0.05 * Math.sin(t * 1.6);
  level += (want - level) * 0.18;
  const R = base * (1 + level * 0.08);

  // glow
  if (SHOW()) {
  const g = cx.createRadialGradient(ox, oy, 0, ox, oy, R * 2.4);
  const dimCore = !SHOW(); // a soft light, not a flare; Show off keeps the full bloom
  g.addColorStop(0, dimCore ? "rgba(255,250,235,.35)" : "rgba(235,252,255,.9)"); g.addColorStop(0.12, C(dimCore ? 0.22 : 0.7));
  g.addColorStop(0.35, C(0.14 + level * 0.2)); g.addColorStop(1, C(0));
  cx.fillStyle = g; cx.beginPath(); cx.arc(ox, oy, R * 2.4, 0, Math.PI * 2); cx.fill();
  }

  cx.save(); cx.translate(ox, oy); cx.shadowColor = C(1); cx.shadowBlur = 16; cx.textAlign = "center";
  if (boot < 1) { // power-up: rings sweep in, then the core lights
    cx.globalAlpha = Math.min(1, boot * 2.2);
    cx.save(); cx.shadowBlur = 0; cx.strokeStyle = C(0.9 * (1 - boot)); cx.lineWidth = 2;
    cx.beginPath(); cx.arc(0, 0, R * (0.3 + boot * 2.4), 0, Math.PI * 2); cx.stroke();
    cx.fillStyle = C(0.9); cx.font = "600 10px 'IBM Plex Mono', monospace";
    if (SHOW()) cx.fillText(boot < 0.5 ? `MAPPING ${nodes.length} NOTES · ${Math.round(boot * 200)}%` : boot < 0.85 ? "FOLDING IN THE 4TH DIMENSION" : "ALL SYSTEMS ONLINE", 0, R * 1.25);
    cx.restore();
  }
  if (!SHOW()) coreMind(R, C, spin); else {
  (CORES[THEME] || coreArc)(R, C, spin);
  cx.shadowBlur = 0;

  // shared rings
  cx.lineWidth = 2.5; cx.strokeStyle = C(0.7);
  for (let i = 0; i < 3; i++) { const a = -spin * 1.2 + i * Math.PI * 2 / 3; cx.beginPath(); cx.arc(0, 0, R * 1.58, a, a + 1.1); cx.stroke(); }
  cx.lineWidth = 1;
  for (let i = 0; i < 2; i++) { const a = spin * 0.7 + i * Math.PI; cx.beginPath(); cx.arc(0, 0, R * 1.78, a, a + 2.2); cx.stroke(); }
  // voice bars
  const bars = 72;
  for (let i = 0; i < bars; i++) {
    const a = i / bars * Math.PI * 2, wob = Math.abs(Math.sin(i * 1.7 + t * 9) * Math.cos(i * 0.6 - t * 5));
    const len = R * (0.04 + (mode === "speaking" || mode === "listening" ? level * 0.5 * wob : 0.02));
    cx.strokeStyle = C(0.5); cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(Math.cos(a) * R * 1.64, Math.sin(a) * R * 1.64);
    cx.lineTo(Math.cos(a) * (R * 1.64 + len), Math.sin(a) * (R * 1.64 + len)); cx.stroke();
  }
  if (mode === "thinking") { // radar sweep while thinking
    const a = spin * 2, sg = cx.createRadialGradient(0, 0, R, 0, 0, R * 2);
    sg.addColorStop(0, C(0.25)); sg.addColorStop(1, C(0));
    cx.fillStyle = sg; cx.beginPath(); cx.moveTo(0, 0); cx.arc(0, 0, R * 2, a, a + 0.5); cx.closePath(); cx.fill();
  }
  // rotating text ring and ticks
  cx.fillStyle = C(SHOW() ? 0.75 : 0.4); cx.font = `500 ${Math.max(8, R * 0.11) | 0}px 'IBM Plex Mono', monospace`;
  const txt = RING_TEXT.repeat(2), tr = R * 1.97;
  for (let i = 0; i < txt.length; i++) {
    const a = i / txt.length * Math.PI * 2 - spin * 0.3;
    cx.save(); cx.rotate(a); cx.translate(0, -tr); cx.fillText(txt[i], 0, 0); cx.restore();
  }
  cx.strokeStyle = C(0.3); cx.lineWidth = 1;
  for (let i = 0; i < 120; i++) {
    const a = i / 120 * Math.PI * 2 + spin * 0.1, r1 = R * 2.15, r2 = r1 + (i % 10 ? 3 : 9);
    cx.beginPath(); cx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); cx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); cx.stroke();
  }
  }
  cx.restore(); cx.globalAlpha = 1;

  // near half: dust and notes in front of the core
  for (const n of sorted) if (n.p[2] <= 0) drawNode(n);
  dust.forEach((p, i) => { if (p[2] <= 0) dustDot(p, i); });
  if (SHOW()) { satellites(ox, oy); shockwave(ox, oy, R); if (!lowPower) bloom(); }

  // lessons waiting to be filed orbit the note they're about (gold sparks)
  lessons.filter((l) => !l.filed).forEach((l, i) => {
    const host = nodeBy.get(l.note) || nodeBy.get("Jarvis") || nodes[0]; if (!host) return;
    const a = t * 0.8 + i * 2.4, rr = host.sr + (i % 3) * 5, x = host.sx + Math.cos(a) * rr, y = host.sy + Math.sin(a) * rr;
    cx.fillStyle = "#ffb23e"; cx.shadowColor = "#ffb23e"; cx.shadowBlur = 8;
    cx.beginPath(); cx.arc(x, y, 1.8, 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0;
  });

  // the brain dissolves under the header and the input bar instead of colliding with them
  const top = Math.min(110, H * 0.13);
  cx.fillStyle = cached(`vt${BG}${top}`, () => { const g = cx.createLinearGradient(0, 0, 0, top); g.addColorStop(0, BG); g.addColorStop(1, BG + "00"); return g; });
  cx.fillRect(0, 0, W, top);
  cx.fillStyle = cached(`vb${BG}${H}`, () => { const g = cx.createLinearGradient(0, H - 120, 0, H); g.addColorStop(0, BG + "00"); g.addColorStop(1, BG); return g; });
  cx.fillRect(0, H - 120, W, 120);

  drawLabels(R, ox, oy);
  if (SHOW()) caption(ox, oy, R);

  // dimension readout over the core, on its own dark strip (Show off only)
  if (!SHOW()) { requestAnimationFrame(draw); return; }
  const deg = (v) => String(Math.round(((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 180 / Math.PI)).padStart(3, "0");
  cx.font = "500 9px 'IBM Plex Mono', monospace"; cx.textAlign = "center";
  const ry = oy - R * 2.32, rw = Math.min(W - 24, 300);
  cx.fillStyle = cached(`strip${ox}|${rw}`, () => {
    const g = cx.createLinearGradient(ox - rw / 2, 0, ox + rw / 2, 0);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.2, "rgba(0,0,0,.7)"); g.addColorStop(0.8, "rgba(0,0,0,.7)"); g.addColorStop(1, "rgba(0,0,0,0)");
    return g;
  }); cx.fillRect(ox - rw / 2, ry - 10, rw, 14);
  cx.fillStyle = `rgba(${ARC},.6)`;
  cx.fillText(SHOW() ? `5D · XV ${deg(t * 0.23)}° · YW ${deg(t * 0.17)}° · WV ${deg(t * 0.29)}° · ${nodes.length} NOTES · ZOOM ${cam.zoom.toFixed(1)}×`
    : "", ox, oy - R * 2.32);
  requestAnimationFrame(draw);
}
addEventListener("DOMContentLoaded", () => requestAnimationFrame(draw)); // start once every script has loaded

// drag to orbit (two fingers pinch to zoom); tap the core to talk, tap a dot to open that note
let grab = null, cardNote = null;
const pts = new Map();
cv.addEventListener("pointerdown", (e) => {
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  cv.setPointerCapture(e.pointerId);
  cam.go = null;
  if (pts.size === 1) grab = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, pinch: false };
  else if (grab) { const [a, b] = [...pts.values()]; grab.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); grab.zoom0 = cam.zoom; grab.moved = 99; }
});
cv.addEventListener("pointermove", (e) => {
  if (!grab || !pts.has(e.pointerId)) return;
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (grab.pinch && pts.size > 1) {
    const [a, b] = [...pts.values()];
    cam.zoom = Math.max(0.6, Math.min(2.4, grab.zoom0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / grab.pinch));
    return;
  }
  grab.moved = Math.max(grab.moved, Math.hypot(e.clientX - grab.x, e.clientY - grab.y));
  if (grab.moved < 8) return;
  cv.classList.add("drag");
  const dx = e.clientX - grab.lx, dy = e.clientY - grab.ly; grab.lx = e.clientX; grab.ly = e.clientY;
  cam.yaw -= dx * 0.0065; cam.pitch = Math.max(-1.35, Math.min(1.35, cam.pitch + dy * 0.0065));
  cam.vYaw = -dx * 0.0065; cam.vPitch = dy * 0.0065;
});
function release(e) {
  pts.delete(e.pointerId);
  if (pts.size) return;
  const g = grab; grab = null; cv.classList.remove("drag");
  if (!g) return;
  if (g.moved >= 8) { cam.vYaw = Math.max(-0.12, Math.min(0.12, cam.vYaw)); cam.vPitch = Math.max(-0.08, Math.min(0.08, cam.vPitch)); return; }
  if (e.type === "pointerup") tap(e.clientX, e.clientY);
}
cv.addEventListener("pointerup", release);
cv.addEventListener("pointercancel", release);
cv.addEventListener("wheel", (e) => { e.preventDefault(); cam.zoom = Math.max(0.6, Math.min(2.4, cam.zoom * Math.exp(-e.deltaY * 0.0012))); }, { passive: false });
function tap(px, py) {
  const g = GATE.rect; // tapping the factory gate in the flight walks you in
  if (g && t - g[4] < 0.6 && px > g[0] && px < g[2] && py > g[1] && py < g[3]) { wokeFromCinema = false; openFactory(); return; }
  if (wokeFromCinema) { wokeFromCinema = false; return; } // the first tap in Show off cinema just brings the controls back
  const { ox, oy, base } = coreBox();
  // nearest dot under the finger wins, front ones first
  const n = nodes.filter((n) => Math.hypot(n.sx - px, n.sy - py) < n.sr).sort((a, b) => a.sz - b.sz)[0];
  if (n) { openNote(n); return; }
  if (Math.hypot(px - ox, py - oy) < base * 1.4) { listen(); return; }
  focus = null; $("card").classList.remove("show");
}

// Notes are markdown: show headings, bullets, bold and [[links]] (tap a link to jump to that note).
function noteHtml(md) {
  const esc = (x) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const inline = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[\[(.+?)\]\]/g, (m, name) => nodeBy.has(name) ? `<button type="button" class="jump" data-note="${name}">${name}</button>` : name);
  let out = "", list = false;
  for (const line of md.replace(/^---[\s\S]*?---\s*/, "").trim().split("\n")) {
    const li = line.match(/^\s*[-*] (\[[ x]\] )?(.*)$/), h = line.match(/^(#{1,3}) (.*)$/);
    if (li && !list) { out += "<ul>"; list = true; }
    if (!li && list) { out += "</ul>"; list = false; }
    if (h) out += h[1].length === 1 ? "" : `<h4>${inline(h[2])}</h4>`;
    else if (li) out += `<li${li[1] ? ` class="${li[1].includes("x") ? "done" : "todo"}"` : ""}>${inline(li[2])}</li>`;
    else if (line.trim()) out += `<p>${inline(line)}</p>`;
  }
  return out + (list ? "</ul>" : "");
}
$("cardBody").addEventListener("click", (e) => {
  const b = e.target.closest(".jump"); if (!b) return;
  e.stopPropagation(); openNote(nodeBy.get(b.dataset.note));
});
function openNote(n) {
  light([n.name]); cardNote = n.name; touch(n.name); focus = n;
  try { navigator.vibrate?.(8); } catch {}
  cam.go = [Math.atan2(n.x, -n.z), Math.max(-1.2, Math.min(1.2, Math.atan2(-n.y, Math.hypot(n.x, n.z))))];
  $("cardTitle").textContent = n.name + (n.isNew ? " · new" : "");
  $("cardBody").innerHTML = noteHtml(n.text);
  $("cardFactory").hidden = !FACTORY_NOTES.test(n.name);
  $("card").classList.add("show");
}
$("card").addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
  const name = cardNote; $("card").classList.remove("show");
  if (act === "factory") { openFactory(); return; }
  if (act === "close" || !name) return;
  if (act === "ask") { aboutNote = name; ask(`Brief me on my "${name}" note: what it says, what's open, and what you'd do next.`); }
  if (act === "teach") { aboutNote = name; $("q").value = `Remember about ${name}: `; $("q").focus(); }
  if (act === "job") {
    if ($("jobMode").getAttribute("aria-pressed") !== "true") $("jobMode").click();
    aboutNote = name; $("q").value = `${name}: `; $("q").focus();
  }
});
function light(names) {
  for (const name of names) {
    const n = nodeBy.get(name); if (!n) continue;
    n.hot = 1;
    for (const l of n.links) if (nodeBy.has(l)) nodeBy.get(l).hot = Math.max(nodeBy.get(l).hot, 0.45);
  }
}

