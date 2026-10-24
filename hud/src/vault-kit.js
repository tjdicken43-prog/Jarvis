/* ---------- Vault 479 kit: the parts every wing shares (round 9, hud/DESIGN.md) ----------
   The low-poly rig, the vault shell textures, sacred geometry, painted room backdrops (each room is dressed as the place
   its fighter fought), costumes for the crash-test dummies (each dummy is dressed as an opponent that fighter beat) and the
   hit effects: smear trails, dust rings, the anime impact frame. All drawn in code: no outside models or art from the shows.
   One object (VK) so the page build can inline it next to vault.js without name clashes. */
import * as THREE from "three";

export const VK = (() => {
  const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const out = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const bump = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const reseed = (s) => (seed = s);

  /* ---------- materials, geometry and meshes (cached) ---------- */
  const MATS = new Map();
  const mat = (color, o = {}) => {
    const k = color + "|" + (o.e || "") + (o.m || 0) + (o.r || 0) + (o.t || "") + (o.ei || "");
    if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: o.r ?? 0.78, metalness: o.m ?? 0,
      emissive: o.e || "#000000", emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.t ?? 1 }));
    return MATS.get(k);
  };
  const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: o.op ?? 1,
    blending: o.add === false ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, side: o.side ?? THREE.FrontSide });
  const G = {};
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
  const once = (fn) => { let v; return () => (v ||= fn()); };

  /* ---------- the vault shell ---------- */
  const concrete = once(() => tex(512, 512, (g, w, h) => {
    g.fillStyle = "#4d4a44"; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.35, ["#2f2c28", "#6a665e", "#3c3933"]);
    g.strokeStyle = "rgba(15,13,10,.7)"; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.lineWidth = 1.5; g.stroke();
  }, [12, 6]));
  const steel = once(() => tex(512, 256, (g, w, h) => {
    g.fillStyle = "#3d4a50"; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, 0.25, ["#24302f", "#56656a"]);
    for (let x = 0; x < w; x += 128) for (let y = 0; y < h; y += 128) {
      g.strokeStyle = "rgba(10,14,15,.8)"; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, 124, 124);
      g.fillStyle = "#6a787c"; for (const [a, b] of [[10, 10], [118, 10], [10, 118], [118, 118], [64, 10], [64, 118]]) { g.beginPath(); g.arc(x + a, y + b, 3, 0, TAU); g.fill(); }
      if (rnd() < 0.6) { const gr = g.createLinearGradient(0, y + 20, 0, y + 128); gr.addColorStop(0, "rgba(120,62,24,.45)"); gr.addColorStop(1, "rgba(120,62,24,0)"); g.fillStyle = gr; g.fillRect(x + 20 + rnd() * 80, y + 18, 3 + rnd() * 5, 110); }
    }
  }, [6, 2]));
  const hazard = once(() => tex(256, 32, (g, w, h) => { g.fillStyle = "#e0b21c"; g.fillRect(0, 0, w, h); g.fillStyle = "#16130f"; for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); } noise(g, w, h, 600, 0.4, ["#000", "#6b5a2a"]); }, [1, 1]));
  const plaqueTex = (title, sub, accent = "#d9a91b") => tex(768, 200, (g, w, h) => {
    g.fillStyle = "#1e2427"; g.fillRect(0, 0, w, h); g.strokeStyle = accent; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = "#efe6cf"; g.textAlign = "center"; g.textBaseline = "middle"; const fit = (txt, px, wt) => { let s = px; do { g.font = `${wt} ${s}px system-ui, sans-serif`; s -= 2; } while (g.measureText(txt).width > w - 56 && s > 20); };
    fit(title, 62, 600); g.fillText(title, w / 2, sub ? 74 : h / 2 + 2);
    if (sub) { fit(sub, 38, 400); g.fillStyle = "#b9b09a"; g.fillText(sub, w / 2, 146); }
  });

  /* ---------- sacred geometry (TJ, 2026-10-24) ---------- */
  const centres = (r, rings) => { const pts = [[0, 0]]; for (const [d, off] of rings) for (let i = 0; i < 6; i++) { const a = off + (i * Math.PI) / 3; pts.push([Math.cos(a) * d * r, Math.sin(a) * d * r]); } return pts; };
  const flowerOfLife = (g, cx, cy, r) => {
    centres(r, [[1, 0], [2, 0], [Math.sqrt(3), Math.PI / 6]]).forEach(([x, y]) => { g.beginPath(); g.arc(cx + x, cy + y, r, 0, TAU); g.stroke(); });
    for (const k of [3, 3.08]) { g.beginPath(); g.arc(cx, cy, r * k, 0, TAU); g.stroke(); }
  };
  const metatron = (g, cx, cy, r) => {
    const pts = centres(r, [[2, Math.PI / 6], [4, Math.PI / 6]]);
    pts.forEach(([x, y]) => { g.beginPath(); g.arc(cx + x, cy + y, r, 0, TAU); g.stroke(); });
    g.beginPath(); for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { g.moveTo(cx + pts[i][0], cy + pts[i][1]); g.lineTo(cx + pts[j][0], cy + pts[j][1]); } g.stroke();
  };
  const inlay = (parent, draw, x, z, size, color = "#c9a24a") => {
    const t = tex(1024, 1024, (g, w) => { g.strokeStyle = color; g.lineWidth = 5; g.shadowColor = color; g.shadowBlur = 8; draw(g, w / 2, w / 2); });
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: color, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.8, depthWrite: false });
    const me = mesh(new THREE.PlaneGeometry(size, size), m, parent, x, 0.016, z, false); me.rotation.x = -Math.PI / 2; return me;
  };

  /* ---------- the shared rig: a low-poly figure, dressed per character ---------- */
  const rig = (o) => {
    const R = { root: new THREE.Group(), o }; const s = o.build || 1, lw = o.legW || 1;
    R.hips = grp(R.root, 0, 0.95, 0);
    R.legL = grp(R.hips, -0.12 * s, 0, 0); R.legR = grp(R.hips, 0.12 * s, 0, 0);
    for (const L of [R.legL, R.legR]) {
      mesh(box(0.18 * s * lw, 0.5, 0.2 * lw), mat(o.bottom), L, 0, -0.25, 0);
      L.shin = grp(L, 0, -0.48, 0);
      mesh(box(0.16 * s * lw, 0.45, 0.18 * lw), mat(o.shin || o.bottom), L.shin, 0, -0.22, 0);
      mesh(box(0.17 * s, 0.1, 0.29), mat(o.shoes || "#1a1a1a"), L.shin, 0, -0.45, 0.04);
    }
    R.torso = grp(R.hips, 0, 0, 0);
    mesh(box(0.42 * s, 0.24, 0.25), mat(o.belt || o.bottom), R.torso, 0, 0.06, 0);
    R.chest = mesh(box(0.5 * s, 0.52, 0.28), mat(o.top), R.torso, 0, 0.42, 0);
    const arm = (side) => {
      const A = grp(R.torso, side * 0.33 * s, 0.62, 0);
      mesh(box(0.14 * s, 0.34, 0.15 * s), mat(o.sleeve || o.top), A, 0, -0.16, 0);
      A.fore = grp(A, 0, -0.33, 0);
      mesh(box(0.13 * s, 0.3, 0.14 * s), mat(o.fore || o.sleeve || o.top), A.fore, 0, -0.14, 0);
      A.hand = mesh(box(0.12 * s, 0.13, 0.13 * s), mat(o.hand || o.skin), A.fore, 0, -0.35, 0);
      A.rotation.z = side * 0.08; return A;
    };
    R.armL = arm(-1); R.armR = arm(1);
    mesh(box(0.13, 0.12, 0.13), mat(o.neck || o.skin), R.torso, 0, 0.73, 0);
    R.head = grp(R.torso, 0, 0.92, 0);
    R.skull = mesh(ball(0.18, 1), mat(o.skin), R.head); R.skull.scale.set(1, 1.1, 1);
    if (!o.noEyes) { for (const sx of [-1, 1]) mesh(box(0.045, 0.035, 0.02), mat(o.eyes || "#1a1414", o.eyeGlow ? { e: o.eyes } : {}), R.head, sx * 0.065, 0.01, 0.17, false);
      if (!o.noMouth) mesh(box(0.06, 0.012, 0.01), mat("#5a3028"), R.head, 0, -0.085, 0.176, false); }
    R.root.scale.setScalar(o.scale || 1);
    return R;
  };
  const spikes = (parent, color, n, o = {}) => { // hair: low-poly cones fanned over the skull
    const m = mat(color);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.4, el = (o.el0 ?? 0.15) + rnd() * (o.elr ?? 1.1);
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      if (o.back) d.z -= o.back; if (o.up) d.y += o.up; if (o.side) d.x += o.side; d.normalize();
      if (o.front === false && d.z > 0.35 && d.y < 0.6) continue;
      const c = mesh(cone(o.r ?? 0.07, o.len ?? 0.16, 4), m, parent, 0, 0, 0, false);
      c.position.copy(d).multiplyScalar(o.rad ?? 0.15).add(new THREE.Vector3(0, o.y ?? 0.03, 0)); c.quaternion.setFromUnitVectors(UP, d);
    }
    const cap = mesh(new THREE.SphereGeometry(0.195, 8, 5, 0, TAU, 0, Math.PI * (o.capA ?? 0.5)), m, parent, 0, (o.y ?? 0.02) + 0.045, -0.015, false);
    if (o.capTilt) cap.rotation.x = o.capTilt;
    return cap;
  };
  const resetPose = (R) => { for (const k of ["armL", "armR", "legL", "legR", "torso", "head"]) R[k].rotation.set(0, 0, 0);
    R.armL.fore.rotation.set(0, 0, 0); R.armR.fore.rotation.set(0, 0, 0); R.legL.shin.rotation.set(0, 0, 0); R.legR.shin.rotation.set(0, 0, 0);
    R.armL.rotation.z = -0.08; R.armR.rotation.z = 0.08; R.hips.position.y = 0.95; R.root.position.y = 0; };

  /* ---------- painted backdrops: where each fighter fought, drawn in code ---------- */
  const sky = (g, w, h, a, b, c) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); if (c) gr.addColorStop(0.55, c); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
  const hills = (g, w, h, y, amp, col, n = 5) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += w / 40) g.lineTo(x, y - Math.abs(Math.sin(x / w * n * Math.PI + rnd())) * amp); g.lineTo(w, h); g.fill(); };
  const trees = (g, w, h, base, col, trunk, n, s = 1) => { for (let i = 0; i < n; i++) { const x = rnd() * w, hh = (60 + rnd() * 110) * s; g.fillStyle = trunk; g.fillRect(x - 3, base - hh * 0.5, 6, hh * 0.5); g.fillStyle = col; g.beginPath(); g.moveTo(x, base - hh); g.lineTo(x - 26 * s, base - hh * 0.35); g.lineTo(x + 26 * s, base - hh * 0.35); g.fill(); } };
  const city = (g, w, h, base, col, lit, n = 14) => { for (let i = 0; i < n; i++) { const x = (i / n) * w + rnd() * 20, bw = 40 + rnd() * 50, bh = 80 + rnd() * 200; g.fillStyle = col; g.fillRect(x, base - bh, bw, bh);
    g.fillStyle = lit; for (let y = base - bh + 10; y < base - 10; y += 16) for (let xx = x + 6; xx < x + bw - 8; xx += 12) if (rnd() < 0.35) g.fillRect(xx, y, 5, 7); } };
  const moon = (g, x, y, r, col = "#f3efdc") => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const BACKDROPS = {
    river(g, w, h) { sky(g, w, h, "#2e2a4a", "#e08a5a"); g.fillStyle = "#1c2230"; g.fillRect(0, h * 0.62, w, h); g.fillStyle = "#16161e"; g.fillRect(0, h * 0.36, w, 22); for (let x = 60; x < w; x += 180) g.fillRect(x, h * 0.36, 16, h * 0.3);
      g.strokeStyle = "#2e4a2e"; g.lineWidth = 3; for (let i = 0; i < 80; i++) { const x = rnd() * w; g.beginPath(); g.moveTo(x, h); g.lineTo(x + (rnd() - 0.5) * 20, h - 40 - rnd() * 60); g.stroke(); } },
    bridge(g, w, h) { sky(g, w, h, "#8fa7b5", "#d7dee0"); g.fillStyle = "#6a8291"; g.fillRect(0, h * 0.62, w, h); g.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(rnd() * w, h * 0.45 + rnd() * 120, 160, 22, 0, 0, TAU); g.fill(); }
      g.fillStyle = "#4a5560"; g.fillRect(0, h * 0.55, w, 18); for (let x = 20; x < w; x += 70) g.fillRect(x, h * 0.55, 10, 80); },
    namek(g, w, h, v) { sky(g, w, h, v ? "#3f9a6a" : "#4fb06a", "#bfe8a0"); g.fillStyle = "#3a7ad0"; g.fillRect(0, h * 0.72, w, h);
      for (let i = 0; i < 9; i++) { const x = 60 + i * 115 + rnd() * 30, hh = 90 + rnd() * 120; g.fillStyle = "#7a6a52"; g.fillRect(x - 5, h * 0.72 - hh, 10, hh); g.fillStyle = "#2e9a5a"; g.beginPath(); g.arc(x, h * 0.72 - hh, 34, 0, TAU); g.fill(); }
      g.fillStyle = "#a5c97a"; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(160 + i * 340, h * 0.74, 140, 30, 0, 0, TAU); g.fill(); } if (v) moon(g, 840, 80, 40, "#e9f7c0"); },
    wharf(g, w, h) { sky(g, w, h, "#05070d", "#1a2236"); for (let i = 0; i < 6; i++) { const x = i * 180 + rnd() * 40; g.fillStyle = "#0e131c"; g.fillRect(x, h * 0.4, 150, h * 0.6); g.fillStyle = "#e0b45a"; g.fillRect(x + 20, h * 0.5, 30, 6); }
      g.strokeStyle = "#2a3346"; g.lineWidth = 6; g.beginPath(); g.moveTo(700, h); g.lineTo(760, 60); g.lineTo(980, 60); g.moveTo(760, 60); g.lineTo(820, h); g.stroke(); moon(g, 160, 70, 26); },
    forest(g, w, h, v) { sky(g, w, h, v ? "#1f3326" : "#9ec4d6", v ? "#3a5a3a" : "#e2ecd8"); hills(g, w, h, h * 0.6, 50, v ? "#1d2e22" : "#7aa07a"); trees(g, w, h, h * 0.95, v ? "#16261a" : "#2f6a3a", "#4a3626", 26); trees(g, w, h, h * 1.05, v ? "#0f1c12" : "#24532e", "#3a2a1c", 12, 1.6); },
    temple(g, w, h) { sky(g, w, h, "#070a16", "#27304a"); moon(g, 820, 80, 34); for (let i = 0; i < 4; i++) { const x = 60 + i * 250; g.fillStyle = "#141826"; g.fillRect(x, h * 0.5, 180, h * 0.5); g.beginPath(); g.moveTo(x - 30, h * 0.52); g.lineTo(x + 90, h * 0.36); g.lineTo(x + 210, h * 0.52); g.fill(); g.fillStyle = "#e0b45a"; g.fillRect(x + 70, h * 0.66, 40, 30); }
      g.fillStyle = "#3a1416"; g.fillRect(470, h * 0.42, 12, h * 0.58); g.fillRect(560, h * 0.42, 12, h * 0.58); g.fillRect(450, h * 0.44, 142, 12); },
    shibuya(g, w, h) { sky(g, w, h, "#0a0614", "#2a1838"); city(g, w, h, h, "#120f1c", "#ff7ab8", 16); g.fillStyle = "#4ad0ff"; g.fillRect(120, 120, 120, 26); g.fillStyle = "#ff4d6d"; g.fillRect(620, 90, 90, 40); g.fillStyle = "rgba(255,90,140,.25)"; g.fillRect(0, h * 0.85, w, h); },
    corridor(g, w, h) { sky(g, w, h, "#120d0a", "#2a1e16"); for (let i = 0; i < 9; i++) { const k = i / 9, x = w / 2 - (1 - k) * 480, x2 = w / 2 + (1 - k) * 480; g.strokeStyle = `rgba(200,150,90,${0.15 + k * 0.4})`; g.lineWidth = 6 * (1 - k) + 1; g.strokeRect(x, h * 0.1 + k * 150, x2 - x, h * 0.9 - k * 240); }
      g.fillStyle = "#f2d9a0"; g.fillRect(w / 2 - 18, h * 0.45, 36, 50); },
    sea(g, w, h, v) { sky(g, w, h, v ? "#0d1830" : "#9fc6e8", v ? "#365a7a" : "#e8f2f6"); g.fillStyle = v ? "#0f2a40" : "#3a7aa8"; g.fillRect(0, h * 0.55, w, h); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 2; for (let i = 0; i < 30; i++) { const x = rnd() * w, y = h * 0.6 + rnd() * h * 0.35; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y); g.stroke(); }
      g.fillStyle = v ? "#2a3440" : "#d8c896"; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.85); g.lineTo(w, h * 0.92); g.lineTo(w, h); g.fill(); },
    exam(g, w, h) { sky(g, w, h, "#d8c8a8", "#a89070"); for (let x = 0; x < w; x += 128) { g.fillStyle = "#6a5440"; g.fillRect(x, 0, 18, h); } g.fillStyle = "#3a2c20"; g.fillRect(0, h * 0.82, w, h); g.fillStyle = "#e8dcc4"; g.fillRect(w / 2 - 110, 60, 220, 140); g.fillStyle = "#8a2a2a"; g.font = "600 70px system-ui"; g.textAlign = "center"; g.fillText("心", w / 2, 160); },
    village(g, w, h) { sky(g, w, h, "#1a0a08", "#c0461a"); hills(g, w, h, h * 0.45, 90, "#2a1410", 2); g.fillStyle = "#3a1c14"; for (let i = 0; i < 5; i++) { const x = 200 + i * 150; g.beginPath(); g.arc(x, h * 0.4, 30, Math.PI, 0); g.fill(); }
      city(g, w, h, h, "#1a0e0c", "#ffb04a", 12); g.fillStyle = "rgba(255,120,40,.35)"; g.fillRect(0, h * 0.7, w, h); },
    cave(g, w, h) { sky(g, w, h, "#16120e", "#3a2e24"); g.fillStyle = "#2a221a"; for (let i = 0; i < 14; i++) { const x = rnd() * w; g.beginPath(); g.moveTo(x - 40, 0); g.lineTo(x, 60 + rnd() * 120); g.lineTo(x + 40, 0); g.fill(); }
      g.fillStyle = "#e8dcc0"; g.beginPath(); g.ellipse(w / 2, h * 0.6, 160, 120, 0, 0, TAU); g.fill(); g.fillStyle = "#9fb8c8"; g.beginPath(); g.ellipse(w / 2, h * 0.62, 140, 100, 0, 0, TAU); g.fill(); },
    crater(g, w, h) { sky(g, w, h, "#7a6a5a", "#c8b49a"); g.fillStyle = "#5a4a3a"; g.beginPath(); g.ellipse(w / 2, h * 0.95, w * 0.6, h * 0.45, 0, Math.PI, 0); g.fill(); g.fillStyle = "#4a3c30"; for (let i = 0; i < 20; i++) g.fillRect(rnd() * w, h * 0.5 + rnd() * h * 0.4, 20 + rnd() * 40, 8 + rnd() * 16); },
    studio(g, w, h) { sky(g, w, h, "#0c0e14", "#1c2232"); g.fillStyle = "#1a3a8a"; g.fillRect(100, 60, w - 200, 220); g.fillStyle = "#f2f2f2"; g.font = "600 48px system-ui"; g.textAlign = "center"; g.fillText("ON AIR", w / 2, 190); g.fillStyle = "#ff3a3a"; g.beginPath(); g.arc(w / 2 - 150, 175, 12, 0, TAU); g.fill();
      for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(255,240,200,.15)"; g.beginPath(); g.moveTo(80 + i * 170, 0); g.lineTo(40 + i * 170, h); g.lineTo(140 + i * 170, h); g.fill(); } },
    highway(g, w, h) { sky(g, w, h, "#05070c", "#2a3448"); city(g, w, h, h * 0.62, "#0c1018", "#e0d090", 18); g.fillStyle = "#1a1e26"; g.fillRect(0, h * 0.62, w, h); g.fillStyle = "#e8e0b0"; for (let x = 0; x < w; x += 90) g.fillRect(x, h * 0.8, 50, 6);
      g.fillStyle = "#ff3a3a"; g.fillRect(380, h * 0.66, 30, 14); g.fillStyle = "#3a6aff"; g.fillRect(420, h * 0.66, 30, 14); g.strokeStyle = "#f2f2e0"; g.lineWidth = 3; g.beginPath(); g.moveTo(700, 40); g.lineTo(760, 60); g.lineTo(820, 40); g.stroke(); },
    hideout(g, w, h) { sky(g, w, h, "#100c0a", "#2a201a"); g.fillStyle = "#3a2e26"; g.fillRect(0, h * 0.7, w, h); for (let i = 0; i < 5; i++) { g.fillStyle = "#4a3a2e"; g.fillRect(80 + i * 190, h * 0.3, 140, h * 0.4); g.fillStyle = "#1a1410"; g.fillRect(100 + i * 190, h * 0.36, 100, 50); }
      g.fillStyle = "rgba(255,150,60,.5)"; g.beginPath(); g.arc(w * 0.75, h * 0.5, 90, 0, TAU); g.fill(); g.fillStyle = "#6a3a1a"; g.fillRect(200, h * 0.74, 80, 14); },
    warehouse(g, w, h) { sky(g, w, h, "#4a4632", "#8a7a40"); g.fillStyle = "#2e2c22"; g.fillRect(0, h * 0.8, w, h); for (let x = 0; x < w; x += 120) { g.fillStyle = "#5a5440"; g.fillRect(x, 0, 14, h); } g.fillStyle = "#e0c23a"; g.fillRect(w / 2 - 140, 40, 280, 70); g.fillStyle = "#1a1a12"; g.font = "600 40px system-ui"; g.textAlign = "center"; g.fillText("YELLOW BOX", w / 2, 88);
      g.fillStyle = "#6a6a5a"; g.fillRect(140, h * 0.45, 200, h * 0.35); g.fillRect(680, h * 0.5, 220, h * 0.3); },
    hq(g, w, h) { sky(g, w, h, "#0a0e16", "#1e2838"); for (let i = 0; i < 6; i++) { g.fillStyle = "#0e1a2a"; g.fillRect(40 + i * 165, 60, 140, 90); g.fillStyle = "rgba(90,180,255,.5)"; g.fillRect(48 + i * 165, 68, 124, 74); } g.fillStyle = "#121a26"; g.fillRect(0, h * 0.65, w, h); g.fillStyle = "#e8e4d8"; g.font = "600 120px serif"; g.textAlign = "center"; g.fillText("L", w / 2, h * 0.6); },
    lab(g, w, h) { sky(g, w, h, "#dfe8ee", "#b8c8d4"); g.fillStyle = "#f2f6f8"; g.beginPath(); g.ellipse(w / 2, h * 0.55, 260, 170, 0, Math.PI, 0); g.fill(); g.fillStyle = "#3a6ab8"; g.font = "600 44px system-ui"; g.textAlign = "center"; g.fillText("CAPSULE", w / 2, h * 0.45);
      for (let i = 0; i < 8; i++) { g.fillStyle = ["#e04a4a", "#4ab0e0", "#e0b04a"][i % 3]; g.fillRect(60 + i * 120, h * 0.75, 50, 30); } },
    arena(g, w, h) { sky(g, w, h, "#7ab0d8", "#e8d8b0"); hills(g, w, h, h * 0.62, 60, "#a8906a", 3); g.fillStyle = "#cfc6b0"; g.beginPath(); g.moveTo(80, h * 0.92); g.lineTo(w - 80, h * 0.92); g.lineTo(w - 200, h * 0.74); g.lineTo(200, h * 0.74); g.fill();
      g.fillStyle = "#e8e0c8"; for (let i = 0; i < 4; i++) g.fillRect(200 + i * 210, h * 0.6, 16, h * 0.14); },
    wasteland(g, w, h, v) { sky(g, w, h, v ? "#d89a6a" : "#9ab8d0", v ? "#f2d0a0" : "#e8dcc0"); for (let i = 0; i < 6; i++) { const x = rnd() * w, bw = 60 + rnd() * 80, bh = 80 + rnd() * 140; g.fillStyle = v ? "#a8704a" : "#a89070"; g.fillRect(x, h * 0.75 - bh, bw, bh); g.fillStyle = v ? "#c88a5a" : "#c8b090"; g.fillRect(x, h * 0.75 - bh, bw, 10); }
      g.fillStyle = v ? "#8a5a3a" : "#8a7a5a"; g.fillRect(0, h * 0.75, w, h); },
    lookout(g, w, h) { sky(g, w, h, "#3a8ad8", "#cfe6f8"); g.fillStyle = "rgba(255,255,255,.9)"; for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(rnd() * w, h * 0.7 + rnd() * 120, 90 + rnd() * 80, 30, 0, 0, TAU); g.fill(); } g.fillStyle = "#e8e0d0"; g.fillRect(w / 2 - 60, h * 0.3, 120, h * 0.3); g.beginPath(); g.arc(w / 2, h * 0.3, 60, Math.PI, 0); g.fill(); },
    beerus(g, w, h) { sky(g, w, h, "#2a1a4a", "#a87ad8"); for (let i = 0; i < 7; i++) { g.fillStyle = "#5a4a3a"; const x = rnd() * w, y = 40 + rnd() * 160, r = 20 + rnd() * 40; g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0, 0, TAU); g.fill(); g.fillStyle = "#4a8a4a"; g.fillRect(x - r * 0.7, y - r * 0.6, r * 1.4, 6); }
      g.fillStyle = "#3a2a20"; g.fillRect(0, h * 0.82, w, h); moon(g, 860, 90, 50, "#f8e0ff"); },
  };
  const backdrop = (kind, variant) => { reseed(kind.length * 31 + (variant ? 7 : 0)); return tex(1024, 420, (g, w, h) => (BACKDROPS[kind] || BACKDROPS.river)(g, w, h, variant)); };

  /* ---------- room props: a few 3D pieces that place the room (kept to a handful of meshes) ---------- */
  const props = (g, kind, W = 7, D = 4.6) => {
    const hw = W / 2;
    switch (kind) {
      case "bridge": for (let i = 0; i < Math.round(W / 1.1); i++) mesh(box(1.05, 0.06, D), mat(i % 2 ? "#7a5f3e" : "#6d5435"), g, -hw + 0.55 + i * 1.1, 0.04, 0, false);
        mesh(box(W - 0.4, 0.12, 0.12), mat("#5a4630"), g, 0, 0.9, -D / 2 + 0.3); for (let x = -hw + 0.4; x < hw; x += 1.2) mesh(box(0.12, 0.9, 0.12), mat("#5a4630"), g, x, 0.45, -D / 2 + 0.3); break;
      case "namek": for (let i = 0; i < 2; i++) { const t = grp(g, -hw + 0.8 + i * 1.3, 0, -D / 2 + 0.5); mesh(cyl(0.06, 0.08, 1.6, 6), mat("#7a6a52"), t, 0, 0.8, 0); mesh(ball(0.45, 1), mat("#2e9a5a"), t, 0, 1.8, 0); }
        for (let i = 0; i < 4; i++) mesh(ball(0.25 + rnd() * 0.25, 0), mat("#8a7a62"), g, -hw + 1 + rnd() * (W - 2), 0.1, -D / 2 + 0.6 + rnd() * 1.2); break;
      case "river": { for (let i = 0; i < 26; i++) { const r = mesh(cyl(0.01, 0.02, 0.5 + rnd() * 0.5, 3), mat("#46703a"), g, -hw + 0.3 + rnd() * 2, 0.3, -D / 2 + 0.2 + rnd() * 1.2, false); r.rotation.z = (rnd() - 0.5) * 0.4; }
        const wtr = mesh(new THREE.PlaneGeometry(W - 0.4, 1.0), new THREE.MeshStandardMaterial({ color: "#1f3346", roughness: 0.15, metalness: 0.4 }), g, 0, 0.03, -D / 2 + 0.6, false); wtr.rotation.x = -Math.PI / 2; break; }
      case "wharf": case "warehouse": case "hideout": for (let i = 0; i < 3; i++) mesh(box(1.1, 1.0, 0.9), mat(["#6a3a2a", "#2e4a6a", "#5a5a2a"][i]), g, -hw + 0.8 + i * 1.15, 0.5, -D / 2 + 0.6); break;
      case "forest": for (let i = 0; i < 3; i++) { const t = grp(g, -hw + 0.6 + rnd() * 1.6, 0, -D / 2 + 0.4 + rnd() * 0.8); mesh(cyl(0.1, 0.14, 2.4, 6), mat("#4a3626"), t, 0, 1.2, 0); mesh(cone(0.7, 1.6, 6), mat("#2f5a34"), t, 0, 2.6, 0); } break;
      case "temple": case "corridor": for (const sx of [-1, 1]) mesh(box(0.22, 2.6, 0.22), mat("#7a2a24"), g, sx * (hw - 0.6), 1.3, -D / 2 + 0.4); mesh(box(W - 0.8, 0.2, 0.3), mat("#7a2a24"), g, 0, 2.6, -D / 2 + 0.4); break;
      case "shibuya": case "highway": for (let i = 0; i < 2; i++) { mesh(cyl(0.05, 0.05, 2.6, 6), mat("#3a3e44", { m: 0.6 }), g, -hw + 0.6 + i * (W - 1.2), 1.3, -D / 2 + 0.4); mesh(box(0.4, 0.12, 0.2), glow(kind === "shibuya" ? "#ff7ab8" : "#fff2c0"), g, -hw + 0.6 + i * (W - 1.2), 2.6, -D / 2 + 0.4, false); }
        for (let x = -hw + 0.6; x < hw; x += 0.9) mesh(box(0.5, 0.01, 0.3), mat("#e8e4d8"), g, x, 0.02, 0.2, false); break;
      case "cave": case "crater": case "wasteland": for (let i = 0; i < 5; i++) mesh(ball(0.2 + rnd() * 0.4, 0), mat(kind === "wasteland" ? "#a8805a" : "#5a4a3c"), g, -hw + 0.5 + rnd() * (W - 1), 0.15, -D / 2 + 0.4 + rnd() * 1.4); break;
      case "arena": case "exam": mesh(box(W - 0.6, 0.12, D - 0.8), mat(kind === "arena" ? "#cfc6b0" : "#7a5a3a"), g, 0, 0.06, 0, false); break;
      case "studio": case "hq": case "lab": mesh(box(1.4, 0.75, 0.7), mat(kind === "lab" ? "#e8eef2" : "#2a3038"), g, -hw + 1.2, 0.37, -D / 2 + 0.6); mesh(box(0.8, 0.5, 0.05), mat("#0a0e14", { e: kind === "hq" ? "#4ab0ff" : "#3a6ab8", ei: 0.6 }), g, -hw + 1.2, 1.05, -D / 2 + 0.45); break;
      case "lookout": for (let i = 0; i < 6; i++) mesh(box(0.7, 0.04, 0.7), mat("#e8e0d0"), g, -hw + 0.8 + (i % 3) * 0.75, 0.03, -D / 2 + 0.6 + Math.floor(i / 3) * 0.75, false); mesh(cyl(0.3, 0.3, 0.6, 10), mat("#7ab05a"), g, hw - 1, 0.3, -D / 2 + 0.6); break;
      case "beerus": mesh(box(1.6, 0.05, 1.6), mat("#4a8a4a"), g, -hw + 1.2, 0.03, -D / 2 + 1, false); mesh(box(0.6, 1.2, 0.6), mat("#6a5a8a"), g, -hw + 1.2, 0.6, -D / 2 + 0.6); break;
      case "sea": { const s = mesh(new THREE.PlaneGeometry(W - 0.4, 1.2), new THREE.MeshStandardMaterial({ color: "#2a6a8a", roughness: 0.2, metalness: 0.3 }), g, 0, 0.03, -D / 2 + 0.7, false); s.rotation.x = -Math.PI / 2; break; }
      case "village": for (let i = 0; i < 3; i++) mesh(box(0.8, 0.8 + rnd() * 0.6, 0.8), mat("#5a3a2a"), g, -hw + 0.7 + i * 0.95, 0.5, -D / 2 + 0.6); break;
    }
  };
  const FLOORS = { bridge: "#6e5638", namek: "#7fae6a", river: "#3a3b2e", wharf: "#2a2f38", forest: "#3e4a32", temple: "#3a3530", corridor: "#4a3a2c", shibuya: "#2a2830", sea: "#b8a880",
    exam: "#6a5440", village: "#4a3226", cave: "#3a3026", crater: "#5a4a3a", studio: "#24262e", highway: "#2a2c30", hideout: "#3a2e26", warehouse: "#4a4636", hq: "#262c36",
    lab: "#c8d0d6", arena: "#a89878", wasteland: "#8a7258", lookout: "#d8d0c0", beerus: "#4a3a2c" };

  /* ---------- crash-test dummies in the opponent's costume: the yellow body stays, so it still reads as a dummy ---------- */
  const targetMat = once(() => new THREE.MeshBasicMaterial({ transparent: true, map: tex(64, 64, (g) => { g.fillStyle = "#f1cf3a"; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill(); g.fillStyle = "#151515"; for (const a of [0, Math.PI]) { g.beginPath(); g.moveTo(32, 32); g.arc(32, 32, 30, a, a + Math.PI / 2); g.fill(); } }) }));
  const dummyBody = () => {
    const ms = { body: new THREE.MeshStandardMaterial({ color: "#e3be3a", roughness: 0.55, flatShading: true, transparent: true }), dark: new THREE.MeshStandardMaterial({ color: "#26262a", roughness: 0.7, flatShading: true, transparent: true }) };
    const g = new THREE.Group(), lower = grp(g), upper = grp(g, 0, 0.95, 0);
    for (const sx of [-1, 1]) { mesh(box(0.16, 0.9, 0.18), ms.body, lower, sx * 0.11, 0.45, 0); mesh(box(0.17, 0.06, 0.19), ms.dark, lower, sx * 0.11, 0.48, 0); }
    mesh(box(0.4, 0.2, 0.24), ms.dark, lower, 0, 0.95, 0);
    const chest = mesh(box(0.46, 0.5, 0.26), ms.body, upper, 0, 0.35, 0); mesh(box(0.47, 0.04, 0.27), ms.dark, upper, 0, 0.2, 0);
    for (const sx of [-1, 1]) { const a = mesh(box(0.13, 0.62, 0.14), ms.body, upper, sx * 0.31, 0.3, 0); a.rotation.z = sx * 0.12; }
    const head = mesh(ball(0.17, 1), ms.body, upper, 0, 0.82, 0);
    for (const sx of [-1, 1]) { const t = mesh(new THREE.CircleGeometry(0.08, 12), targetMat(), head, sx * 0.172, 0, 0, false); t.rotation.y = sx * Math.PI / 2; }
    return { g, upper, lower, head, chest, ms };
  };
  const C = (D) => ({ // small costume helpers on a dummy
    hair: (col, n = 16, o = {}) => spikes(D.head, col, n, { len: 0.12, r: 0.065, el0: 0.1, elr: 1.1, ...o }),
    shirt: (col) => mesh(box(0.48, 0.52, 0.28), mat(col), D.upper, 0, 0.35, 0, false),
    pants: (col) => { for (const sx of [-1, 1]) mesh(box(0.17, 0.6, 0.19), mat(col), D.lower, sx * 0.11, 0.6, 0, false); },
    face: (col, y = -0.06, hgt = 0.12) => mesh(cyl(0.175, 0.175, hgt, 10), mat(col), D.head, 0, y, 0, false),
    band: (col = "#9aa5ad", tilt = 0) => { const b = mesh(box(0.36, 0.06, 0.03), mat(col, { m: 0.7, r: 0.35 }), D.head, 0, 0.09, 0.16, false); b.rotation.z = tilt; return b; },
    tie: (col) => { mesh(box(0.14, 0.2, 0.02), mat("#efeee8"), D.upper, 0, 0.47, 0.142, false); mesh(box(0.05, 0.28, 0.02), mat(col), D.upper, 0, 0.4, 0.145, false); },
    cape: (col) => mesh(box(0.5, 0.9, 0.04), mat(col), D.upper, 0, 0.2, -0.16, false),
    horns: (col, n = 2, len = 0.18) => { for (let i = 0; i < n; i++) { const sx = i % 2 ? 1 : -1; const c = mesh(cone(0.04, len, 4), mat(col), D.head, sx * 0.13, 0.12 + Math.floor(i / 2) * 0.05, 0, false); c.rotation.z = -sx * 0.6; } },
    skin: (col) => { D.head.material = mat(col); D.chest.material = mat(col); },
    blade: (col = "#c9ced4", w = 0.1, h = 1.0) => { const b = grp(D.upper, 0.05, 0.45, -0.2); b.rotation.z = -0.5; mesh(box(w, h, 0.03), mat(col, { m: 0.85, r: 0.25 }), b, 0, 0, 0); return b; },
    tail: (col) => { const t = grp(D.lower, 0, 0.9, -0.14); for (let i = 0; i < 6; i++) mesh(ball(0.06 - i * 0.006, 0), mat(col), t, Math.sin(i * 0.8) * 0.15, -i * 0.12, -i * 0.08, false); },
    dome: (col, a = 0.45) => mesh(new THREE.SphereGeometry(0.188, 10, 6, 0, TAU, 0, Math.PI * a), mat(col, { r: 0.35 }), D.head, 0, 0.03, 0, false),
    marks: (col, n = 3) => { for (let i = 0; i < n; i++) mesh(box(0.14, 0.03, 0.02), mat(col), D.upper, (i % 2 ? 0.1 : -0.1), 0.2 + i * 0.12, 0.142, false); },
    held: (col, w = 0.16, h = 0.2) => { const n = mesh(box(w, h, 0.03), mat(col), D.upper, 0.33, 0.0, 0.1, false); n.rotation.z = 0.3; return n; },
  });
  const LOOKS = {
    // Jujutsu wing
    gojoteen: (c) => { c.hair("#f5f7fc", 18, { len: 0.16, up: 0.4 }); c.shirt("#13162a"); mesh(box(0.3, 0.06, 0.02), mat("#0b0b0e"), c.D.head, 0, 0.02, 0.17, false); },
    eso: (c) => { mesh(box(0.2, 0.32, 0.02), mat("#3d6b3a"), c.D.head, -0.06, 0.02, 0.165, false); c.shirt("#7a2f2f"); for (const sx of [-1, 1]) mesh(ball(0.06, 0), mat("#3d6b3a"), c.D.upper, sx * 0.22, 0.62, 0.12, false); },
    corpse: (c) => { c.marks("#8a5a3a", 4); mesh(box(0.3, 0.05, 0.02), mat("#5a3a2a"), c.D.head, 0, 0.02, 0.17, false); for (let i = 0; i < 4; i++) mesh(box(0.02, 0.4, 0.02), mat("#5a3a2a"), c.D.upper, -0.2 + i * 0.13, 0.35, 0.142, false); },
    geto: (c) => { c.hair("#141416", 6, { len: 0.1 }); mesh(ball(0.09, 1), mat("#141416"), c.D.head, 0, 0.16, -0.06, false); c.shirt("#2a2a2e"); mesh(box(0.5, 0.18, 0.3), mat("#c8a050"), c.D.upper, 0, 0.55, 0, false); },
    zenin: (c) => { c.hair("#2a2420", 10); c.shirt("#3a3a44"); mesh(box(0.52, 0.12, 0.3), mat("#e8e2d2"), c.D.upper, 0, 0.18, 0, false); },
    mahito: (c) => { c.hair("#9aa8b8", 14, { len: 0.18 }); c.shirt("#2a3442"); for (let i = 0; i < 5; i++) mesh(box(0.02, 0.1, 0.01), mat("#3a3a50"), c.D.head, -0.12 + i * 0.06, -0.02, 0.172, false); },
    hanami: (c) => { c.skin("#6f543c"); mesh(box(0.52, 0.2, 0.3), mat("#e9e2d0"), c.D.lower, 0, 0.8, 0, false); for (const sx of [-1, 1]) mesh(cyl(0.02, 0.035, 0.3, 5), mat("#efe9db"), c.D.head, sx * 0.07, 0.1, 0.2, false).rotation.x = -0.9; },
    kashimo: (c) => { c.hair("#4ab8e8", 16, { len: 0.2, up: 0.4 }); c.shirt("#e8e4d8"); mesh(box(0.1, 0.52, 0.02), mat("#4ab8e8", { e: "#4ab8e8", ei: 0.4 }), c.D.upper, 0, 0.35, 0.142, false); },
    transfig: (c) => { mesh(ball(0.12, 0), mat("#8a7a8a"), c.D.upper, 0.18, 0.62, 0.05, false); mesh(ball(0.1, 0), mat("#8a7a8a"), c.D.head, -0.12, 0.12, 0, false); c.marks("#5a4a5a", 2); },
    jogo: (c) => { c.skin("#ede6d8"); const v = mesh(cyl(0.08, 0.18, 0.22, 7), mat("#3a2a24"), c.D.head, 0, 0.14, 0, false); mesh(ball(0.06, 0), mat("#ff7a1a", { e: "#ff5a00" }), v, 0, 0.1, 0, false); },
    naobito: (c) => { c.hair("#d8d4c8", 10, { len: 0.08 }); c.shirt("#5a6a5a"); mesh(box(0.2, 0.05, 0.02), mat("#8a8a8a", { m: 0.6 }), c.D.head, 0, 0.0, 0.18, false); },
    // Leaf wing (Basis)
    kisame: (c) => { c.skin("#5a8aa8"); c.hair("#2a4a6a", 10, { len: 0.14 }); c.cape("#141414"); for (let i = 0; i < 3; i++) mesh(box(0.1, 0.08, 0.02), mat("#c42a2a"), c.D.upper, -0.12 + i * 0.12, 0.3, 0.142, false); c.blade("#4a6a8a", 0.2, 1.1); },
    sasuke: (c) => { c.hair("#141420", 16, { back: 0.8, len: 0.16 }); c.shirt("#1c2a5a"); c.pants("#e8e4d8"); c.band(); },
    jirobo: (c) => { c.hair("#e07a2a", 8, { len: 0.08 }); c.shirt("#e8e2d0"); mesh(box(0.6, 0.6, 0.32), mat("#e8e2d0"), c.D.upper, 0, 0.32, 0, false); mesh(box(0.6, 0.1, 0.34), mat("#6a3a8a"), c.D.lower, 0, 0.88, 0, false); },
    masked: (c) => { c.face("#e07a2a", 0.0, 0.34); mesh(ball(0.035, 0), mat("#1a1414"), c.D.head, -0.08, 0.02, 0.175, false); c.cape("#141414"); c.shirt("#1a1a24"); },
    sasori: (c) => { c.hair("#c43a2a", 14); c.cape("#141414"); for (let i = 0; i < 3; i++) mesh(box(0.1, 0.08, 0.02), mat("#c42a2a"), c.D.upper, -0.12 + i * 0.12, 0.32, 0.142, false); mesh(cyl(0.04, 0.02, 0.8, 6), mat("#8a8a8a", { m: 0.6 }), c.D.upper, 0, 0.3, -0.25, false).rotation.x = 0.8; },
    zabuza: (c) => { c.face("#e8e2d2", -0.07); c.band("#9aa5ad", -0.2); const b = c.blade(); b.children[0].scale.set(3.4, 1.4, 1); mesh(cyl(0.06, 0.06, 0.04, 12), mat("#0b0e11"), b, 0.04, 0.55, 0, false).rotation.x = Math.PI / 2; mesh(box(0.48, 0.1, 0.28), mat("#5a5f66"), c.D.upper, 0, 0.5, 0, false); },
    hidan: (c) => { c.hair("#d8d8e0", 10, { back: 0.9, len: 0.12 }); c.cape("#141414"); const s = grp(c.D.upper, 0.35, 0.3, 0.1); for (let i = 0; i < 3; i++) { const b = mesh(box(0.05, 0.4, 0.02), mat("#c42a2a", { m: 0.5 }), s, (i - 1) * 0.08, 0.2, 0, false); b.rotation.z = (i - 1) * 0.3; } },
    kidomaru: (c) => { c.hair("#5a3a2a", 12, { back: 0.9 }); c.skin("#c8a080"); c.shirt("#e8e2d0"); for (const sx of [-1, 1]) { const a = mesh(box(0.1, 0.5, 0.1), mat("#c8a080"), c.D.upper, sx * 0.3, 0.15, -0.05, false); a.rotation.z = sx * 0.9; } },
    pain: (c) => { c.hair("#e0762a", 22, { len: 0.16, r: 0.06, el0: 0.2, elr: 1.0 }); c.shirt("#141414"); c.marks("#c42a2a", 4); for (let i = 0; i < 3; i++) mesh(cyl(0.012, 0.012, 0.05, 5), mat("#3a3a3a", { m: 0.7 }), c.D.head, -0.06 + i * 0.06, -0.05, 0.18, false).rotation.x = Math.PI / 2; },
    // Case room wing (Gym-security)
    light: (c) => { c.hair("#7a4a2a", 18, { len: 0.12, r: 0.07, el0: 0.0, elr: 1.2, capA: 0.55 }); c.shirt("#2b2f3a"); c.tie("#b52f37"); c.held("#121214"); },
    ukita: (c) => { c.hair("#1a1a1a", 10, { len: 0.08 }); c.shirt("#4a4a3a"); c.tie("#5a3a2a"); },
    higuchi: (c) => { c.hair("#1a1a1a", 8, { len: 0.08, el0: 0.6, elr: 0.5 }); c.shirt("#2a2d36"); c.tie("#2c5a8a"); mesh(box(0.3, 0.05, 0.02), mat("#202020", { t: 0.8 }), c.D.head, 0, 0.02, 0.175, false); },
    soichiro: (c) => { c.hair("#3a3a3a", 8, { len: 0.06 }); c.shirt("#3a3e48"); c.tie("#6a2a2a"); mesh(box(0.3, 0.04, 0.02), mat("#2a2a2a"), c.D.head, 0, 0.02, 0.175, false); mesh(box(0.14, 0.03, 0.02), mat("#5a5a5a"), c.D.head, 0, -0.06, 0.175, false); },
    mikami: (c) => { c.hair("#141416", 14, { len: 0.12 }); c.shirt("#1a1a1e"); c.tie("#3a3a44"); mesh(box(0.3, 0.05, 0.02), mat("#c8c8d0", { m: 0.6 }), c.D.head, 0, 0.02, 0.175, false); c.held("#121214"); },
    watari: (c) => { c.hair("#d8d8d8", 6, { len: 0.05 }); c.shirt("#1e1e22"); mesh(box(0.14, 0.06, 0.02), mat("#d8d8d8"), c.D.head, 0, -0.07, 0.17, false); mesh(box(0.24, 0.05, 0.02), mat("#4a4a4a", { t: 0.8 }), c.D.head, 0, 0.02, 0.175, false); },
    // Capsule wing (Etsy)
    pilaf: (c) => { c.skin("#7ab0e8"); mesh(cyl(0.12, 0.16, 0.16, 8), mat("#e8e4d8"), c.D.head, 0, 0.2, 0, false); c.shirt("#e8c84a"); mesh(box(0.3, 0.08, 0.02), mat("#e04a4a"), c.D.upper, 0, 0.55, 0.142, false); },
    frieza: (c) => { c.skin("#f2eef0"); c.dome("#6e3d8f"); mesh(box(0.2, 0.2, 0.02), mat("#6e3d8f"), c.D.upper, 0, 0.45, 0.142, false); for (const sx of [-1, 1]) mesh(ball(0.07, 0), mat("#6e3d8f"), c.D.upper, sx * 0.25, 0.6, 0, false); c.tail("#f2eef0"); },
    cell: (c) => { c.skin("#7ab05a"); for (let i = 0; i < 8; i++) mesh(ball(0.03, 0), mat("#1a2a14"), c.D.upper, -0.18 + (i % 4) * 0.12, 0.2 + Math.floor(i / 4) * 0.25, 0.142, false); c.horns("#2a4a1a", 2, 0.22); mesh(box(0.5, 0.3, 0.04), mat("#2a3a1a"), c.D.upper, 0, 0.5, -0.16, false); },
    raditz: (c) => { c.hair("#141416", 18, { back: 1.4, len: 0.4, r: 0.08 }); c.shirt("#5a4a3a"); mesh(box(0.5, 0.18, 0.3), mat("#e8d8a8"), c.D.upper, 0, 0.58, 0, false); mesh(box(0.08, 0.06, 0.02), mat("#4ae04a", { e: "#4ae04a", ei: 0.5 }), c.D.head, -0.1, 0.02, 0.17, false); },
    mecha: (c) => { c.skin("#c8ccd4"); c.dome("#6e3d8f", 0.35); for (let i = 0; i < 4; i++) mesh(box(0.47, 0.02, 0.27), mat("#5a5e66", { m: 0.8 }), c.D.upper, 0, 0.15 + i * 0.12, 0, false); mesh(box(0.12, 0.05, 0.02), mat("#c42a2a", { e: "#c42a2a", ei: 0.5 }), c.D.head, 0, 0.0, 0.17, false); },
    garlic: (c) => { c.skin("#e8d8e8"); mesh(cyl(0.16, 0.2, 0.08, 8), mat("#e8e0c8"), c.D.head, 0, 0.18, 0, false); c.cape("#6a3a2a"); c.shirt("#e8e0c8"); },
    beerus: (c) => { c.skin("#7a5a8a"); for (const sx of [-1, 1]) { const e = mesh(cone(0.07, 0.24, 4), mat("#7a5a8a"), c.D.head, sx * 0.1, 0.22, 0, false); e.rotation.z = -sx * 0.2; } mesh(box(0.5, 0.2, 0.3), mat("#e8c84a", { m: 0.6 }), c.D.upper, 0, 0.6, 0, false); c.pants("#2a2a4a"); c.tail("#7a5a8a"); },
    zarbon: (c) => { c.skin("#7ab890"); mesh(ball(0.1, 1), mat("#2a4a3a"), c.D.head, 0, 0.0, -0.14, false); c.shirt("#e8e0c8"); mesh(box(0.5, 0.2, 0.3), mat("#c8b060"), c.D.upper, 0, 0.56, 0, false); c.cape("#e8e0c8"); },
  };
  const dummy = (look) => { const D = dummyBody(); const c = C(D); c.D = D; LOOKS[look]?.(c); return D; };

  /* ---------- hit effects ---------- */
  const smear = (parent, pts, color, width = 0.18) => { // a ribbon behind the striking hand: wide at the head, gone at the tail
    const pos = [], idx = [], col = [];
    pts.forEach((p, i) => { const k = i / (pts.length - 1), w = width * k; pos.push(p.x, p.y + w, p.z, p.x, p.y - w, p.z); col.push(k, k, k, k, k, k); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    return mesh(geo, m, parent, 0, 0, 0, false);
  };
  const arc = (a, b, lift, n = 14) => { const pts = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, Math.sin(t * Math.PI) * lift, 0))); } return pts; };
  const ringGeo = once(() => new THREE.RingGeometry(0.75, 1, 40));
  const dustRing = (parent, x, z, color = "#d8cdb6") => { const m = mesh(ringGeo(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }), parent, x, 0.05, z, false); m.rotation.x = -Math.PI / 2; return m; };
  const radialTex = once(() => tex(1024, 1024, (g, w) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, w); g.fillStyle = "#000";
    for (let i = 0; i < 110; i++) { const a = rnd() * TAU, a2 = a + 0.01 + rnd() * 0.03; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 230, w / 2 + Math.sin(a) * 230); g.lineTo(w / 2 + Math.cos(a) * 900, w / 2 + Math.sin(a) * 900); g.lineTo(w / 2 + Math.cos(a2) * 900, w / 2 + Math.sin(a2) * 900); g.fill(); } }));
  /* The impact frame: for a blink, the fighter and the dummy are ink silhouettes on white speed lines. Two plain renders
     on layers (no material swaps, no extra passes kept around), only while it shows. */
  const impactFrame = (renderer, scene, camera) => {
    const ink = new THREE.MeshBasicMaterial({ color: "#000000" });
    const bgScene = new THREE.Scene(), bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: radialTex(), toneMapped: false, depthTest: false, depthWrite: false })); bgScene.add(bg);
    let left = 0;
    return {
      fire(sec = 0.075) { left = sec; },
      get on() { return left > 0; },
      tick(real) { left = Math.max(0, left - real); },
      render() { const a = camera.aspect; bgCam.left = -a; bgCam.right = a; bgCam.updateProjectionMatrix(); bg.scale.set(a * 1.1, 1.1, 1);
        renderer.autoClear = false; renderer.clear(); renderer.render(bgScene, bgCam); const om = scene.overrideMaterial, bgc = scene.background, fog = scene.fog;
        scene.overrideMaterial = ink; scene.background = null; scene.fog = null; camera.layers.set(1); renderer.clearDepth(); renderer.render(scene, camera);
        camera.layers.set(0); scene.overrideMaterial = om; scene.background = bgc; scene.fog = fog; renderer.autoClear = true; },
    };
  };
  const inkLayer = (o) => o.traverse((m) => m.layers.enable(1)); // what shows in the impact frame

  /* ---------- Mii portrait: an object alone on a soft backdrop, head and shoulders ---------- */
  const portraitMaker = (renderer) => {
    const pCam = new THREE.PerspectiveCamera(26, 1, 0.05, 30), pRT = new THREE.WebGLRenderTarget(256, 256, { colorSpace: THREE.SRGBColorSpace });
    const pScene = new THREE.Scene(); pScene.background = new THREE.Color("#dfe8ee");
    pScene.add(new THREE.HemisphereLight("#ffffff", "#8a7a66", 2.2)); { const k = new THREE.DirectionalLight("#fff3e0", 2.2); k.position.set(2, 3, 4); pScene.add(k); }
    return (obj, headY, s = 1) => {
      const parent = obj.parent, pos = obj.position.clone(), q = obj.quaternion.clone(), sc = obj.scale.clone();
      pScene.add(obj); obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); obj.updateMatrixWorld(true);
      pCam.position.set(0, headY + 0.05 * s, 2.4 * s); pCam.lookAt(0, headY - 0.28 * s, 0);
      renderer.setRenderTarget(pRT); renderer.render(pScene, pCam); renderer.setRenderTarget(null);
      parent?.add(obj); obj.position.copy(pos); obj.quaternion.copy(q); obj.scale.copy(sc);
      const px = new Uint8Array(256 * 256 * 4); renderer.readRenderTargetPixels(pRT, 0, 0, 256, 256, px);
      const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); const img = g.createImageData(256, 256);
      for (let y = 0; y < 256; y++) img.data.set(px.subarray((255 - y) * 1024, (256 - y) * 1024), y * 1024);
      g.putImageData(img, 0, 0); return c.toDataURL("image/png");
    };
  };

  return { THREE, TAU, UP, clamp, ease, out, bump, rnd, reseed, mat, glow, box, cyl, cone, ball, grp, mesh, tex, noise,
    concrete, steel, hazard, plaqueTex, flowerOfLife, metatron, inlay, rig, spikes, resetPose,
    backdrop, props, FLOORS, dummy, targetMat, LOOKS, smear, arc, dustRing, impactFrame, inkLayer, portraitMaker };
})();
