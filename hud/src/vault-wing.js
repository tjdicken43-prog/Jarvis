/* ---------- Vault 479: the wing engine and the lobby (round 9, hud/DESIGN.md) ----------
   The agency's Jujutsu wing keeps its own hand-built engine (vault.js). Basis, Gym-security and the Etsy shop run here, from
   the data in vault-wings.js: one row of rooms off a corridor, each room dressed as where its fighter fought, a crash-test
   dummy in the costume of an opponent they beat, and the same flow as the agency floor (the dummy drops the job, the fighter
   walks it to the next room). Only one wing is ever built at a time, so watching costs the same as one floor did.
   Everything runs on the device: no Claude calls, stops when hidden, 30 fps cap on phones. */
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { VK } from "./vault-kit.js";
import { WINGS } from "./vault-wings.js";

export function createWing(container, wingId, opts = {}) {
  const { THREE, TAU, UP, clamp, out, ease, bump, rnd, reseed, mat, glow, box, cyl, cone, ball, grp, mesh, tex } = VK;
  const lobby = wingId === "lobby", W = lobby ? null : WINGS[wingId];
  const phone = opts.phone ?? (matchMedia("(pointer: coarse)").matches || innerWidth < 760);
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  reseed(lobby ? 5 : wingId.length * 97);
  const canvas = document.createElement("canvas"); canvas.className = "vault-cv"; container.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, powerPreference: "high-performance" });
  let pr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 2); renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !phone; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#0b0e11"); scene.fog = new THREE.Fog("#0b0e11", 50, 110);
  const camera = new THREE.PerspectiveCamera(phone ? 50 : 36, 1, 0.1, 240); scene.add(camera);
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.85); if (!phone) composer.addPass(bloom); composer.addPass(new OutputPass());
  const impact = VK.impactFrame(renderer, scene, camera), portraitOf = VK.portraitMaker(renderer);
  const world = grp(scene);

  /* ---------- light ---------- */
  scene.add(new THREE.HemisphereLight("#b8c4cc", "#3a2c1c", 1.05));
  const sun = new THREE.DirectionalLight("#ffe6c0", 1.6); sun.position.set(-10, 24, 16); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; scene.add(sun);

  /* ---------- layout: one row of rooms (x), corridor in front (z -2 to 2.5) ---------- */
  const RW = 7, RD = 5.6, Z0 = -2, ZB = Z0 - RD; // room width, depth; corridor-side wall z, back wall z
  const order = lobby ? [] : [...W.chain, ...W.solo];
  const n = order.length, span = lobby ? 34 : n * RW;
  const RX = {}; order.forEach((id, i) => (RX[id] = (i - (n - 1) / 2) * RW));
  const doorX = (id) => RX[id] + 2.1;
  const floor = VK.mesh(new THREE.PlaneGeometry(span + 12, 30), new THREE.MeshStandardMaterial({ map: VK.concrete(), roughness: 0.92 }), world, 0, 0, 2, false); floor.rotation.x = -Math.PI / 2;
  const wallM = new THREE.MeshStandardMaterial({ map: VK.steel(), roughness: 0.6, metalness: 0.35 });
  mesh(box(span + 12, 12, 0.6), wallM, world, 0, 6, ZB - 0.3, false);
  const bandT = tex(1024, 64, (g, w, h) => { g.fillStyle = "#c99a17"; g.fillRect(0, 0, w, h); g.fillStyle = "#1b1712"; g.font = "600 40px system-ui, sans-serif"; g.textBaseline = "middle"; for (let x = 30; x < w; x += 340) g.fillText("Vault 479", x, h / 2 + 2); }, [Math.max(1, Math.round(span / 40)), 1]);
  mesh(box(span + 12, 0.7, 0.62), new THREE.MeshStandardMaterial({ map: bandT, roughness: 0.7 }), world, 0, lobby ? 6.6 : 4.2, ZB - 0.28, false);
  const geo = [];
  const lamps = (xs, z) => xs.forEach((x, i) => { const l = grp(world, x, 6.4, z); mesh(cyl(0.02, 0.02, 1.9, 4), mat("#222"), l, 0, 0.95, 0, false); mesh(cone(0.65, 0.55, 12), mat("#2f4a3a", { m: 0.5, r: 0.5 }), l, 0, 0, 0, false); mesh(ball(0.16, 1), glow("#ffd59a"), l, 0, -0.25, 0, false);
    if (i < (phone ? 2 : 5)) { const p = new THREE.PointLight("#ffcf8f", 24, 16, 1.6); p.position.set(0, -0.6, 0); l.add(p); } });

  /* ---------- particles and debris (as vault.js) ---------- */
  const PN = phone ? 240 : 480;
  const pMesh = new THREE.InstancedMesh(ball(0.06, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), PN); pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pMesh.frustumCulled = false; scene.add(pMesh);
  const parts = []; const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
  for (let i = 0; i < PN; i++) { parts.push({ life: 0 }); pMesh.setColorAt(i, _c.set("#000")); }
  let pNext = 0;
  const emit = (p, v, color, life = 1, size = 1, grav = -9) => { const q = parts[pNext]; pNext = (pNext + 1) % PN; Object.assign(q, { p: p.clone(), v: v.clone(), life, max: life, size, grav, color: new THREE.Color(color) }); };
  const burst = (p, k, color, speed, o = {}) => { for (let i = 0; i < k; i++) { const d = new THREE.Vector3(rnd() - 0.5, (o.up ?? 0.6) + rnd() * (o.upr ?? 0.8), rnd() - 0.5).normalize().multiplyScalar(speed * (0.4 + rnd() * 0.8));
    emit(p, d, Array.isArray(color) ? color[i % color.length] : color, (o.life ?? 1) * (0.6 + rnd() * 0.6), o.size ?? 1, o.grav ?? -9); } };
  const stepParts = (dt) => { for (let i = 0; i < PN; i++) { const q = parts[i]; if (q.life <= 0) { _m.makeScale(0, 0, 0); pMesh.setMatrixAt(i, _m); continue; }
      q.life -= dt; q.v.y += q.grav * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < 0.03 && q.grav < 0) { q.p.y = 0.03; q.v.multiplyScalar(0.4); q.v.y *= -0.5; }
      const k = Math.max(0, q.life / q.max), sc = q.size * (0.35 + 0.65 * k); _m.compose(q.p, _q, _s.set(sc, sc, sc)); pMesh.setMatrixAt(i, _m); pMesh.setColorAt(i, _c.copy(q.color).multiplyScalar(0.3 + k)); }
    pMesh.instanceMatrix.needsUpdate = true; pMesh.instanceColor.needsUpdate = true; };
  const debris = [];
  const toss = (o, v, w, life = 2.6, grav = -12) => { const p = o.getWorldPosition(new THREE.Vector3()), q = o.getWorldQuaternion(new THREE.Quaternion()), sc = o.getWorldScale(new THREE.Vector3());
    scene.add(o); o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); debris.push({ o, v, w: w || new THREE.Vector3((rnd() - 0.5) * 12, (rnd() - 0.5) * 12, (rnd() - 0.5) * 12), life, max: life, grav, settled: 0 }); };
  const stepDebris = (dt) => { for (let i = debris.length - 1; i >= 0; i--) { const b = debris[i]; b.life -= dt; b.v.y += b.grav * dt; b.o.position.addScaledVector(b.v, dt);
      if (b.o.position.y < 0.08) { b.o.position.y = 0.08; b.v.multiplyScalar(0.45); b.v.y = Math.abs(b.v.y) * 0.35; b.w.multiplyScalar(0.5); } // bounce and settle
      b.o.rotation.x += b.w.x * dt; b.o.rotation.y += b.w.y * dt; b.o.rotation.z += b.w.z * dt;
      const k = b.life / b.max; if (k < 0.3) b.o.traverse((m) => { if (m.isMesh && m.material.transparent) m.material.opacity = Math.max(0, k / 0.3); });
      if (b.life <= 0) { scene.remove(b.o); debris.splice(i, 1); } } };
  const fx = []; const effect = (dur, update, done) => fx.push({ t: 0, dur, update, done }); const after = (sec, fn) => effect(sec, () => {}, fn);
  let shake = 0, flash = 0, stop = 0, lastImpact = -99;
  const flashQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
  flashQuad.renderOrder = 999; flashQuad.frustumCulled = false; camera.add(flashQuad); flashQuad.position.z = -0.2;
  const worldOf = (o) => o.getWorldPosition(new THREE.Vector3());

  /* ---------- camera and director ---------- */
  const home = () => lobby ? (phone ? { az: 0.95, el: 0.3, r: 30, tx: 3, ty: 2.4, tz: -3.5 } : { az: 0, el: 0.3, r: 26, tx: 0, ty: 2.6, tz: -3.5 })
    : phone ? { az: 1.15, el: 0.55, r: Math.max(26, span * 0.62), tx: span * 0.12, ty: 0, tz: -3.5 } : { az: 0.5, el: 0.46, r: Math.max(34, span * 0.66), tx: span * 0.06, ty: 0, tz: -4 };
  const cam = { ...home() }; let goal = home(), focusUntil = 0, curPri = 0, focusId = null, userUntil = 0, director = opts.director ?? true, now = 0, idleCut = 6;
  const F = {};
  const focus = (id, hold = 3, o = {}) => { const pri = o.pri ?? 1; if (!director || now < userUntil || (now < focusUntil && pri <= curPri && pri < 3)) return; const f = F[id]; if (!f) return; curPri = pri; focusId = id;
    const p = f.base, s = f.root.scale.x; goal = { az: o.az ?? -0.3, el: o.el ?? 0.34, r: (o.r ?? 8) * (phone ? 1.3 : 1) * Math.max(1, s * 0.85), tx: p.x + (o.dx ?? 1.0), ty: (o.ty ?? 1.1) * s, tz: p.z + 0.3 }; focusUntil = now + hold; };
  const title = (t, sub) => opts.onMove?.(t, sub);

  let api;
  if (lobby) api = buildLobby(); else api = buildRooms();

  /* ---------- input: drag to orbit, pinch or wheel to zoom, tap for a card (or a gate in the lobby) ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let drag = null, pinch = 0; const ptrs = new Map();
  const zoom = (k) => { userUntil = now + 20; goal.r = clamp(goal.r * k, 4, 90); };
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); drag = { moved: 0 }; });
  canvas.addEventListener("pointermove", (e) => { if (!ptrs.has(e.pointerId)) return; const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoom(pinch / d); pinch = d; drag && (drag.moved = 99); return; }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; if (drag) drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag && drag.moved > 6) { userUntil = now + 20; goal.az -= dx * 0.005; goal.el = clamp(goal.el + dy * 0.004, 0.12, 1.25); } });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (drag && drag.moved < 6 && e.type === "pointerup") pick(e); drag = null; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
  const pick = (e) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(api.pickables(), true)[0]; let o = hit?.object; while (o && !o.userData.pick) o = o.parent; if (o) api.onPick(o.userData.pick); };

  /* ---------- loop ---------- */
  const layout = () => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(layout); ro.observe(container); layout();
  let last = performance.now(), running = true, raf = 0, acc = 0, accR = 0, slow = 0, lowPower = false;
  const render = () => { if (impact.on) impact.render(); else if (phone || lowPower) renderer.render(scene, camera); else composer.render(); };
  const frame = (ts) => { raf = requestAnimationFrame(frame); if (!running || document.hidden) { last = ts; return; }
    let real = Math.min(0.5, (ts - last) / 1000), dt = Math.min(0.05, real); last = ts;
    if (real > 0.034 && now > 4) { if (++slow > 90 && !lowPower) { lowPower = true; pr = 1; renderer.setPixelRatio(1); layout(); } } else slow = Math.max(0, slow - 1);
    if (phone) { acc += dt; accR += real; if (acc < 1 / 31) return; dt = acc; real = accR; acc = accR = 0; }
    tick(dt, real || dt); render(); };
  const tick = (dt, real = dt) => {
    impact.tick(real);
    if (stop > 0) { stop -= real; dt = 0; } // hit-stop: the world holds still for a blink when a hit lands
    now += dt; api.step(dt, now);
    for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; const u = Math.min(1, e.t / e.dur); e.update(u); if (u >= 1) { e.done && e.done(); fx.splice(i, 1); } }
    stepParts(dt); stepDebris(dt);
    geo.forEach((g, i) => (g.material.emissiveIntensity = 0.3 + 0.12 * Math.sin(now * 0.5 + i * 1.7)));
    if (now > focusUntil && now > userUntil) { idleCut -= dt; if (director && idleCut < 0) { idleCut = 9; api.idleCut?.(); } }
    const k = 1 - Math.exp(-(real || 0.016) * 2.4); for (const key of ["az", "el", "r", "tx", "ty", "tz"]) cam[key] += (goal[key] - cam[key]) * k;
    const target = new THREE.Vector3(cam.tx, cam.ty, cam.tz);
    camera.position.set(target.x + Math.sin(cam.az) * Math.cos(cam.el) * cam.r, target.y + Math.sin(cam.el) * cam.r, target.z + Math.cos(cam.az) * Math.cos(cam.el) * cam.r);
    if (shake > 0) { camera.position.x += (rnd() - 0.5) * shake; camera.position.y += (rnd() - 0.5) * shake; shake = Math.max(0, shake - real * 1.6); }
    camera.lookAt(target); flashQuad.material.opacity = flash; flash = Math.max(0, flash - real * 2.5); api.tags?.();
  };
  raf = requestAnimationFrame(frame);

  const outApi = Object.assign(api.out, {
    scene, camera, renderer,
    setDirector(on) { director = on; if (!on) { goal = home(); focusUntil = 0; curPri = 0; focusId = null; } },
    home() { userUntil = 0; focusUntil = 0; curPri = 0; focusId = null; goal = home(); },
    pause() { running = false; }, resume() { running = true; last = performance.now(); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); canvas.remove(); api.dispose?.(); },
    _jump(t) { for (let i = 0; i < t * 30; i++) tick(1 / 30); }, // tests and screenshots: fast-forward the sim
    _impact: impact,
  });
  Object.defineProperty(outApi, "mode", { get: () => api.mode() });
  return outApi;

  /* ================= the lobby: four gates, one per business ================= */
  function buildLobby() {
    VK.inlay(world, (g, c) => VK.flowerOfLife(g, c, c, 150), 0, 2, 6); geo.push(world.children[world.children.length - 1]);
    VK.inlay(world, (g, c) => VK.metatron(g, c, c, 100), 0, 2, 9.5, "#8a7340"); geo.push(world.children[world.children.length - 1]);
    const heroes = { agency: "yuji", basis: "naruto", gym: "l", etsy: "goku" }, bds = { agency: "river", basis: "bridge", gym: "wharf", etsy: "namek" };
    const gates = [];
    WINGS.order.forEach((id, i) => { const L = WINGS.labels[id], x = -12 + i * 8, gate = grp(world, x, 0, ZB + 0.4); gate.userData.pick = { gate: id };
      mesh(new THREE.PlaneGeometry(5.2, 4.6), new THREE.MeshBasicMaterial({ map: VK.backdrop(bds[id]), toneMapped: false }), gate, 0, 2.3, -0.05, false);
      for (const sx of [-1, 1]) mesh(box(0.5, 5.4, 0.7), new THREE.MeshStandardMaterial({ map: VK.hazard(), roughness: 0.8 }), gate, sx * 2.85, 2.7, 0.3);
      mesh(box(6.2, 0.5, 0.7), mat("#2b3134", { m: 0.6 }), gate, 0, 5.15, 0.3);
      mesh(new THREE.PlaneGeometry(4.2, 1.1), new THREE.MeshStandardMaterial({ map: VK.plaqueTex(L.name, L.wing, L.accent), roughness: 0.7 }), gate, 0, 5.15, 0.67, false);
      const strip = mesh(box(5.2, 0.06, 0.2), glow(L.accent, { op: 0.8 }), gate, 0, 0.04, 1.2, false);
      const R = hero(heroes[id]); R.root.position.set(x, 0, ZB + 2.4); R.root.scale.multiplyScalar(1.5); world.add(R.root); R.root.userData.pick = { gate: id }; R.phase = i;
      gates.push({ id, strip, R }); });
    lamps([-12, -4, 4, 12], ZB + 3);
    return {
      out: { CAST: [], profile: () => null, portrait: () => "", focus() {}, feed() {} },
      mode: () => "lobby", pickables: () => world.children, onPick: (p) => p.gate && opts.onEnter?.(p.gate),
      step(dt, t) { gates.forEach((g, i) => { const R = g.R, ph = t + i; R.hips.position.y = 0.95 + Math.sin(ph * 1.4) * 0.02; R.head.rotation.y = Math.sin(ph * 0.4) * 0.3; g.strip.material.opacity = 0.55 + 0.25 * Math.sin(t * 1.2 + i);
        if (g.id === "gym") { R.hips.position.y = 0.62; R.legL.rotation.x = R.legR.rotation.x = -1.3; R.legL.shin.rotation.x = R.legR.shin.rotation.x = 2.2; R.torso.rotation.x = 0.35; R.armL.rotation.x = R.armR.rotation.x = -1.1; } });
        if (now > userUntil) goal.az = home().az + Math.sin(t * 0.08) * 0.12; },
    };
  }
  function hero(kind) { // lobby stand-ins: the wing leads
    if (kind === "yuji") { const R = VK.rig({ skin: "#ecc4a2", top: "#1c2240", bottom: "#1c2240", shoes: "#a8282e" }); VK.spikes(R.head, "#e8798a", 18, { len: 0.12, r: 0.06, el0: 0.35, elr: 0.9 });
      mesh(box(0.56, 0.14, 0.34), mat("#b52f37"), R.torso, 0, 0.72, -0.02); mesh(box(0.4, 0.3, 0.12), mat("#b52f37"), R.torso, 0, 0.62, -0.17); return R; }
    return (WINGS.basis.build[kind] || WINGS.gym.build[kind] || WINGS.etsy.build[kind])();
  }

  /* ================= a business wing ================= */
  function buildRooms() {
    const CAST = W.cast, BY = Object.fromEntries(CAST.map((c) => [c.id, c]));
    const corridorZ = (Z0 + 2.5) / 2;
    for (const [i, x] of [[0, -span / 2 + 3.5], [1, 0], [2, span / 2 - 3.5]]) geo.push(VK.inlay(world, (g, c) => (i === 1 ? VK.metatron(g, c, c, 105) : VK.flowerOfLife(g, c, c, 160)), x, corridorZ, 3.4));
    mesh(new THREE.PlaneGeometry(span, 0.2), new THREE.MeshStandardMaterial({ map: VK.hazard(), roughness: 0.8 }), world, 0, 0.012, 2.6, false).rotation.x = -Math.PI / 2;
    const lowM = mat("#46535a", { m: 0.4, r: 0.6 }), partM = new THREE.MeshStandardMaterial({ map: VK.steel(), roughness: 0.6, metalness: 0.35 });
    const TABLE = {}, ST = {}, D = {};
    order.forEach((id) => { const c = BY[id], x = RX[id], g = grp(world, x, 0, (Z0 + ZB) / 2);
      const fl = mesh(new THREE.PlaneGeometry(RW - 0.3, RD - 0.2), new THREE.MeshStandardMaterial({ color: VK.FLOORS[c.room.bd] || "#4a4640", map: VK.concrete(), roughness: 0.95 }), g, 0, 0.01, 0, false); fl.rotation.x = -Math.PI / 2;
      mesh(new THREE.PlaneGeometry(RW - 0.5, 3.1), new THREE.MeshBasicMaterial({ map: VK.backdrop(c.room.bd, c.room.variant), toneMapped: false, color: "#e8e8e8" }), g, 0, 1.75, -RD / 2 + 0.06, false);
      VK.props(g, c.room.bd, RW - 0.6, RD - 0.6);
      const dx = doorX(id) - x, a = -RW / 2, b = dx - 0.9, cc = dx + 0.9, e = RW / 2;
      mesh(box(b - a, 1.1, 0.25), lowM, g, (a + b) / 2, 0.55, RD / 2); mesh(box(e - cc, 1.1, 0.25), lowM, g, (cc + e) / 2, 0.55, RD / 2);
      for (const sx of [-1, 1]) { const p = mesh(box(0.16, 2.6, 0.3), new THREE.MeshStandardMaterial({ map: VK.hazard(), roughness: 0.8 }), g, dx + sx * 0.92, 1.3, RD / 2); p.material.map = VK.hazard().clone(); p.material.map.needsUpdate = true; p.material.map.rotation = Math.PI / 2; }
      mesh(box(2.0, 0.18, 0.3), mat("#2b3134", { m: 0.6 }), g, dx, 2.5, RD / 2);
      mesh(new THREE.PlaneGeometry(2.0, 0.52), new THREE.MeshStandardMaterial({ map: VK.plaqueTex(c.job, c.room.place, W.accent), roughness: 0.7 }), g, dx, 2.95, RD / 2 + 0.16, false);
      TABLE[id] = new THREE.Vector3(x - 2.3, 0.73, Z0 - 1.0);
      mesh(box(1.2, 0.06, 0.8), mat("#5c4a36"), world, TABLE[id].x, 0.7, TABLE[id].z); for (const [ax, az] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) mesh(box(0.06, 0.7, 0.06), mat("#3a2e22"), world, TABLE[id].x + ax, 0.35, TABLE[id].z + az);
      ST[id] = { queue: [], phase: "idle", item: null, wait: 0, credits: 0 }; });
    order.slice(0, -1).forEach((id) => mesh(box(0.3, 3.2, RD), partM, world, RX[id] + RW / 2, 1.6, (Z0 + ZB) / 2));
    mesh(box(0.3, 3.2, RD), partM, world, -span / 2, 1.6, (Z0 + ZB) / 2); mesh(box(0.3, 3.2, RD), partM, world, span / 2, 1.6, (Z0 + ZB) / 2);
    lamps(order.map((id) => RX[id]).filter((_, i) => i % 2 === 0), Z0 - 2.2);

    /* fighters */
    order.forEach((id, i) => { const c = BY[id], R = W.build[id](); const base = new THREE.Vector3(RX[id] - 1.1, 0, ZB + 2.6);
      R.root.position.copy(base); R.ry = 0.45; R.root.rotation.y = R.ry; R.base = base; world.add(R.root); R.root.userData.pick = { fighter: id }; VK.inkLayer(R.root);
      F[id] = Object.assign(R, { id, c, act: null, phase: rnd() * TAU, count: 0, last: "" }); });
    /* dummies: the opponent each one beat, back on its feet a few seconds after every hit */
    const makeDummy = (id, rise = true) => { const c = BY[id], d = VK.dummy(c.dummy.look); d.g.position.set(RX[id] + 1.2, 0, ZB + 2.9); d.g.rotation.y = -1.25; world.add(d.g);
      d.g.userData.pick = { dummy: id }; d.home = d.g.position.clone(); d.alive = true; VK.inkLayer(d.g); D[id] = d;
      if (rise) { d.g.position.y = -2; effect(0.9, (q) => (d.g.position.y = -2 + 2 * out(q))); burst(d.home.clone().setY(0.1), 10, ["#e0b21c", "#ffffff"], 2, { life: 0.5 }); } return d; };
    order.forEach((id) => makeDummy(id, false));
    const respawn = (id, sec = 3.2) => after(sec, () => { D[id]?.g.parent && D[id].g.parent.remove(D[id].g); makeDummy(id); });
    const shatter = (d, base, spread = 3, o = {}) => { const ps = []; d.g.traverse((m) => m.isMesh && m.material !== VK.targetMat() && ps.push(m));
      ps.forEach((m) => toss(m, base.clone().add(new THREE.Vector3((rnd() - 0.5) * spread, rnd() * spread * 0.8, (rnd() - 0.5) * spread)), null, o.life, o.grav)); d.g.parent?.remove(d.g); };
    const away = (id) => D[id].g.position.clone().sub(F[id].base).setY(0).normalize();
    const breakDummy = (id, style) => { const d = D[id]; if (!d?.alive) return; d.alive = false; const P = d.g.position.clone(), mid = P.clone().setY(1.1), col = BY[id].color;
      const ring = VK.dustRing(world, P.x, P.z); effect(0.6, (q) => { ring.scale.setScalar(0.3 + q * 1.6); ring.material.opacity = 0.6 * (1 - q); }, () => world.remove(ring));
      effect(0.08, (q) => d.g.scale.set(1 + 0.25 * q, 1 - 0.2 * q, 1 + 0.25 * q)); // squash on contact
      const go = () => { switch (style) {
        case "launch": burst(mid, 26, [col, "#e3be3a", "#111"], 6, { life: 0.7 }); shatter(d, away(id).multiplyScalar(9).setY(5), 4); break;
        case "slice": for (let i = 0; i < 6; i++) { const s = mesh(new THREE.PlaneGeometry(1.4, 0.02), glow(col, { side: THREE.DoubleSide }), world, P.x, 0.5 + rnd() * 1.4, P.z, false); s.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); effect(0.35, (q) => (s.material.opacity = 1 - q), () => world.remove(s)); }
          shatter(d, new THREE.Vector3(0, 1.2, 0), 2.4, { grav: -16 }); break;
        case "flatten": effect(0.18, (q) => d.g.scale.set(1 + q * 0.6, 1 - q * 0.85, 1 + q * 0.6), () => { burst(P.clone().setY(0.2), 22, ["#e3be3a", col], 4, { life: 0.6, up: 0.2 }); shatter(d, new THREE.Vector3(0, 0.6, 0), 3.2, { grav: -18 }); }); break;
        case "fall": effect(0.7, (q) => { d.g.rotation.x = -1.45 * ease(q); d.g.position.y = 0; }, () => { burst(P.clone().setY(0.2), 12, ["#e3be3a", "#ffffff"], 2, { life: 0.5, up: 0.1 }); after(1.0, () => effect(0.5, (q) => d.g.traverse((m) => m.isMesh && m.material.transparent && (m.material.opacity = 1 - q)), () => d.g.parent?.remove(d.g))); }); break;
        case "dust": after(0.3, () => { for (let i = 0; i < 40; i++) emit(P.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.5, rnd() * 1.8, (rnd() - 0.5) * 0.5)), new THREE.Vector3((rnd() - 0.5) * 0.6, 0.6 + rnd(), (rnd() - 0.5) * 0.6), "#d8d0c0", 1.6, 1.4, 0.4);
          effect(0.6, (q) => d.g.scale.set(1 - q, Math.max(0.02, 1 - q * 0.4), 1 - q), () => d.g.parent?.remove(d.g)); }); break;
        case "sink": effect(1.1, (q) => (d.g.position.y = -2.4 * ease(q)), () => d.g.parent?.remove(d.g)); break;
      } };
      after(0.08, go);
      after(style === "fall" ? 0.9 : style === "sink" ? 1.0 : 0.45, () => dropAt(id, P));
      respawn(id, style === "dust" || style === "sink" ? 4 : 3.4);
    };
    /* the hit itself: hold, shake, maybe one impact frame, then the dummy goes */
    const landHit = (id, style, o = {}) => { const c = BY[id];
      if (!calm) { stop = Math.max(stop, o.stop ?? 0.07); shake = Math.max(shake, o.shake ?? 0.2); }
      flash = Math.max(flash, o.flash ?? 0.08);
      if (!calm && c.impact && focusId === id && now - lastImpact > 8) { lastImpact = now; impact.fire(); }
      breakDummy(id, style); };

    /* items: the job, as a small crate with the wing's colour on its tag */
    const items = [];
    const makeItem = () => { const g = grp(world); const body = grp(g, 0, 0.32, 0); mesh(box(0.56, 0.48, 0.56), mat("#9a7448", { r: 0.85 }), body); for (const sx of [-1, 1]) mesh(box(0.06, 0.5, 0.58), mat("#5c4228"), body, sx * 0.26, 0, 0);
      const tag = mesh(box(0.22, 0.12, 0.02), glow(W.accent), body, 0, 0.1, 0.29, false); const shadow = mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0, depthWrite: false }), world, 0, 0.02, 0, false); shadow.rotation.x = -Math.PI / 2;
      const it = { g, body, tag, shadow, gone: false }; g.scale.setScalar(0.62); items.push(it); return it; };
    const restack = (id) => ST[id].queue.forEach((c, i) => { if (!c.carried) c.g.position.set(TABLE[id].x + (i % 2) * 0.3 - 0.15, TABLE[id].y, TABLE[id].z - (i % 2) * 0.1); });
    const place = (it, id) => { for (const k in ST) { const q = ST[k].queue, i = q.indexOf(it); if (i >= 0) q.splice(i, 1); } world.attach(it.g); it.g.scale.setScalar(0.62); it.g.rotation.set(0, 0, 0); it.g.visible = true; it.at = id; ST[id].queue.push(it); restack(id); };
    const newItem = (id, hidden) => { const it = makeItem(); it.g.visible = !hidden; it.at = id; ST[id].queue.push(it); restack(id); return it; };
    /* the drop: the job pops out of the broken dummy on an arc, squashes as it lands, bounces once, dust and a glint */
    const dropAt = (id, P) => { const st = ST[id]; if (st.phase !== "work") return; const it = st.item || makeItem(); st.item = it;
      world.attach(it.g); it.g.visible = true; it.g.scale.setScalar(0.62); const from = P.clone().setY(1.0), to = new THREE.Vector3(P.x - 0.7, 0.02, P.z + 0.9); it.g.rotation.y = rnd() * TAU;
      effect(0.55, (q) => { const h = Math.sin(Math.PI * Math.min(1, q / 0.8)) * 0.9 * (q < 0.8 ? 1 : 0) + (q >= 0.8 ? Math.sin(Math.PI * (q - 0.8) / 0.2) * 0.15 : 0);
          it.g.position.lerpVectors(from, to, Math.min(1, q / 0.8)); it.g.position.y = Math.max(0.02, (1 - Math.min(1, q / 0.8)) * 0.98 + h);
          const land = q > 0.78 && q < 0.9 ? Math.sin((q - 0.78) / 0.12 * Math.PI) : 0; it.g.scale.set(0.62 * (1 + land * 0.3), 0.62 * (1 - land * 0.35), 0.62 * (1 + land * 0.3));
          it.shadow.position.set(it.g.position.x, 0.02, it.g.position.z); it.shadow.material.opacity = 0.15 + 0.3 * Math.min(1, q / 0.8); },
        () => { it.g.scale.setScalar(0.62); const r = VK.dustRing(world, to.x, to.z); effect(0.45, (q) => { r.scale.setScalar(0.2 + q * 0.6); r.material.opacity = 0.5 * (1 - q); }, () => world.remove(r));
          const gl = mesh(ball(0.05, 0), glow("#fff7d0"), world, to.x + 0.15, 0.55, to.z + 0.15, false); effect(0.5, (q) => { gl.scale.setScalar(1 + q * 2); gl.material.opacity = 1 - q; }, () => world.remove(gl)); it.shadow.material.opacity = 0.35; st.phase = "pick"; });
      burst(from, 10, ["#ffd34a", "#ffffff"], 2.2, { life: 0.45 }); };

    /* moves: one small timeline per fighter, built from the move kind in vault-wings.js */
    const play = (id, dur, fn, end) => { const f = F[id]; if (f.act) { const e = f.act.end; f.act = null; e && e(f); VK.resetPose(f); } f.act = { t: 0, dur, fn, end, hit: false }; };
    const log = (id, line) => { const f = F[id]; f.count++; f.last = line; opts.onEvent?.(id, line); };
    const hitOnce = (f, u, at, fn) => { if (!f.act.hit && u >= at) { f.act.hit = true; fn(); } };
    const toward = (f) => { const d = D[f.id]; return d ? d.home.clone() : f.base.clone().add(new THREE.Vector3(2, 0, 0)); };
    const handPos = (f, side = "armR") => { f.root.updateMatrixWorld(true); return worldOf(f[side].hand); };
    const LINES = { shikamaru: "Planned the day", lee: "Logged the session", minato: "Timed the run", choji: "Logged the meal", sakura: "Scored recovery", kakashi: "Spotted a record", guy: "Answered a question", neji: "Checked a post", naruto: "Sent an invite",
      ryuk: "Counted an entry", misa: "Read the scan", l: "Matched the entry", mello: "Sent the alert", near: "Wrote it into the report", rem: "Ran the privacy purge",
      bulma: "Scored a trend", goku: "Built the product", gohan: "Wrote the listing", piccolo: "Passed QA", trunks: "Listed it", vegeta: "Logged the sale", dende: "Drafted a reply", whis: "Graded the crew" };
    const MOVE = {
      dash(f) { const c = f.c, P0 = f.base.clone(), T = toward(f), dir = T.clone().sub(P0).setY(0).normalize(), hitAt = T.clone().addScaledVector(dir, -0.75); let orb = null, trail = null;
        play(f.id, 1.6, (u, R) => { const wind = bump(u, 0, 0.3), go = bump(u, 0.3, 0.42), back = bump(u, 0.62, 0.95);
          R.root.position.lerpVectors(P0, hitAt, ease(go) * (1 - ease(back))); R.root.scale.set(1 + 0.12 * (go > 0 && go < 1 ? 1 : 0), 1 - 0.06 * (go > 0 && go < 1 ? 1 : 0), 1);
          R.hips.position.y = 0.95 - 0.22 * wind * (1 - go); R.torso.rotation.x = 0.35 * wind + 0.2 * go * (1 - back);
          if (c.kick) { R.legR.rotation.x = -1.6 * go * (1 - back) + 0.5 * wind * (1 - go); R.legL.rotation.x = 0.3 * go * (1 - back); R.armL.rotation.x = 0.8 * go * (1 - back); R.armR.rotation.x = -0.6 * wind; }
          else { R.armR.rotation.x = 0.9 * wind * (1 - go) - 1.5 * go * (1 - back); R.armR.fore.rotation.x = -1.2 * wind * (1 - go); R.armL.rotation.x = -0.8 * wind; R.legL.rotation.x = -1.0 * wind * (1 - go) - 1.0 * go * (1 - back); R.legR.rotation.x = 0.6 * wind; }
          if (c.chidori && u > 0.05 && !orb) { orb = mesh(ball(0.12, 1), glow(c.color), world); orb.add(mesh(ball(0.24, 1), glow(c.color, { op: 0.35 }), world)); }
          if (orb) { orb.position.copy(handPos(R)); orb.scale.setScalar(1 + Math.sin(now * 50) * 0.15); if (rnd() < 0.6) burst(orb.position, 1, [c.color, "#ffffff"], 2.5, { life: 0.2, grav: 0 }); }
          if (go > 0.05 && !trail) { const hp = handPos(R, c.kick ? "armL" : "armR"), a = P0.clone().setY(hp.y - (c.kick ? 0.4 : 0)), b = hitAt.clone().setY(hp.y - (c.kick ? 0.4 : 0)); trail = VK.smear(world, VK.arc(a, b, -0.15), c.color, 0.22); effect(0.35, (q) => (trail.material.opacity = 1 - q), () => world.remove(trail)); }
          hitOnce(R, u, 0.42, () => { landHit(f.id, c.kick ? "launch" : "launch", { shake: 0.28 }); burst(T.clone().setY(1.1), 24, [c.color, "#ffffff"], 5, { life: 0.4 }); if (orb) { world.remove(orb); orb = null; } });
        }, () => { orb && world.remove(orb); }); },
      blink(f) { const c = f.c, P0 = f.base.clone(), T = toward(f), behind = T.clone().add(T.clone().sub(P0).setY(0).normalize().multiplyScalar(0.8));
        const poof = (p) => { burst(p.clone().setY(1), 16, [c.color, "#ffffff"], 3, { life: 0.35, grav: 0 }); const r = VK.dustRing(world, p.x, p.z, c.color); effect(0.3, (q) => { r.scale.setScalar(0.3 + q); r.material.opacity = 0.7 * (1 - q); }, () => world.remove(r)); };
        play(f.id, 1.7, (u, R) => { const gone = (u > 0.2 && u < 0.3) || (u > 0.68 && u < 0.76); R.root.visible = !gone;
          if (u > 0.2 && !R.act.p1) { R.act.p1 = 1; poof(P0); } if (u > 0.3 && !R.act.p2) { R.act.p2 = 1; poof(behind); R.root.position.copy(behind); }
          if (u > 0.68 && !R.act.p3) { R.act.p3 = 1; poof(behind); } if (u > 0.76 && !R.act.p4) { R.act.p4 = 1; poof(P0); R.root.position.copy(P0); }
          const s = bump(u, 0.34, 0.42) * (1 - bump(u, 0.5, 0.6)); R.armR.rotation.x = -1.4 * s; R.armR.rotation.z = c.tap ? 0.6 * s : 0; R.torso.rotation.y = -0.4 * s;
          hitOnce(R, u, 0.42, () => landHit(f.id, c.tap ? "fall" : "launch", { shake: 0.15 })); }, (R) => { R.root.visible = true; R.root.position.copy(P0); }); },
      beam(f) { const c = f.c, T = toward(f); let orb = null, beam = null, len = 0;
        play(f.id, 2.3, (u, R) => { const ch = bump(u, 0, 0.45), fire = bump(u, 0.45, 0.5), done = bump(u, 0.75, 0.95);
          R.torso.rotation.y = 0.6 * ch * (1 - fire); R.hips.position.y = 0.95 - 0.12 * ch; R.armL.rotation.x = R.armR.rotation.x = -0.6 * ch * (1 - fire) - 1.5 * fire * (1 - done); R.armL.rotation.z = 0.3 * ch; R.armR.rotation.z = -0.3 * ch;
          const hp = handPos(R).lerp(handPos(R, "armL"), 0.5); if (!orb && u > 0.05) orb = mesh(ball(0.1, 1), glow(c.color), world);
          if (orb) { orb.position.copy(hp); orb.scale.setScalar(0.5 + 2.2 * ch * (1 - done)); if (ch < 1 && rnd() < 0.5) emit(hp.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2)), new THREE.Vector3(0, 0, 0), c.color, 0.3, 0.8, 0); }
          if (fire > 0 && !beam) { const dir = T.clone().setY(hp.y).sub(hp); len = dir.length() + 0.4; beam = grp(world); beam.position.copy(hp); beam.quaternion.setFromUnitVectors(UP, dir.normalize());
            mesh(cyl(c.thin ? 0.08 : 0.22, c.thin ? 0.08 : 0.22, 1, 10), glow(c.color, { op: 0.9 }), beam, 0, 0.5, 0, false); mesh(cyl(c.thin ? 0.03 : 0.1, c.thin ? 0.03 : 0.1, 1, 8), glow("#ffffff"), beam, 0, 0.5, 0, false);
            if (c.spiral) for (let i = 0; i < 18; i++) { const a = i * 0.9; mesh(box(0.04, 0.12, 0.04), glow(c.color), beam, Math.cos(a) * 0.18, i / 18, Math.sin(a) * 0.18, false); } }
          if (beam) { beam.scale.set(1 + Math.sin(now * 40) * 0.08, len * out(bump(u, 0.45, 0.52)), 1 + Math.sin(now * 40) * 0.08); beam.children.forEach((m) => (m.material.opacity = 1 - done)); }
          hitOnce(R, u, 0.52, () => { landHit(f.id, "launch", { shake: 0.35, flash: 0.18, stop: 0.09 }); burst(T.clone().setY(1.1), 30, [c.color, "#ffffff"], 6, { life: 0.6 }); });
        }, () => { orb && world.remove(orb); beam && world.remove(beam); }); },
      orb(f) { const c = f.c, P0 = f.base.clone(), T = toward(f), hitAt = T.clone().addScaledVector(T.clone().sub(P0).setY(0).normalize(), -0.7); let orb = null;
        play(f.id, 1.9, (u, R) => { const ch = bump(u, 0, 0.4), go = bump(u, 0.4, 0.55), back = bump(u, 0.7, 0.95); R.root.position.lerpVectors(P0, hitAt, ease(go) * (1 - ease(back)));
          R.armR.rotation.x = -1.2 * ch - 0.3 * go * (1 - back); R.armL.rotation.x = -0.9 * ch * (1 - go); R.legL.rotation.x = Math.sin(u * 40) * 0.6 * (go > 0 && go < 1 ? 1 : 0); R.legR.rotation.x = -R.legL.rotation.x;
          if (!orb && u > 0.04) { orb = grp(world); mesh(ball(0.14, 1), glow("#e8f6ff"), orb); for (let i = 0; i < 3; i++) { const t = mesh(new THREE.TorusGeometry(0.22, 0.015, 4, 20), glow(c.color, { op: 0.7 }), orb, 0, 0, 0, false); t.rotation.set(i, i * 1.3, 0); t.userData.spin = i; } }
          if (orb) { orb.position.copy(handPos(R)).add(new THREE.Vector3(0, 0.05, 0.1)); orb.scale.setScalar(0.4 + ch * 1.2 + (u > 0.55 ? (u - 0.55) * 4 : 0)); orb.children.forEach((m) => m.userData.spin != null && (m.rotation.y += 0.4)); }
          hitOnce(R, u, 0.55, () => { landHit(f.id, "launch", { shake: 0.3, flash: 0.14 }); burst(T.clone().setY(1.1), 30, [c.color, "#ffffff"], 6, { life: 0.5 }); after(0.15, () => { orb && world.remove(orb); orb = null; }); });
        }, () => { orb && world.remove(orb); }); },
      slash(f) { const c = f.c, P0 = f.base.clone(), T = toward(f), hitAt = T.clone().addScaledVector(T.clone().sub(P0).setY(0).normalize(), -0.9);
        play(f.id, 1.8, (u, R) => { const go = bump(u, 0.15, 0.3), back = bump(u, 0.7, 0.95); R.root.position.lerpVectors(P0, hitAt, ease(go) * (1 - ease(back)));
          const sw = bump(u, 0.32, 0.62); R.armR.rotation.x = -2.6 + Math.sin(sw * Math.PI * 3) * 1.6 * (sw > 0 && sw < 1 ? 1 : 0); R.armR.rotation.z = Math.cos(sw * Math.PI * 3) * 0.6;
          if (R.sword) { R.sword.visible = !(sw > 0 && sw < 1); }
          [0.36, 0.46, 0.56].forEach((t, i) => { if (u > t && !R.act["s" + i]) { R.act["s" + i] = 1; const a = T.clone().add(new THREE.Vector3(-0.8, 0.4 + i * 0.4, -0.6)), b = T.clone().add(new THREE.Vector3(0.8, 1.6 - i * 0.4, 0.6)); const s = VK.smear(world, VK.arc(a, b, 0.3), c.color, 0.12); effect(0.3, (q) => (s.material.opacity = 1 - q), () => world.remove(s)); } });
          hitOnce(R, u, 0.6, () => landHit(f.id, "slice", { shake: 0.2 })); }, (R) => { if (R.sword) R.sword.visible = true; }); },
      smash(f) { const c = f.c, P0 = f.base.clone(), T = toward(f), at = T.clone().addScaledVector(T.clone().sub(P0).setY(0).normalize(), -0.9);
        play(f.id, 2.0, (u, R) => { const up1 = bump(u, 0.15, 0.4), down = bump(u, 0.4, 0.5), back = bump(u, 0.72, 0.95); const big = c.big ? 1 + 0.6 * Math.sin(Math.PI * bump(u, 0.1, 0.8)) : 1;
          R.root.position.lerpVectors(P0, at, ease(up1) * (1 - ease(back))); R.root.position.y = Math.sin(Math.PI * Math.min(1, (up1 + down) / 2)) * 1.4 * (1 - down) ; R.root.scale.setScalar(big);
          R.armR.rotation.x = -2.8 * up1 * (1 - down) - 1.2 * down * (1 - back); R.armL.rotation.x = -2.8 * up1 * (1 - down);
          hitOnce(R, u, 0.5, () => { landHit(f.id, "flatten", { shake: 0.45, stop: 0.09 }); const cr = VK.dustRing(world, T.x, T.z, "#4a3a2c"); cr.material.opacity = 0.9; effect(1.6, (q) => { cr.scale.setScalar(0.5 + q * 1.8); cr.material.opacity = 0.9 * (1 - q); }, () => world.remove(cr));
            for (let i = 0; i < 8; i++) { const r = mesh(box(0.18, 0.12, 0.18), mat("#6a5a4a"), world, T.x, 0.1, T.z); toss(r, new THREE.Vector3((rnd() - 0.5) * 5, 3 + rnd() * 3, (rnd() - 0.5) * 5), null, 1.6, -14); } burst(T.clone().setY(0.3), 26, [c.color, "#d8cdb6"], 5, { life: 0.6, up: 0.3 }); });
        }, (R) => R.root.scale.setScalar(1)); },
      shadow(f) { const c = f.c, T = toward(f); let line = null;
        play(f.id, 2.3, (u, R) => { const sign = bump(u, 0, 0.25); R.hips.position.y = 0.95 - 0.25 * sign; R.armL.rotation.x = R.armR.rotation.x = -1.3 * sign; R.armL.rotation.z = 0.5 * sign; R.armR.rotation.z = -0.5 * sign;
          if (u > 0.25 && !line) { const a = f.base.clone(), d = T.clone().sub(a).setY(0), L = d.length(); line = mesh(new THREE.PlaneGeometry(0.22, 1), new THREE.MeshBasicMaterial({ color: "#050507", transparent: true, opacity: 0.85, depthWrite: false }), world, 0, 0.03, 0, false);
            line.rotation.x = -Math.PI / 2; line.rotation.z = -Math.atan2(d.x, -d.z) + Math.PI; line.userData = { a, d, L }; }
          if (line) { const k = out(bump(u, 0.25, 0.45)), { a, d, L } = line.userData; line.scale.y = Math.max(0.01, L * k); line.position.copy(a).addScaledVector(d, k / 2).setY(0.03); line.material.opacity = 0.85 * (1 - bump(u, 0.85, 1)); }
          const dm = D[f.id]; if (dm?.alive && u > 0.45) { dm.upper.rotation.x = 0.2 * Math.sin(now * 30) * (1 - bump(u, 0.6, 0.62)); }
          hitOnce(R, u, 0.62, () => landHit(f.id, "sink", { shake: 0.15, flash: 0.04 })); }, () => line && world.remove(line)); },
      palms(f) { const c = f.c, P0 = f.base.clone(), T = toward(f), at = T.clone().addScaledVector(T.clone().sub(P0).setY(0).normalize(), -0.8);
        play(f.id, 2.0, (u, R) => { const go = bump(u, 0.05, 0.2), back = bump(u, 0.78, 0.98), rap = u > 0.2 && u < 0.72; R.root.position.lerpVectors(P0, at, ease(go) * (1 - ease(back)));
          R.hips.position.y = 0.95 - 0.2 * (rap ? 1 : 0); R.armR.rotation.x = rap ? -1.5 + Math.sin(u * 120) * 0.4 : 0; R.armL.rotation.x = rap ? -1.5 - Math.sin(u * 120) * 0.4 : 0;
          if (rap && rnd() < 0.5) emit(T.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.4, 0.6 + rnd() * 1, 0.2)), new THREE.Vector3(0, 0, 0), c.color, 0.2, 1.2, 0);
          hitOnce(R, u, 0.72, () => landHit(f.id, "fall", { shake: 0.15 })); }); },
      write(f) { const c = f.c; let txt = null;
        play(f.id, 2.6, (u, R) => { const open = bump(u, 0, 0.15), wr = u > 0.15 && u < 0.5; R.armL.rotation.x = -1.2 * open; R.armL.fore.rotation.x = -0.6 * open; R.armR.rotation.x = -1.0 * open; R.armR.fore.rotation.x = -0.7 * open + (wr ? Math.sin(u * 90) * 0.15 : 0); R.head.rotation.x = 0.3 * open;
          if (R.prop) R.prop.material = wr ? mat("#121214", { e: c.color, ei: 0.25 }) : mat("#121214");
          if (u > 0.5 && !txt) { const d = D[f.id]; if (d?.alive) { txt = nameTag(c.dummy.name, c.color); txt.position.copy(d.home).setY(2.5); world.add(txt); } }
          if (txt) txt.material.opacity = Math.min(1, (u - 0.5) * 6) * (1 - bump(u, 0.85, 1));
          const d = D[f.id]; if (d?.alive && u > 0.56) { const k = bump(u, 0.56, 0.72); d.upper.rotation.x = 0.4 * k; d.upper.children.forEach((m, i) => i > 3 && i < 6 && (m.rotation.x = -1.2 * k)); }
          hitOnce(R, u, 0.74, () => landHit(f.id, f.id === "rem" ? "dust" : "fall", { shake: 0.08, flash: 0.04, stop: 0.05 })); }, () => txt && world.remove(txt)); },
      glare(f) { const c = f.c; let txt = null, eyes = [];
        play(f.id, 2.2, (u, R) => { const k = bump(u, 0, 0.2); R.head.rotation.y = -0.2 * k; R.armR.rotation.x = -0.4 * k; R.armR.rotation.z = 1.2 * k; R.armR.fore.rotation.x = -2.2 * k;
          if (u > 0.15 && !eyes.length) for (const sx of [-1, 1]) { const e = mesh(box(0.05, 0.04, 0.02), glow(c.color), R.head, sx * 0.065, 0.01, 0.18, false); eyes.push(e); }
          if (u > 0.3 && !txt) { const d = D[f.id]; if (d?.alive) { txt = nameTag(c.dummy.name, c.color); txt.position.copy(d.home).setY(2.5); world.add(txt); } }
          if (txt) txt.material.opacity = Math.min(1, (u - 0.3) * 6) * (1 - bump(u, 0.85, 1));
          hitOnce(R, u, 0.62, () => landHit(f.id, "fall", { shake: 0.06, flash: 0.04 })); }, (R) => { eyes.forEach((e) => R.head.remove(e)); txt && world.remove(txt); }); },
      blast(f) { const c = f.c, T = toward(f); let bomb = null;
        play(f.id, 1.9, (u, R) => { const th = bump(u, 0, 0.25); R.armR.rotation.x = 1.2 * th * (1 - bump(u, 0.25, 0.32)) - 1.6 * bump(u, 0.25, 0.32) * (1 - bump(u, 0.5, 0.8)); R.torso.rotation.y = 0.4 * th;
          if (u > 0.3 && !bomb) { bomb = mesh(box(0.12, 0.12, 0.12), mat("#3a3a3a"), world); bomb.userData.a = handPos(R); }
          if (bomb) { const k = bump(u, 0.3, 0.45); bomb.position.lerpVectors(bomb.userData.a, T.clone().setY(0.2), k); bomb.position.y += Math.sin(k * Math.PI) * 1.2; bomb.rotation.x += 0.3; }
          hitOnce(R, u, 0.46, () => { if (bomb) { world.remove(bomb); bomb = null; } const P = T.clone().setY(0.8); const s = mesh(ball(0.5, 1), glow("#ffb04a", { op: 0.9 }), world, P.x, P.y, P.z, false);
            effect(0.5, (q) => { s.scale.setScalar(1 + q * 3); s.material.opacity = 0.9 * (1 - q); }, () => world.remove(s)); burst(P, 40, ["#ff9a3a", "#ffd34a", "#3a3a3a"], 7, { life: 0.8 }); landHit(f.id, "launch", { shake: 0.5, flash: 0.22, stop: 0.09 }); });
        }, () => bomb && world.remove(bomb)); },
      puzzle(f) { const c = f.c, T = toward(f), blocks = [];
        play(f.id, 2.2, (u, R) => { R.armR.rotation.x = -1.0 * bump(u, 0, 0.2); R.armR.fore.rotation.x = -1.0 * bump(u, 0, 0.2); R.head.rotation.x = 0.2;
          if (u > 0.12 && blocks.length < 9 && rnd() < 0.5) { const b = mesh(box(0.22, 0.22, 0.22), mat(["#f2f2f2", "#e04a4a", "#4a8ae0", "#e0c23a"][blocks.length % 4]), world, T.x + (rnd() - 0.5) * 0.5, 4 + rnd(), T.z + (rnd() - 0.5) * 0.5); b.userData.v = 0; blocks.push(b); }
          blocks.forEach((b) => { if (b.position.y > 0.12) { b.userData.v -= 0.05; b.position.y = Math.max(0.12, b.position.y + b.userData.v * 0.3); b.rotation.x += 0.1; } });
          hitOnce(R, u, 0.58, () => landHit(f.id, "flatten", { shake: 0.2 })); }, () => blocks.forEach((b) => toss(b, new THREE.Vector3((rnd() - 0.5) * 2, 1, (rnd() - 0.5) * 2), null, 1.2))); },
      ping(f) { const c = f.c, T = toward(f); let cap = null;
        play(f.id, 2.3, (u, R) => { R.armL.rotation.x = -1.2 * bump(u, 0, 0.15) * (1 - bump(u, 0.4, 0.5));
          [0.08, 0.18, 0.28].forEach((t, i) => { if (u > t && !R.act["r" + i]) { R.act["r" + i] = 1; const r = VK.dustRing(world, f.base.x, f.base.z, c.color); effect(0.8, (q) => { r.scale.setScalar(0.5 + q * 4); r.material.opacity = 0.7 * (1 - q); }, () => world.remove(r)); } });
          if (u > 0.42 && !cap) { cap = mesh(ball(0.07, 1), mat("#e8e4d8"), world); cap.userData.a = handPos(R); }
          if (cap) { const k = bump(u, 0.42, 0.55); cap.position.lerpVectors(cap.userData.a, T.clone().setY(2.6), k); cap.position.y += Math.sin(k * Math.PI) * 0.8; }
          hitOnce(R, u, 0.56, () => { if (cap) { world.remove(cap); cap = null; } burst(T.clone().setY(2.6), 20, ["#ffffff", "#d8d8d8"], 3, { life: 0.6, grav: -1 });
            const m = mesh(box(0.8, 0.6, 0.8), mat("#e8eef2", { m: 0.4 }), world, T.x, 2.6, T.z); effect(0.25, (q) => (m.position.y = 2.6 - 2.2 * q * q), () => { landHit(f.id, "flatten", { shake: 0.3 }); toss(m, new THREE.Vector3(1, 2, 0.5), null, 1.6); }); });
        }, () => cap && world.remove(cap)); },
      heal(f) { const c = f.c, T = toward(f); let wall = null;
        play(f.id, 2.1, (u, R) => { const k = bump(u, 0, 0.25); R.armL.rotation.x = R.armR.rotation.x = -1.4 * k; R.armL.rotation.z = 0.2 * k; R.armR.rotation.z = -0.2 * k;
          if (u > 0.25 && !wall) { wall = mesh(new THREE.PlaneGeometry(1.4, 2.2), glow(c.color, { op: 0.5, side: THREE.DoubleSide }), world, f.base.x, 1.1, f.base.z, false); wall.lookAt(T.clone().setY(1.1)); wall.userData.a = f.base.clone().setY(1.1); }
          if (wall) { const q = bump(u, 0.25, 0.55); wall.position.lerpVectors(wall.userData.a, T.clone().setY(1.1), q); wall.material.opacity = 0.5 * (1 - bump(u, 0.6, 0.8)); }
          hitOnce(R, u, 0.55, () => landHit(f.id, "fall", { shake: 0.1, flash: 0.06 })); }, () => wall && world.remove(wall)); },
    };
    const nameTag = (name, color) => { const t = tex(512, 96, (g, w, h) => { g.fillStyle = color; g.font = "600 56px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(name, w / 2, h / 2); });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false })); s.scale.set(1.6, 0.3, 1); s.renderOrder = 20; return s; };
    const run = (id) => { const f = F[id]; focus(id, 2.8); title(f.c.move, `${f.c.name} · ${f.c.job}`); MOVE[f.c.kind](f); };

    /* flow: a job goes room to room along the chain; solo rooms work on their own clock */
    let mode = "demo"; const live = { seen: new Set(), queue: [] };
    const walkTo = (f, pts, done) => { f.walk = { pts: pts.map((p) => new THREE.Vector3(p[0], 0, p[1])), i: 0, done, t: 0 }; };
    const route = (from, to, end) => { const lane = doorX(to) > doorX(from) ? Z0 + 1.0 : Z0 + 2.0; return [[doorX(from), Z0 - 0.6], [doorX(from), lane], [doorX(to), lane], [doorX(to), Z0 - 0.6], end]; };
    const carry = (f, it) => { f.carry = it; it.carried = true; it.shadow.material.opacity = 0; f.torso.attach(it.g); it.g.position.set(0, 0.3, 0.42); it.g.rotation.set(0, 0, 0); it.g.scale.setScalar(0.62 / f.root.scale.x); };
    const next = (id) => { const i = W.chain.indexOf(id); return i >= 0 && i < W.chain.length - 1 ? W.chain[i + 1] : null; };
    const startWork = (id, it) => { const st = ST[id]; st.phase = "work"; st.item = it || null; if (it) { const q = st.queue, i = q.indexOf(it); if (i >= 0) q.splice(i, 1); it.g.visible = false; } run(id); };
    const finish = (id) => { const st = ST[id], it = st.item; st.item = null; st.phase = "idle"; if (it) effect(0.6, (q) => { it.g.position.y += 0.04; it.g.scale.setScalar(0.62 * (1 - q)); it.shadow.material.opacity = 0.35 * (1 - q); }, () => (it.gone = true)); };
    const stepRooms = (dt) => {
      for (const id of order) { const st = ST[id], f = F[id], d = D[id];
        const ready = !f.act && !f.walk && d && d.alive && d.g.position.y > -0.05;
        if (st.phase === "idle" && ready && st.queue.length && (mode === "demo" || st.credits > 0)) { if (mode === "live") st.credits--; startWork(id, st.queue[0]); }
        else if (st.phase === "work" && !f.act) { st.wait += dt; if (st.wait > 2.5) { st.wait = 0; dropAt(id, (d?.home || f.base).clone()); } }
        else if (st.phase === "pick" && !f.act && !f.walk) { st.wait = 0; const it = st.item, to = next(id);
          if (!to) { log(id, LINES[id]); finish(id); continue; }
          st.phase = "carry"; const T = TABLE[to];
          walkTo(f, [[it.g.position.x - 0.5, it.g.position.z + 0.3]], () => { play(id, 0.45, (u, R) => { const k = Math.sin(u * Math.PI); R.hips.position.y = 0.95 - 0.3 * k; R.torso.rotation.x = 0.5 * k; R.armL.rotation.x = R.armR.rotation.x = -0.8 * k; }, () => {
            carry(f, it); log(id, `${LINES[id]}, taking it to ${BY[to].name}`);
            walkTo(f, route(id, to, [T.x + 0.9, T.z]), () => { f.carry = null; it.carried = false; place(it, to); st.item = null; st.phase = "return";
              walkTo(f, route(to, id, [f.base.x, f.base.z]).concat([[f.base.x, f.base.z]]), () => { st.phase = "idle"; VK.resetPose(f); }); }); }); });
        } }
      for (let i = items.length - 1; i >= 0; i--) if (items[i].gone) { const it = items[i]; it.g.parent?.remove(it.g); world.remove(it.shadow); for (const k in ST) { const q = ST[k].queue, j = q.indexOf(it); if (j >= 0) q.splice(j, 1); } items.splice(i, 1); }
    };
    const walkStep = (f, dt) => { const w = f.walk, tgt = w.pts[w.i], p = f.root.position, d = tgt.clone().sub(p).setY(0), L = d.length();
      if (L < 0.06) { w.i++; if (w.i >= w.pts.length) { f.walk = null; f.walkYaw = null; w.done && w.done(); } return; }
      const sp = (f.root.scale.x > 1.3 ? 2.0 : 2.6) * dt; p.addScaledVector(d.normalize(), Math.min(sp, L)); f.walkYaw = Math.atan2(d.x, d.z);
      w.t += dt; const sw = Math.sin(w.t * 9) * 0.6; f.legL.rotation.x = sw; f.legR.rotation.x = -sw; f.hips.position.y = 0.95 + Math.abs(Math.cos(w.t * 9)) * 0.04;
      if (f.carry) { f.armL.rotation.set(-1.15, 0, 0.25); f.armR.rotation.set(-1.15, 0, -0.25); } else { f.armL.rotation.x = -sw * 0.7; f.armR.rotation.x = sw * 0.7; } };
    let tSpawn = 1; const tSolo = Object.fromEntries(W.solo.map((id, i) => [id, 9 + i * 7]));
    const demoTick = (dt) => { tSpawn -= dt; if (tSpawn <= 0 && ST[W.chain[0]].queue.length < 1 && items.length < 7) { newItem(W.chain[0], true); tSpawn = 7 + rnd() * 4; }
      for (const id of W.solo) { tSolo[id] -= dt; if (tSolo[id] <= 0 && ST[id].phase === "idle" && !F[id].act) { newItem(id, true); tSolo[id] = 18 + rnd() * 12; } } };
    const idle = (f, t) => { const R = f, ph = f.phase + t; R.hips.position.y = 0.95 + Math.sin(ph * 1.3) * 0.015; R.head.rotation.y = Math.sin(ph * 0.35) * 0.35;
      if (f.id === "l") { R.hips.position.y = 0.62; R.legL.rotation.x = R.legR.rotation.x = -1.3; R.legL.shin.rotation.x = R.legR.shin.rotation.x = 2.2; R.torso.rotation.x = 0.35; R.armL.rotation.x = R.armR.rotation.x = -1.1; }
      else if (f.id === "kakashi" || f.id === "near") { R.armL.rotation.x = -0.9; R.armL.fore.rotation.x = -0.6; R.head.rotation.x = 0.2; }
      else if (f.id === "ryuk" || f.id === "rem") { R.root.position.y = 0.25 + Math.sin(ph) * 0.08; }
      else if (f.id === "lee" || f.id === "guy") { R.armL.rotation.x = -0.4 + Math.sin(ph * 6) * 0.3; R.armR.rotation.x = -0.4 - Math.sin(ph * 6) * 0.3; R.hips.position.y = 0.95 + Math.abs(Math.sin(ph * 6)) * 0.04; }
      else if (f.id === "shikamaru") { R.armL.rotation.set(-0.3, 0, 0.6); R.armR.rotation.set(-0.3, 0, -0.6); R.armL.fore.rotation.x = R.armR.fore.rotation.x = -2.0; } };
    order.forEach((id) => { if (W.chain.includes(id) && id !== W.chain[0] && rnd() < 0.5) newItem(id); }); // warm start: a few jobs already waiting

    /* tags: the acting fighter's name floats over them */
    const tags = {}; if (opts.labels !== false) for (const id of order) { const el = document.createElement("div"); el.className = "vault-tag"; el.textContent = `${BY[id].name} · ${BY[id].job}`; container.append(el); tags[id] = el; }
    const _v = new THREE.Vector3();
    const placeTags = () => { const r = canvas.getBoundingClientRect(); for (const id in tags) { const f = F[id], el = tags[id], on = !!f.act; el.classList.toggle("on", on); if (!on) continue;
      _v.copy(worldOf(f.head)); _v.y += 0.6 * f.root.scale.x; _v.project(camera); if (_v.z > 1 || Math.abs(_v.x) > 1.05 || _v.y < -1 || (-_v.y * 0.5 + 0.5) * r.height < 76) { el.classList.remove("on"); continue; }
      el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * r.width}px, ${(-_v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`; } };

    const profile = (id) => ({ ...BY[id], place: BY[id].room.place, beat: BY[id].dummy.name, count: F[id].count, lastLine: F[id].last, portrait: () => portrait(id) });
    const portrait = (id) => { const f = F[id]; if (!f.act) VK.resetPose(f); f.root.updateMatrixWorld(true); const y = worldOf(f.head).y - f.root.position.y; return portraitOf(f.root, y, f.root.scale.x); };
    const dummyProfile = (id) => { const c = BY[id], d = c.dummy; return { id, dummy: true, name: d.name, job: `Beaten by ${c.name}`, look: d.full, who: d.who, breaks: d.breaks, place: c.room.place, honest: !!d.honest, count: F[id].count,
      portrait: () => { const dd = VK.dummy(d.look); return portraitOf(dd.g, 1.77, 1); } }; };
    return {
      out: { CAST, profile, portrait, dummyProfile, wing: W,
        focus(id) { userUntil = 0; focus(id, 1e9, { r: 6, el: 0.24, ty: 1.2, az: -0.35, dx: 0.2, pri: 3 }); },
        // rows from that business's event log, newest last ({id, step}); once any arrive the demo stops and only real events play
        feed(rows) { const fresh = rows.filter((r) => !live.seen.has(r.id)); fresh.forEach((r) => live.seen.add(r.id)); if (!rows.length) return;
          if (mode === "demo") { mode = "live"; items.forEach((it) => (it.gone = true)); }
          fresh.forEach((r) => { const id = r.step && BY[r.step] ? r.step : null; if (!id) return; ST[id].credits++; if (!ST[id].queue.length && ST[id].phase === "idle") newItem(id, true); }); } },
      mode: () => mode,
      pickables: () => [...Object.values(F).map((f) => f.root), ...Object.values(D).map((d) => d.g)],
      onPick(p) { if (p.fighter) { userUntil = 0; focus(p.fighter, 1e9, { r: 6, el: 0.24, ty: 1.2, az: -0.35, dx: 0.2, pri: 3 }); userUntil = now + 20; opts.onPick?.(profile(p.fighter)); }
        else if (p.dummy) { userUntil = 0; focus(p.dummy, 1e9, { r: 6, el: 0.24, ty: 1.2, az: -0.2, dx: 2.2, pri: 3 }); userUntil = now + 20; opts.onPick?.(dummyProfile(p.dummy)); } },
      step(dt) { if (mode === "demo") demoTick(dt); stepRooms(dt);
        for (const f of Object.values(F)) { const d = D[f.id], want = f.walkYaw != null ? f.walkYaw : f.act && d?.g.parent ? Math.atan2(d.home.x - f.root.position.x, d.home.z - f.root.position.z) : f.walk ? f.root.rotation.y : f.ry;
          let da = ((want - f.root.rotation.y + Math.PI) % TAU + TAU) % TAU - Math.PI; f.root.rotation.y += da * Math.min(1, dt * 9);
          if (f.walk && !f.act) { walkStep(f, dt); continue; }
          if (f.act) { f.act.t += dt; const u = Math.min(1, f.act.t / f.act.dur); f.act.fn(u, f); if (u >= 1) { const e = f.act.end; f.act = null; e && e(f); VK.resetPose(f); } } else idle(f, now); } },
      idleCut() { const acting = order.filter((id) => F[id].act || F[id].walk); const id = acting.length ? acting[Math.floor(rnd() * acting.length)] : null; if (id) focus(id, 5, { r: 11, el: 0.45, az: -0.25 }); else { goal = home(); focusId = null; } },
      tags: placeTags, dispose() { Object.values(tags).forEach((t) => t.remove()); },
    };
  }
}
