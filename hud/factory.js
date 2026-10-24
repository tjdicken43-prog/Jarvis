/* The Factory: an alien-tech factory floor where TJ's crew works (Sites by TJ).
   One shared engine for the Jarvis page and the Jarvis Station page.
   - JarvisFactory.mount(canvas, opts) draws the live floor into any canvas (drag, pinch, wheel, tap).
   - JarvisFactory.overlay(opts) opens it full screen with its own bar, info card and buttons.
   The walking is for show; the core is Jarvis's real brain (notes, links, jobs) when the host passes stats().
   All art is drawn here in code: our own pixels, no outside images. */
(function () {
  "use strict";
  let forcedOpen = false;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WW = 480, WH = 340, CORE = [240, 190];

  /* ---------- crew ---------- */
  // bot = GitHub bot (drawn as a hover drone), agent = Claude agent (drawn as a suited crew member)
  const WORKERS = [
    { id: "scout", n: "SCOUT", bot: true, c: "#6fb6d0", desk: [100, 70], act: "mapping NWA", holo: "globe", when: "Mondays 6:00", ct: "2,665 scanned", job: "Builds the cold list every Monday from Overture Maps and OpenStreetMap, then checks each website.", last: "Oct 22: 2,665 businesses, 1,098 bad sites, 556 emails.", rules: "Respects robots.txt. Never contacts anyone." },
    { id: "checker", n: "CHECKER", c: "#7fbf8f", desk: [165, 70], act: "checking facts", holo: "lens", when: "Daily 5:47", ct: "15 a week", job: "Verifies each lead: open, independent, real problem, real email, every fact with a source.", last: "Starts Monday.", rules: "No source, no claim." },
    { id: "builder", n: "BUILDER", c: "#e0a050", desk: [230, 70], act: "building site", holo: "page", when: "Daily 5:47", ct: "10 a week", job: "Writes the copy for a better site; a bot builds the preview and takes the before and after phone pictures.", last: "First trade template made Oct 23.", rules: "Concept preview bar, noindex, removed after 14 days." },
    { id: "scribe", n: "SCRIBE", c: "#d08f7a", desk: [295, 70], act: "writing email", holo: "mail", when: "Daily 5:47", ct: "10 a week", job: "Writes one short email and two nudges with the playbook that fits the site's real problem, and explains why it should work.", last: "Starts Monday.", rules: "Postal address, opt-out, honest subject, checked facts only." },
    { id: "auditor", n: "AUDITOR", c: "#d8d2c4", desk: [360, 70], act: "scanning card", holo: "shield", when: "After Scribe", ct: "every card", job: "Blocks any card with placeholder text, a missing link, a wrong price or a missing opt-out.", last: "Starts Monday.", rules: "Never grades its own work." },
    { id: "tj", n: "YOUR THRONE", c: "#f5a623", desk: [446, 150], act: "", holo: "cards", when: "Whenever you open the job cards", ct: "approve", job: "Finished jobs land here as cards: their site next to ours, a one-line description, one Approve button.", last: "", rules: "Nothing goes out without your tap.", throne: true },
    { id: "sender", n: "SENDER", bot: true, c: "#f5a623", desk: [446, 214], act: "launching email", holo: "ship", when: "Weekdays 9–11", ct: "locked · warm-up", job: "Sends only approved emails, 5 a day to start, from the hangar. Two nudges on days 3 and 7.", last: "Off until the inbox is warm (2–4 weeks).", rules: "Pauses itself after 3 errors in a row, 2% bounces or one spam mark." },
    { id: "watcher", n: "WATCHER", bot: true, c: "#6fb6d0", desk: [446, 270], act: "catching replies", holo: "dish", when: "Every 30 min", ct: "locked", job: "Catches replies, bounces and opt-outs with the dish and stops nudges instantly.", last: "Off until sending starts.", rules: "Opt-outs go on the do-not-contact list forever." },
    { id: "responder", n: "RESPONDER", c: "#d08f7a", desk: [360, 312], act: "drafting reply", holo: "chat", when: "On a reply", ct: "per reply", job: "Sorts each reply and drafts the answer for your cards. Hot replies ping your phone.", last: "Weeks 2–3.", rules: "Never sends. After 2 emails with no progress, hands it to you to call or drop by." },
    { id: "closer", n: "CLOSER", c: "#e8c46a", desk: [295, 312], act: "writing proposal", holo: "coin", when: "On a yes", ct: "per yes", job: "Proposal page, payment link and simple terms.", last: "Weeks 2–3.", rules: "Prices only from the price list." },
    { id: "launcher", n: "LAUNCHER", c: "#7fbf8f", desk: [230, 312], act: "going live", holo: "rocket", when: "On payment", ct: "per client", job: "Puts the paid site live and sends the client the domain steps.", last: "After the first yes.", rules: "Domain always in the client's name." },
    { id: "ledger", n: "LEDGER", bot: true, c: "#e8c46a", desk: [165, 312], act: "counting", holo: "coin", when: "Daily", ct: "$0 · 0 clients", job: "Counts the pipeline, money in, costs and follow-up dates.", last: "No money yet. Honest zero.", rules: "Only real numbers." },
    { id: "keeper", n: "KEEPER", c: "#d8d2c4", desk: [100, 312], act: "writing brief", holo: "page", when: "End of each run", ct: "brief 6:15", job: "Writes the brief lines and refreshes the pages.", last: "Starts Monday.", rules: "Writes what happened, not what was hoped." },
    { id: "getfound", n: "GET FOUND", c: "#6fb6d0", desk: [34, 170], act: "locked", holo: "pin", when: "Weekly per client", ct: "unlocks at client 1", job: "Google profile posts, review reply drafts and a monthly report.", last: "Locked until the first client.", rules: "Never writes or buys reviews.", locked: true },
    { id: "degen", n: "DEGEN", bot: true, c: "#e07a6b", desk: [34, 250], act: "off", holo: "chart", when: "Off", ct: "switched off", job: "Paper-trades new tokens with fake money to test a strategy.", last: "Switched off Oct 23 (TJ: wasted usage). Code kept; runs by hand only.", rules: "Paper only. No real money, ever.", locked: true },
    { id: "overseer", n: "OVERSEER", c: "#ffffff", desk: [240, 130], act: "inspecting", holo: "eye", when: "Daily 6:05", ct: "patrolling", job: "Walks the floor checking every worker ran and landed. Fixes small breaks. Pauses sending if anything looks wrong.", last: "Rules merged Oct 23 (PR #43).", rules: "May fix code and pause sending. Never sends, spends or refunds.", walker: true },
  ];
  const BY = {}; WORKERS.forEach((w) => (BY[w.id] = w));

  /* ---------- hover rail (clockwise loop round the core) ---------- */
  const RAIL = [[70, 100], [410, 100], [410, 280], [70, 280], [70, 112]];
  const SEG = []; let RLEN = 0;
  for (let i = 0; i < RAIL.length - 1; i++) { const a = RAIL[i], b = RAIL[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); SEG.push({ a, b, L, s: RLEN }); RLEN += L; }
  const along = (d) => { for (const s of SEG) if (d <= s.s + s.L) { const u = (d - s.s) / s.L; return [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u]; } return RAIL[RAIL.length - 1]; };
  const project = (x, y) => { let best = 0, bd = 1e9; for (const s of SEG) { const vx = s.b[0] - s.a[0], vy = s.b[1] - s.a[1]; let u = ((x - s.a[0]) * vx + (y - s.a[1]) * vy) / (s.L * s.L); u = Math.max(0, Math.min(1, u)); const px = s.a[0] + vx * u, py = s.a[1] + vy * u, dd = Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = s.s + s.L * u; } } return best; };
  const STOPS = ["scout", "checker", "builder", "scribe", "auditor", "tj", "sender", "watcher", "responder", "closer", "launcher", "ledger", "keeper"].map((id) => ({ id, d: project(BY[id].desk[0], BY[id].desk[1]) }));
  const STOP_I = {}; STOPS.forEach((s, i) => (STOP_I[s.id] = i));
  // feeder belts: an agent's job slides off the rail to the desk, gets worked, slides back (Factorio-style inserter + belt)
  const FEED = {};
  WORKERS.forEach((w) => { if (w.bot || w.throne || w.walker || w.locked || STOP_I[w.id] == null) return; const [x, y] = w.desk;
    FEED[w.id] = y < 190 ? { r: [x, 100], d: [x, y + 9], dir: -1 } : { r: [x + 17, 280], d: [x + 17, y - 2], dir: 1 }; });
  const TINT = { scout: "#8a7a66", checker: "#6fb6d0", builder: "#7fbf8f", scribe: "#e0a050", auditor: "#a8b4c4", tj: "#d8d2c4", sender: "#f5a623", watcher: "#6fb6d0", responder: "#d08f7a", closer: "#f5a623", launcher: "#7fbf8f", ledger: "#7fbf8f", keeper: "#7fbf8f" };

  /* ---------- walkway: a ring outside the rail; crew walk round it ---------- */
  const WALK = { x0: 54, y0: 86, x1: 426, y1: 294 };
  const WPER = 2 * ((WALK.x1 - WALK.x0) + (WALK.y1 - WALK.y0));
  function wPoint(s) {
    s = ((s % WPER) + WPER) % WPER; const w = WALK.x1 - WALK.x0, h = WALK.y1 - WALK.y0;
    if (s < w) return [WALK.x0 + s, WALK.y0]; s -= w;
    if (s < h) return [WALK.x1, WALK.y0 + s]; s -= h;
    if (s < w) return [WALK.x1 - s, WALK.y1]; s -= w;
    return [WALK.x0, WALK.y1 - s];
  }
  function wParam(x, y) {
    const w = WALK.x1 - WALK.x0, h = WALK.y1 - WALK.y0;
    const cx = Math.max(WALK.x0, Math.min(WALK.x1, x)), cy = Math.max(WALK.y0, Math.min(WALK.y1, y));
    const d = [Math.abs(cy - WALK.y0), Math.abs(cx - WALK.x1), Math.abs(cy - WALK.y1), Math.abs(cx - WALK.x0)], k = d.indexOf(Math.min(...d));
    return k === 0 ? cx - WALK.x0 : k === 1 ? w + cy - WALK.y0 : k === 2 ? w + h + WALK.x1 - cx : 2 * w + h + WALK.y1 - cy;
  }
  const SPOTS = { tank1: [104, 132], tank2: [376, 132], tank3: [104, 248], tank4: [376, 248], holo: [240, 248], view: [180, 30], view2: [300, 30] };

  /* ---------- simulation (one for every view) ---------- */
  const S = { t: 0, crates: [], ships: [], beams: [], sparks: [], pops: [], shipped: 0, nextSpawn: 0, lastApprove: 0, stats: () => ({}) };
  const actors = WORKERS.filter((w) => !w.throne).map((w) => {
    const seat = w.bot ? [w.desk[0], w.desk[1] - 10] : [w.desk[0], w.desk[1] - 7];
    return { w, x: seat[0], y: seat[1], seat, state: w.walker ? "look" : "seat", face: "down", busy: 0, workFor: 1, timer: 200 + Math.random() * 600, bubble: "", bt: 0, path: null, fly: null, s: 0 };
  });
  const A = {}; actors.forEach((a) => (A[a.w.id] = a));
  const nearestStop = (id) => STOPS[STOP_I[id]];
  function waiting(id) { const i = STOP_I[id]; return S.crates.some((c) => c.next === i && Math.abs(c.d - STOPS[i].d) < 34); }
  function tjQueue() { const i = STOP_I.tj; return S.crates.filter((c) => c.next === i && c.d > STOPS[STOP_I.auditor].d + 10).length; }
  function walkTo(a, tx, ty) { // seat → walkway → round the ring → target
    const s0 = wParam(a.x, a.y), s1 = wParam(tx, ty); let ds = s1 - s0; if (ds > WPER / 2) ds -= WPER; if (ds < -WPER / 2) ds += WPER;
    a.path = { legs: [wPoint(s0)], s0, ds, k: 0, end: [tx, ty], phase: 0 };
  }
  function stepWalk(a) {
    const sp = 0.55, P = a.path;
    const goal = P.phase === 0 ? P.legs[0] : P.phase === 1 ? wPoint(P.s0 + Math.sign(P.ds) * Math.min(Math.abs(P.ds), P.k)) : P.end;
    const dx = goal[0] - a.x, dy = goal[1] - a.y, L = Math.hypot(dx, dy);
    if (P.phase === 1) { P.k += sp; if (P.k >= Math.abs(P.ds)) { P.phase = 2; } }
    if (L > sp) { a.x += dx / L * sp; a.y += dy / L * sp; a.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"); return false; }
    a.x = goal[0]; a.y = goal[1];
    if (P.phase === 0) { P.phase = Math.abs(P.ds) > 1 ? 1 : 2; return false; }
    if (P.phase === 2) { a.path = null; return true; }
    return false;
  }
  function spawn() { if (S.crates.some((c) => c.d < 18)) return; S.crates.push({ d: 0, col: TINT.scout, next: 0, wait: 0, bob: Math.random() * 6, hot: Math.random() < 0.1 }); S.sparks.push({ x: RAIL[0][0], y: RAIL[0][1], t: 30, c: "#6fb6d0" }); } // about 1 in 10 is a hot lead: a rare, unpredictable reward
  function spawnReply() {
    const i = STOP_I.watcher, d = STOPS[i].d - 16; if (S.crates.some((c) => Math.abs(c.d - d) < 16)) return;
    S.beams.push({ x0: 470, y0: 318, x1: along(d)[0], y1: along(d)[1], t: 40 });
    S.crates.push({ d, col: "#6fb6d0", next: i, wait: 0, reply: true, bob: 0 });
  }
  function step() {
    S.t++;
    if (S.t >= S.nextSpawn) { spawn(); S.nextSpawn = S.t + 240 + Math.random() * 220; }
    if (S.t % 820 === 400) spawnReply();
    const cs = S.crates.sort((a, b) => b.d - a.d);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], ahead = cs[i - 1], stop = STOPS[c.next];
      if (c.wait > 0) {
        c.wait--; const a = A[stop.id]; if (a) a.busy = Math.max(a.busy, 2);
        if (c.wait === 0) {
          c.col = TINT[stop.id] || c.col; c.next++;
          const [px0, py0] = FEED[stop.id] ? FEED[stop.id].d : along(c.d);
          if (stop.id === "sender") { c.gone = true; const [x, y] = along(c.d); S.ships.push({ x, y, vx: 0.2, t: 0, hot: c.hot }); S.shipped++; S.pops.push({ x: 468, y: 214, z: 16, t: 90, s: c.hot ? "Hot lead sent" : "+1 sent", c: c.hot ? "#e6b450" : "#e6f4fb", big: c.hot }); }
          else S.pops.push({ x: px0, y: py0, z: 14, t: 45, s: "✓", c: BY[stop.id].c });
        }
        continue;
      }
      let v = 0.42; if (ahead && ahead.d - c.d < 14) v = 0;
      if (stop && c.d + v >= stop.d && c.d <= stop.d + 0.01) {
        c.d = stop.d;
        if (stop.id === "tj") { if (S.t - S.lastApprove > 540) { S.lastApprove = S.t; c.next++; c.col = TINT.tj; c.stamp = 50; S.pops.push({ x: 446, y: 150, z: 22, t: 70, s: "Approved", c: "#e6b450" }); } continue; }
        const a = A[stop.id];
        if (a && (a.state === "seat")) { c.wait = a.w.bot ? 100 : 150 + Math.random() * 120; c.w0 = c.wait; a.busy = c.wait; a.workFor = c.wait; a.bubble = a.w.act; a.bt = c.wait; }
        continue;
      }
      c.d += v; if (c.stamp) c.stamp--;
      if (c.d >= RLEN - 1) { c.gone = true; const [x, y] = along(c.d); S.sparks.push({ x, y, t: 30, c: "#7fbf8f" }); }
    }
    S.crates = cs.filter((c) => !c.gone);
    S.ships.forEach((s) => { s.t++; if (s.t < 40) { s.x += (468 - s.x) * 0.05; s.y += (214 - s.y) * 0.08; } else { s.vx += 0.12; s.x += s.vx; } });
    S.ships = S.ships.filter((s) => s.x < WW + 60);
    S.beams.forEach((b) => b.t--); S.beams = S.beams.filter((b) => b.t > 0);
    S.sparks.forEach((p) => p.t--); S.sparks = S.sparks.filter((p) => p.t > 0);
    S.pops.forEach((p) => p.t--); S.pops = S.pops.filter((p) => p.t > 0);
    for (const a of actors) {
      if (a.busy > 0) a.busy--;
      if (a.bt > 0) a.bt--; else a.bubble = "";
      if (a.w.locked) { a.busy = 0; continue; }
      if (a.fly) { // drones fly to the core to sync, then home
        const f = a.fly; f.u += 0.008; const u = f.u < 0.5 ? f.u * 2 : (1 - f.u) * 2, e = u * u * (3 - 2 * u);
        a.x = a.seat[0] + (f.to[0] - a.seat[0]) * e; a.y = a.seat[1] + (f.to[1] - a.seat[1]) * e - Math.sin(e * Math.PI) * 18;
        if (f.u >= 1) { a.fly = null; a.x = a.seat[0]; a.y = a.seat[1]; a.timer = 700 + Math.random() * 900; }
        continue;
      }
      if (a.w.walker) {
        if (a.state === "walk") { if (stepWalk(a)) { a.state = "look"; a.timer = 80; const n = nearestDesk(a); if (n) { a.bubble = n.locked ? "locked ✓" : "✓ landed"; a.bt = 80; } } }
        else if (--a.timer <= 0) { const pick = WORKERS.filter((w) => !w.walker); const p = pick[(Math.random() * pick.length) | 0]; walkTo(a, p.desk[0] + (Math.random() < 0.5 ? -14 : 14), p.desk[1] + (p.desk[1] > 200 ? -22 : p.desk[1] < 100 ? 18 : 0)); a.state = "walk"; }
        continue;
      }
      if (a.w.bot) { if (a.busy <= 0 && --a.timer <= 0 && !waiting(a.w.id)) { a.fly = { u: 0, to: [CORE[0] + (Math.random() * 40 - 20), CORE[1] - 40] }; a.bubble = "syncing"; a.bt = 60; } continue; }
      if (a.state === "seat") {
        if (a.busy <= 0 && !a.w.locked && --a.timer <= 0 && !waiting(a.w.id)) {
          const keys = Object.keys(SPOTS), s = SPOTS[keys[(Math.random() * keys.length) | 0]];
          walkTo(a, s[0] + Math.random() * 14 - 7, s[1] + Math.random() * 8); a.state = "walk"; a.back = false;
          a.bubble = ["coffee", "stretch", "looking at stars", "brb"][(Math.random() * 4) | 0]; a.bt = 70;
        }
      } else if (a.state === "walk") { if (stepWalk(a)) { if (a.back) { a.state = "seat"; a.face = "down"; a.timer = 600 + Math.random() * 900; } else { a.state = "idle"; a.timer = 90 + Math.random() * 140; } } }
      else if (a.state === "idle") { if (--a.timer <= 0 || waiting(a.w.id)) { walkTo(a, a.seat[0], a.seat[1]); a.back = true; a.state = "walk"; } }
    }
  }
  function nearestDesk(a) { let b = null, bd = 1e9; WORKERS.forEach((w) => { const d = Math.hypot(w.desk[0] - a.x, w.desk[1] - a.y); if (d < bd) { bd = d; b = w; } }); return b; }

  /* ---------- pixel art helpers ---------- */
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const shade = (h, k) => { const [r, g, b] = rgb(h); const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
  function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  // suited crew member, 8 x 12, feet at (x, y)
  const SUIT = {
    down: ["..hhhh..", ".hhhhhh.", ".hvvvvh.", ".hvvvvh.", "..hhhh..", ".tbbbbt.", "sbbccbbs", "sbbbbbbs", ".bbbbbb.", ".dd..dd.", ".dd..dd.", ".kk..kk."],
    up: ["..hhhh..", ".hhhhhh.", ".hhhhhh.", ".hhhhhh.", "..hhhh..", ".tbbbbt.", "sbbbbbbs", "sbbbbbbs", ".bbbbbb.", ".dd..dd.", ".dd..dd.", ".kk..kk."],
    side: ["..hhhh..", ".hhhhhh.", ".hhhvvv.", ".hhhvvv.", "..hhhh..", "..tbbt..", "..bbbs..", "..bccs..", "..bbbb..", "..dddd..", "..d..d..", ".kk..kk."],
  };
  const LEGS = [[".dd..dd.", "..d..dd.", ".kk...kk"], [".dd..dd.", ".dd..d..", "kk...kk."]];
  function crew(g, x, y, w, face, step, sitting, typing) {
    const rows = (face === "up" ? SUIT.up : face === "down" ? SUIT.down : SUIT.side).slice();
    if (!sitting && step) { const L = LEGS[step - 1]; rows[9] = L[0]; rows[10] = L[1]; rows[11] = L[2]; }
    if (typing) { rows[6] = typing === 1 ? ".bbccbb." : "sbbccbbs"; rows[5] = typing === 1 ? "stbbbbts" : ".tbbbbt."; }
    const pal = { h: "#cfd3dc", v: w.c, b: "#2a2f3c", t: w.c, c: shade(w.c, -0.2), s: "#3a4152", d: "#1c2029", k: "#0c0e13" };
    const flip = face === "left", n = sitting ? 9 : 12;
    for (let r = 0; r < n; r++) for (let c = 0; c < 8; c++) { const ch = rows[r][flip ? 7 - c : c]; if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x - 4 + c, y - 12 + r, 1, 1); } }
  }
  // tiny holograms over busy stations
  function holo(g, kind, x, y, c, t) {
    g.globalAlpha = 0.85; g.fillStyle = c; const s = Math.sin(t / 14);
    const dot = (a, b) => g.fillRect(Math.round(x + a), Math.round(y + b), 1, 1);
    if (kind === "globe") { for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; dot(Math.cos(a) * 5, Math.sin(a) * 5); dot(Math.cos(a) * 5 * s, Math.sin(a) * 5); } }
    else if (kind === "lens") { for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; dot(Math.cos(a) * 3.5 - 1, Math.sin(a) * 3.5 - 1); } for (let k = 0; k < 4; k++) dot(2 + k, 2 + k); }
    else if (kind === "page") { g.fillRect(x - 4, y - 5, 8, 1); g.fillRect(x - 4, y + 4, 8, 1); g.fillRect(x - 4, y - 5, 1, 10); g.fillRect(x + 3, y - 5, 1, 10); for (let k = 0; k < 3; k++) g.fillRect(x - 2, y - 2 + k * 2, 2 + ((t >> 3) + k) % 4, 1); }
    else if (kind === "mail") { g.fillRect(x - 5, y - 3, 10, 1); g.fillRect(x - 5, y + 3, 10, 1); g.fillRect(x - 5, y - 3, 1, 7); g.fillRect(x + 4, y - 3, 1, 7); for (let k = 0; k < 4; k++) { dot(-4 + k, -2 + k); dot(3 - k, -2 + k); } }
    else if (kind === "shield") { for (let k = 0; k < 6; k++) { dot(-4, -4 + k); dot(4, -4 + k); dot(-4 + k * 0.8, 2 + k * 0.5); dot(4 - k * 0.8, 2 + k * 0.5); } g.fillRect(x - 4, y - 4, 9, 1); g.fillRect(x - 6, y - 6 + ((t >> 1) % 12), 13, 1); }
    else if (kind === "ship") { g.fillRect(x - 4, y, 8, 1); g.fillRect(x - 2, y - 1, 5, 1); g.fillRect(x + 4, y, 1, 1); dot(-5 - ((t >> 2) % 3), 0); }
    else if (kind === "dish") { for (let k = 0; k < 7; k++) dot(-3 + k, -Math.abs(k - 3) + 2); g.fillRect(x, y - 3, 1, 3); dot(0, -4 - ((t >> 3) % 3)); }
    else if (kind === "chat") { g.fillRect(x - 5, y - 3, 10, 1); g.fillRect(x - 5, y + 2, 10, 1); g.fillRect(x - 5, y - 3, 1, 6); g.fillRect(x + 4, y - 3, 1, 6); dot(-3, 4); dot(-4, 5); }
    else if (kind === "coin") { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; dot(Math.cos(a) * 4 * Math.abs(s), Math.sin(a) * 4); } g.fillRect(x, y - 2, 1, 5); }
    else if (kind === "rocket") { g.fillRect(x, y - 5, 1, 8); g.fillRect(x - 1, y - 3, 3, 4); dot(-2, 2); dot(2, 2); dot(0, 4 + ((t >> 2) % 2)); }
    else if (kind === "chart") { for (let k = 0; k < 9; k++) dot(-4 + k, Math.sin(k + t / 10) * 3); }
    else if (kind === "pin") { for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; dot(Math.cos(a) * 3, Math.sin(a) * 3 - 2); } dot(0, 3); dot(0, 2); }
    else if (kind === "cards") { for (let k = 0; k < 3; k++) { g.fillRect(x - 5 + k * 2, y - 4 + k * 2, 7, 1); g.fillRect(x - 5 + k * 2, y - 4 + k * 2, 1, 5); } }
    else if (kind === "eye") { for (let k = 0; k < 10; k++) { dot(-5 + k, -Math.sin(k / 9 * Math.PI) * 3); dot(-5 + k, Math.sin(k / 9 * Math.PI) * 3); } g.fillRect(x - 1, y - 1, 2, 2); }
    g.globalAlpha = 1;
  }

  /* ---------- the station, seen in 2:1 isometric ----------
     Modeled on Starnet's full station render (github.com/androoAGI/starnet, .github/media/station-iso.png):
     one big multi-room hull floating in space, gunmetal walls lit by rows of amber windows, teal screens, small
     white crew, a hazard-striped landing pad. Walls-down cutaway like The Sims and Two Point Hospital: tall walls
     at the back, low ones in front. Our own art, drawn here in code (Starnet's sprites are not licensed). */
  const SW = 900, SH = 560, OX = 380, OY = 104, BR = 2;
  let ACCENT = "#f5a623";
  const P = (x, y, z = 0) => [OX + (x - y), OY + (x + y) / 2 - z];
  const unP = (sx, sy) => { const dx = sx - OX, dy = sy - OY; return [dx / 2 + dy, dy - dx / 2]; };
  const C = {
    space: "#06070a", hullTop: "#443d32", wall: "#312c25", wallSide: "#25211c", seam: "#15130f",
    floor: "#201d18", plate: "#26221d", line: "#2b2720", trim: "#4a4236",
    amber: "#f5a623", win: "#ffb84d", teal: "#5fc9c0", ink: "#e6e1d7", suit: "#e9e5dc", suitShade: "#b9b2a5",
    ok: "#7fbf8f", idle: "#6b655a", red: "#e07a6b",
  };
  const hsh = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 997;

  function poly(g, pts, fill, stroke, lw) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 0.6; g.stroke(); }
  }
  const flat = (x0, y0, x1, y1, z = 0) => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
  const faceN = (x0, x1, y, z0, z1) => [P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)]; // a face looking down +y
  const faceW = (y0, y1, x, z0, z1) => [P(x, y0, z0), P(x, y1, z0), P(x, y1, z1), P(x, y0, z1)]; // a face looking down +x
  // a box seen from the front: its +y face (screen left), its +x face (screen right) and its top
  function box(g, x0, y0, x1, y1, z0, h, c, edge) {
    poly(g, faceN(x0, x1, y1, z0, z0 + h), shade(c, -0.22));
    poly(g, faceW(y0, y1, x1, z0, z0 + h), shade(c, -0.42));
    poly(g, flat(x0, y0, x1, y1, z0 + h), c, edge, 0.5);
  }
  function line(g, a, b, c, w) { g.strokeStyle = c; g.lineWidth = w || 0.6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  // a flat disc (a circle on the floor), with an optional side
  function disc(g, x, y, r, z, h, top, side, edge) {
    const [sx, sy] = P(x, y, z), rx = r * Math.SQRT2, ry = rx / 2;
    if (h) { const [, ty] = P(x, y, z + h); g.fillStyle = side; g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, Math.PI); g.lineTo(sx - rx, ty); g.ellipse(sx, ty, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill(); }
    const [, ty] = P(x, y, z + (h || 0)); g.fillStyle = top; g.beginPath(); g.ellipse(sx, ty, rx, ry, 0, 0, Math.PI * 2); g.fill();
    if (edge) { g.strokeStyle = edge; g.lineWidth = 0.6; g.stroke(); }
  }
  const ring = (g, x, y, r, z, c, w, a0 = 0, a1 = Math.PI * 2) => { const [sx, sy] = P(x, y, z), rx = r * Math.SQRT2; g.strokeStyle = c; g.lineWidth = w || 0.6; g.beginPath(); g.ellipse(sx, sy, rx, rx / 2, 0, a0, a1); g.stroke(); };
  function glowAt(g, x, y, r, c, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  function floorText(g, s, x, y, size, c) { // text painted flat on the floor
    const [sx, sy] = P(x, y, 0); g.save(); g.setTransform(g.getTransform().multiply(new DOMMatrix([1, 0.5, -1, 0.5, sx, sy])));
    g.font = `600 ${size}px 'IBM Plex Mono', ui-monospace, monospace`; g.fillStyle = c; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText(s, 0, 0); g.restore();
  }
  const HULL = [[24, 0], [456, 0], [480, 24], [480, 316], [456, 340], [24, 340], [0, 316], [0, 24]];
  const ZONES = [
    { n: "Find and build", r: [60, 40, 420, 98], c: "#25211b" },
    { n: "Deals", r: [60, 282, 420, 334], c: "#25211b" },
    { n: "Lab", r: [8, 120, 58, 300], c: "#171b16" },
    { n: "Command", r: [422, 118, 476, 184], c: "#221d14" },
    { n: "Hangar", r: [422, 190, 476, 300], c: "#1b1a17" },
  ];

  /* static layer: space-side trusses, hull, floor, walls, rail, conduits. Drawn once at BR x into a cache. */
  const base = document.createElement("canvas"); base.width = SW * BR; base.height = SH * BR;
  function drawBase() {
    const g = base.getContext("2d"); g.setTransform(BR, 0, 0, BR, 0, 0); g.clearRect(0, 0, SW, SH); g.lineJoin = "round";
    // solar wings on the west side, on trusses
    for (const [y0, y1] of [[40, 140], [180, 290]]) {
      box(g, -16, (y0 + y1) / 2 - 3, 0, (y0 + y1) / 2 + 3, 14, 3, "#2a261f");
      poly(g, flat(-78, y0, -18, y1, 16), "#16203a", "#3a352d", 0.8);
      for (let k = y0 + 10; k < y1; k += 10) line(g, P(-78, k, 16), P(-18, k, 16), "#22335a", 0.5);
      for (let k = -68; k < -18; k += 10) line(g, P(k, y0, 16), P(k, y1, 16), "#22335a", 0.5);
      line(g, P(-78, y0, 16), P(-18, y0, 16), "#5a6a88", 0.5);
    }
    // landing pad off the east side (Sender launches from here)
    poly(g, [P(484, 194, 0), P(500, 178, 0), P(548, 178, 0), P(564, 194, 0), P(564, 254, 0), P(548, 270, 0), P(500, 270, 0), P(484, 254, 0)], "#1d1a16", C.trim, 0.8);
    poly(g, [P(484, 254, 0), P(500, 270, 0), P(548, 270, 0), P(564, 254, 0), P(564, 254, -6), P(548, 270, -6), P(500, 270, -6), P(484, 254, -6)], "#14120f");
    for (let k = 0; k < 12; k++) poly(g, flat(500 + k * 4, 266, 502 + k * 4, 270, 0), k % 2 ? "#1a1510" : "#c9921f");
    for (let k = 0; k < 12; k++) poly(g, flat(500 + k * 4, 178, 502 + k * 4, 182, 0), k % 2 ? "#1a1510" : "#c9921f");
    ring(g, 524, 224, 26, 0, rgba(C.amber, 0.45), 0.8); ring(g, 524, 224, 20, 0, rgba(C.amber, 0.2), 0.6);
    poly(g, flat(480, 206, 486, 242, 0), "#24201a", C.trim, 0.5); // bridge
    // hull floor
    poly(g, HULL.map(([x, y]) => P(x, y, -8)), "#100e0b");
    poly(g, HULL.map(([x, y]) => P(x, y, 0)), C.floor);
    for (let x = 20; x < 480; x += 20) line(g, P(x, 0, 0), P(x, 340, 0), C.line, 0.4);
    for (let y = 20; y < 340; y += 20) line(g, P(0, y, 0), P(480, y, 0), C.line, 0.4);
    for (const z of ZONES) { const [x0, y0, x1, y1] = z.r; poly(g, flat(x0, y0, x1, y1, 0), z.c, rgba(C.amber, 0.12), 0.5); floorText(g, z.n, x0 + 4, y1 - 4, 6, rgba(C.amber, 0.32)); }
    for (const R of ROOMS) { const [x0, y0, x1, y1] = R.r; poly(g, flat(x0, y0, x1, y1, 0), R.floor, rgba(C.amber, 0.14), 0.5); for (let x = x0 + 10; x < x1; x += 10) line(g, P(x, y0, 0), P(x, y1, 0), "rgba(255,255,255,.025)", 0.4); floorText(g, R.n, x0 + 4, y1 - 4, 5.5, rgba(C.amber, 0.3)); }
    for (let d = 0; d < RLEN; d += 12) { const [x, y] = along(d), [sx, sy] = P(x + (y === 100 ? 0 : x <= 70 ? -8 : x >= 410 ? 8 : 0), y + (y <= 100 ? -8 : y >= 280 ? 8 : 0), 0); g.fillStyle = rgba(C.amber, 0.4); g.fillRect(sx - 0.6, sy - 0.3, 1.2, 0.6); }
    for (let k = 0; k < 22; k++) poly(g, flat(424 + (k % 11) * 5, k < 11 ? 190 : 298, 426.5 + (k % 11) * 5, k < 11 ? 192 : 300, 0), "#a87a1c"); // hangar hazard edge
    // conduits from the core to every station (they carry pulses when the station works)
    const [cx, cy] = CORE;
    WORKERS.forEach((w) => { if (w.walker) return; const my = (w.desk[1] + cy) / 2, pts = [[cx, cy], [cx, my], [w.desk[0], my], [w.desk[0], w.desk[1] + (w.desk[1] < cy ? 6 : -8)]];
      for (let i = 0; i < 3; i++) { line(g, P(...pts[i]), P(...pts[i + 1]), "#0f0d0a", 2.2); line(g, P(...pts[i]), P(...pts[i + 1]), "#2b261e", 0.6); } });
    // the rail: a recessed track with two guide strips
    for (let i = 0; i < RAIL.length - 1; i++) {
      const a = RAIL[i], b = RAIL[i + 1], h = a[1] === b[1], x0 = Math.min(a[0], b[0]) - (h ? 0 : 5), x1 = Math.max(a[0], b[0]) + (h ? 0 : 5), y0 = Math.min(a[1], b[1]) - (h ? 5 : 0), y1 = Math.max(a[1], b[1]) + (h ? 5 : 0);
      poly(g, flat(x0, y0, x1, y1, 0), "#0c0b09");
      if (h) { line(g, P(x0, y0 + 1, 0), P(x1, y0 + 1, 0), "#3a3329", 0.6); line(g, P(x0, y1 - 1, 0), P(x1, y1 - 1, 0), "#3a3329", 0.6); }
      else { line(g, P(x0 + 1, y0, 0), P(x0 + 1, y1, 0), "#3a3329", 0.6); line(g, P(x1 - 1, y0, 0), P(x1 - 1, y1, 0), "#3a3329", 0.6); }
    }
    // feeder belts from the rail to each agent's desk, with an inserter pedestal at the rail end
    for (const id in FEED) { const { r, d } = FEED[id], y0 = Math.min(r[1], d[1]), y1 = Math.max(r[1], d[1]);
      poly(g, flat(r[0] - 3.5, y0, r[0] + 3.5, y1, 0.05), "#0c0b09"); line(g, P(r[0] - 3.5, y0, 0.1), P(r[0] - 3.5, y1, 0.1), "#5a4f3d", 0.6); line(g, P(r[0] + 3.5, y0, 0.1), P(r[0] + 3.5, y1, 0.1), "#5a4f3d", 0.6);
      for (let yy = y0 + 2; yy < y1; yy += 3) line(g, P(r[0] - 3, yy, 0.1), P(r[0] + 3, yy, 0.1), "#1c1915", 0.5);
      disc(g, r[0] + 7, (r[1] + d[1]) / 2, 2.6, 0, 1.6, "#3a342b", "#25211b"); }
    // pads under the bot docks and the core pit
    WORKERS.forEach((w) => { if (w.bot) { disc(g, w.desk[0], w.desk[1], 9, 0, 0, "#1f1c17", rgba(w.c, 0.5)); ring(g, w.desk[0], w.desk[1], 6, 0, rgba(w.c, 0.25), 0.5); } });
    disc(g, cx, cy, 46, 0, 0, "#141210", rgba(C.amber, 0.18));
    // back walls: tall, gunmetal, rows of lit windows and a few teal screens
    const H = 48;
    poly(g, [P(0, 24, 0), P(24, 0, 0), P(24, 0, H), P(0, 24, H)], shade(C.wall, -0.3));
    box(g, 24, -8, 456, 0, 0, H, C.hullTop);
    poly(g, faceN(24, 456, 0, 0, H), C.wall);
    box(g, -8, 24, 0, 316, 0, H, C.hullTop);
    poly(g, faceW(24, 316, 0, 0, H), C.wallSide);
    poly(g, [P(456, 0, 0), P(480, 24, 0), P(480, 24, H), P(456, 0, H)], shade(C.wall, -0.15));
    poly(g, [P(456, -8, H), P(488, 24, H), P(480, 24, H), P(456, 0, H)], C.hullTop);
    for (let x = 24; x <= 456; x += 24) line(g, P(x, 0, 2), P(x, 0, H - 2), C.seam, 0.7);
    for (let y = 24; y <= 316; y += 24) line(g, P(0, y, 2), P(0, y, H - 2), "#110f0c", 0.7);
    line(g, P(24, 0, 8), P(456, 0, 8), "#3a3329", 1.2); line(g, P(0, 24, 8), P(0, 316, 8), "#2e2820", 1.2); // pipe runs
    for (let x = 28; x < 452; x += 5) for (const z of [40, 34]) { const k = hsh(x, z); if (x > 150 && x < 330 && z === 34) continue; poly(g, faceN(x, x + 3, 0, z, z + 3), k % 5 === 0 ? "#3fb6b0" : k % 3 ? rgba(C.win, 0.85) : "#14120f"); }
    for (let y = 28; y < 312; y += 5) for (const z of [40, 34]) { const k = hsh(y, z + 7); poly(g, faceW(y, y + 3, 0, z, z + 3), k % 6 === 0 ? "#2f9a94" : k % 3 ? rgba(C.win, 0.7) : "#100e0b"); }
    for (const [x0, x1] of [[154, 206], [274, 326]]) { // viewports onto space (crew walk up to look out)
      poly(g, faceN(x0, x1, 0, 12, 30), "#05060a", C.trim, 1);
      for (let k = 0; k < 16; k++) { const sx = x0 + 2 + (hsh(k, x0) % (x1 - x0 - 4)), sz = 13 + (hsh(x0, k) % 16); poly(g, faceN(sx, sx + 0.6, 0, sz, sz + 0.6), k % 4 ? "rgba(235,230,220,.8)" : "rgba(140,190,220,.9)"); }
      line(g, P((x0 + x1) / 2, 0, 12), P((x0 + x1) / 2, 0, 30), C.trim, 1);
    }
    WORKERS.forEach((w) => { if (w.desk[1] < 100 && !w.walker) poly(g, faceN(w.desk[0] - 7, w.desk[0] + 7, 0, 16, 25), "#0f2826", rgba(C.teal, 0.5), 0.5); }); // wall screens above the north desks
    // antennas and a dish on the roof
    box(g, 396, -6, 400, -2, H, 26, "#3a342b"); disc(g, 398, -4, 7, H + 26, 1, "#4a4236", "#2a251f");
    box(g, 84, -6, 88, -2, H, 16, "#3a342b"); line(g, P(86, -4, H + 16), P(86, -4, H + 30), "#6b6252", 0.6);
    box(g, -6, 60, -2, 64, H, 20, "#3a342b");
    // front walls: low, so the room stays visible (cutaway)
    box(g, 24, 340, 456, 346, 0, 6, "#3a342b");
    box(g, 480, 24, 486, 206, 0, 6, "#3a342b"); box(g, 480, 242, 486, 316, 0, 6, "#3a342b");
    poly(g, [P(0, 316, 0), P(24, 340, 0), P(24, 340, 6), P(0, 316, 6)], "#2a251f");
    poly(g, [P(456, 340, 0), P(480, 316, 0), P(480, 316, 6), P(456, 340, 6)], "#24201a");
    for (let x = 30; x < 452; x += 12) poly(g, faceN(x, x + 4, 346, 2.5, 4), hsh(x, 3) % 3 ? rgba(C.win, 0.75) : "#14120f");
    // warm lamp pools on the floor
    g.globalCompositeOperation = "lighter";
    for (const [x, y] of [[120, 70], [240, 70], [360, 70], [120, 310], [240, 310], [360, 310], [446, 150], [30, 210], [134, 136], [346, 136], [134, 246], [346, 246], [240, 190], [446, 250]]) { const [sx, sy] = P(x, y, 0); glowAt(g, sx, sy, 70, C.win, 0.075); }
    g.globalCompositeOperation = "source-over";
  }

  /* ---------- props and crew, depth-sorted every frame ---------- */
  function rr(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
  function person(g, x, y, w, face, step, sitting, typing) {
    const [sx, sy0] = P(x, y, 0), sy = Math.round(sy0 * 2) / 2;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx, sy, 4, 1.8, 0, 0, Math.PI * 2); g.fill();
    const hip = sitting ? 4 : 5, sw = step ? (step === 1 ? 1 : -1) : 0;
    if (!sitting) { g.fillStyle = "#8d877b"; g.fillRect(sx - 2.2 + sw * 0.5, sy - hip, 1.8, hip - (sw > 0 ? 0.6 : 0)); g.fillRect(sx + 0.4 - sw * 0.5, sy - hip, 1.8, hip - (sw < 0 ? 0.6 : 0)); }
    const top = sy - hip - 6.5;
    rr(g, sx - 3.2, top, 6.4, 7, 2, C.suit); rr(g, sx + 1, top + 0.5, 2.2, 6.5, 1.2, C.suitShade);
    g.fillStyle = w.c; g.fillRect(sx - 3.2, top + 2.2, 6.4, 1.1);
    if (typing) { g.fillStyle = C.suitShade; g.fillRect(sx - 4.2, top + 3 + (typing === 1 ? 0 : 0.5), 1.4, 3); g.fillRect(sx + 2.8, top + 3 + (typing === 1 ? 0.5 : 0), 1.4, 3); }
    const hy = top - 2.6; g.fillStyle = "#f1ede5"; g.beginPath(); g.arc(sx, hy, 2.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(0,0,0,.14)"; g.beginPath(); g.arc(sx + 0.9, hy + 0.5, 2.1, -0.6, 2.2); g.fill();
    if (face !== "up") { const vx = face === "left" ? -1.2 : face === "right" ? 1.2 : 0; g.fillStyle = "#23211e"; g.beginPath(); g.ellipse(sx + vx, hy + 0.3, 1.9, 1.1, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = rgba(w.c, 0.9); g.fillRect(sx + vx - 0.9, hy - 0.1, 0.8, 0.5); }
  }
  function droneIso(g, x, y, w, t, busy, lift) {
    const z = 14 + Math.sin(t / 9) * 1.2 + (lift || 0), [fx, fy] = P(x, y, 0), [sx, sy] = P(x, y, z);
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(fx, fy, 5, 2.2, 0, 0, Math.PI * 2); g.fill();
    if (busy && !lift) { g.fillStyle = rgba(w.c, 0.12); g.beginPath(); g.moveTo(sx, sy + 2); g.lineTo(fx - 6, fy); g.lineTo(fx + 6, fy); g.closePath(); g.fill(); }
    g.strokeStyle = "#4a4236"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(sx - 6, sy - 1); g.lineTo(sx + 6, sy + 1); g.moveTo(sx - 6, sy + 1); g.lineTo(sx + 6, sy - 1); g.stroke();
    for (const [ox, oy] of [[-6, -1], [6, 1], [-6, 1], [6, -1]]) { g.fillStyle = "rgba(220,214,200,.22)"; g.beginPath(); g.ellipse(sx + ox, sy + oy - 0.6, 2.6, 1, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#2b2721"; g.beginPath(); g.ellipse(sx, sy, 4.2, 2.3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3d372e"; g.beginPath(); g.ellipse(sx, sy - 0.9, 3.4, 1.7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = busy ? w.c : rgba(w.c, 0.55); g.beginPath(); g.ellipse(sx, sy - 0.9, 1.4, 0.8, 0, 0, Math.PI * 2); g.fill();
  }
  function holoScreen(g, w, x, y, t, working) { // a floating screen over the desk, lit when the station works
    const pts = faceN(x - 8, x + 8, y - 1, 15, 25);
    poly(g, pts, working ? rgba(w.c, 0.16) : "rgba(95,201,192,.05)", working ? rgba(w.c, 0.55) : "rgba(95,201,192,.18)", 0.5);
    if (working) { const [hx, hy] = P(x, y - 1, 20); holo(g, w.holo, Math.round(hx), Math.round(hy), w.c, t); }
    else for (let k = 0; k < 3; k++) { const [a] = [P(x - 6, y - 1, 22 - k * 2.5)], [b] = [P(x - 6 + 4 + (hsh(k, x) % 7), y - 1, 22 - k * 2.5)]; line(g, a, b, "rgba(95,201,192,.25)", 0.6); }
  }
  const PROPS = [];
  WORKERS.forEach((w) => {
    if (w.walker) return; const [x, y] = w.desk;
    if (w.throne) {
      PROPS.push({ d: x + y - 20, f: (g) => { box(g, x - 20, y - 18, x + 20, y + 16, 0, 2.5, "#2b261f", rgba(C.amber, 0.5)); box(g, x - 6, y - 8, x + 6, y - 6, 2.5, 20, "#3a332a"); line(g, P(x - 6, y - 6, 22.5), P(x + 6, y - 6, 22.5), C.amber, 0.8); } });
      PROPS.push({ d: x + y - 4, f: (g) => { box(g, x - 6, y - 6, x + 6, y + 2, 2.5, 5, "#3a332a"); box(g, x - 8, y - 6, x - 6, y + 2, 2.5, 8, "#2f2a22"); box(g, x + 6, y - 6, x + 8, y + 2, 2.5, 8, "#2f2a22"); } });
      PROPS.push({ d: x + y + 12, f: (g, t) => { box(g, x - 16, y + 8, x + 16, y + 13, 2.5, 7, "#2c2822"); line(g, P(x - 16, y + 13, 9.5), P(x + 16, y + 13, 9.5), C.amber, 0.8);
        const q = tjQueue(); for (let i = 0; i < Math.min(q, 6); i++) box(g, x + 4, y + 9, x + 12, y + 12, 9.5 + i * 0.9, 0.7, i % 2 ? "#e9e5dc" : "#cfc8bb");
        if (q) holo(g, "cards", ...P(x, y + 10, 26).map(Math.round), C.amber, t); } });
      return;
    }
    if (w.bot) { PROPS.push({ d: x + y - 6, f: (g, t) => { const a = A[w.id], on = a && a.busy > 0; box(g, x + 9, y - 6, x + 13, y - 2, 0, 14, "#2f2a22"); poly(g, faceW(y - 5.5, y - 2.5, x + 13, 10, 12), w.locked ? C.red : on ? w.c : "#4a4236"); } }); return; }
    PROPS.push({ d: x + y - 10, f: (g) => { box(g, x - 3.5, y - 12, x + 3.5, y - 10.5, 0, 11, "#24201a"); box(g, x - 3.5, y - 11, x + 3.5, y - 5, 0, 4.5, "#2a251f"); } });
    PROPS.push({ d: x + y, f: (g, t) => { const a = A[w.id], on = a && a.busy > 0;
      box(g, x - 12, y - 3, x + 12, y + 4, 0, 7, "#332e26"); line(g, P(x - 12, y + 4, 7), P(x + 12, y + 4, 7), rgba(w.c, on ? 0.95 : 0.45), 0.8);
      poly(g, flat(x - 6, y - 2, x + 6, y + 1, 7.05), on ? rgba(w.c, 0.35) : "#1f1c17");
      if (w.locked) for (let i = 0; i < 8; i++) poly(g, flat(x - 16 + i * 4, y + 8, x - 14 + i * 4, y + 10, 0.05), i % 2 ? "#1a1510" : "#a8401f");
      holoScreen(g, w, x, y, t, on && !w.locked); } });
  });
  // planters, coffee bar, water, holo table: where the crew go on breaks
  const plant = (x, y) => PROPS.push({ d: x + y, f: (g, t) => { box(g, x - 7, y - 5, x + 7, y + 5, 0, 6, "#2f2a22"); poly(g, flat(x - 6, y - 4, x + 6, y + 4, 6.05), "#1c2a17");
    for (let k = 0; k < 9; k++) { const px2 = x - 5 + (k % 3) * 5, py = y - 3 + ((k / 3) | 0) * 3, [sx, sy] = P(px2, py, 6), h = 3 + hsh(k, x) % 4; g.fillStyle = k % 2 ? "#5f9a52" : "#7fb86a"; g.beginPath(); g.ellipse(sx, sy - h / 2, 1.6, h / 2 + 0.6, 0, 0, Math.PI * 2); g.fill(); } } });
  plant(SPOTS.tank1[0], SPOTS.tank1[1] - 8); plant(SPOTS.tank3[0], SPOTS.tank3[1] - 8);
  PROPS.push({ d: 376 + 124, f: (g) => { const [x, y] = [376, 124]; box(g, x - 8, y - 4, x + 8, y + 4, 0, 9, "#3a332a"); box(g, x - 5, y - 3, x - 1, y, 9, 2.5, "#e9e5dc"); poly(g, faceN(x + 1, x + 6, y + 4, 4, 7), rgba(C.amber, 0.6)); } });
  PROPS.push({ d: 376 + 240, f: (g) => { const [x, y] = [376, 240]; box(g, x - 4, y - 4, x + 4, y + 4, 0, 10, "#3a332a"); disc(g, x, y, 3.5, 10, 6, "rgba(95,201,192,.45)", "rgba(95,201,192,.3)"); } });
  PROPS.push({ d: 240 + 252, f: (g, t) => { const [x, y] = [240, 252]; box(g, x - 16, y - 4, x + 16, y + 4, 0, 6, "#2c2822"); poly(g, flat(x - 14, y - 3, x + 14, y + 3, 6.05), "#0f2826"); const st = S.stats() || {}, n = Math.min(14, Math.max(3, Math.round((st.links || 40) / 12)));
    for (let k = 0; k < n; k++) { const [sx, sy] = P(x - 12 + (k * 24) / n, y, 6 + 2 + ((hsh(k, 3) % 7) + Math.sin(t / 20 + k)) * 0.8); g.fillStyle = rgba(C.teal, 0.7); g.fillRect(sx - 0.5, sy, 1, P(0, 0, 0)[1] - P(0, 0, 2 + (hsh(k, 3) % 7))[1] + 0); } } });
  // server racks along the north wall (blinking lights = the crew's background jobs)
  for (const x of [36, 48, 432, 444]) PROPS.push({ d: x + 12, f: (g, t) => { box(g, x - 5, 4, x + 5, 12, 0, 26, "#26221c"); for (let k = 0; k < 6; k++) poly(g, faceN(x - 3 + (k % 2) * 4, x - 1 + (k % 2) * 4, 12, 6 + ((k / 2) | 0) * 6, 7.2 + ((k / 2) | 0) * 6), (hsh(k, x) + (t >> 5)) % 4 ? rgba(C.ok, 0.8) : rgba(C.amber, 0.9)); } });
  // stacks of crates in the corners
  for (const [x, y] of [[22, 324], [462, 326], [470, 40]]) PROPS.push({ d: x + y, f: (g) => { box(g, x - 6, y - 5, x + 6, y + 5, 0, 6, "#4a3f2e"); box(g, x - 4, y - 3, x + 2, y + 3, 6, 5, "#55482f"); } });


  // four rooms inside the rail ring, walls-down: a back wall on the north and west sides, open to the front
  const ROOMS = [
    { n: "Servers", r: [82, 110, 186, 162], floor: "#16181a", door: [150, 166] },
    { n: "Briefing", r: [294, 110, 398, 162], floor: "#1b1915", door: [330, 346] },
    { n: "Storage", r: [82, 220, 186, 272], floor: "#1a1814", door: [150, 166] },
    { n: "Lounge", r: [294, 220, 398, 272], floor: "#1d1a15", door: [330, 346] },
  ];
  const wallSeg = (x0, y0, x1, y1, h) => PROPS.push({ d: Math.max(x0, x1) + Math.max(y0, y1) - 6, f: (g) => {
    if (y0 === y1) { box(g, x0, y0 - 2, x1, y0, 0, h, "#3a342b"); for (let x = x0 + 2; x < x1 - 1; x += 6) poly(g, faceN(x, x + 2, y0, h - 3.5, h - 2.5), hsh(x, y0) % 3 ? rgba(C.win, 0.7) : "#14120f"); }
    else { box(g, x0 - 2, y0, x0, y1, 0, h, "#3a342b"); for (let y = y0 + 2; y < y1 - 1; y += 6) poly(g, faceW(y, y + 2, x0, h - 3.5, h - 2.5), hsh(y, x0) % 3 ? rgba(C.win, 0.55) : "#14120f"); } } });
  for (const R of ROOMS) {
    const [x0, y0, x1, y1] = R.r;
    for (let x = x0; x < x1; x += 13) { const xe = Math.min(x1, x + 13); if (xe > R.door[0] && x < R.door[1]) { if (x < R.door[0]) wallSeg(x, y0, R.door[0], y0, 12); if (xe > R.door[1]) wallSeg(R.door[1], y0, xe, y0, 12); continue; } wallSeg(x, y0, xe, y0, 12); }
    for (let y = y0; y < y1; y += 13) { const ye = Math.min(y1, y + 13); if (ye > y0 + 18 && y < y0 + 32) continue; wallSeg(x0, y, x0, ye, 12); }
  }
  // servers: two rows of racks, lights blink with the crew's background work
  for (const ry of [116, 140]) for (let x = 126; x <= 178; x += 13) PROPS.push({ d: x + ry + 8, f: (g, t) => { box(g, x - 5, ry, x + 5, ry + 8, 0, 22, "#25231f");
    for (let k = 0; k < 8; k++) poly(g, faceN(x - 4 + (k % 2) * 5, x - 2 + (k % 2) * 5, ry + 8, 4 + ((k / 2) | 0) * 4.5, 5 + ((k / 2) | 0) * 4.5), (hsh(k, x + ry) + (t >> 5)) % 5 ? rgba(C.ok, 0.75) : rgba(C.amber, 0.95)); } });
  // briefing: a table with a holo map of NWA and chairs
  PROPS.push({ d: 334 + 136, f: (g, t) => { for (const [cx2, cy2] of [[318, 124], [334, 124], [350, 124], [318, 150], [334, 150], [350, 150]]) box(g, cx2 - 3, cy2 - 3, cx2 + 3, cy2 + 3, 0, 4, "#2a251f");
    box(g, 308, 130, 360, 144, 0, 6.5, "#3a342b"); poly(g, flat(311, 132, 357, 142, 6.55), "#0f2826");
    for (let k = 0; k < 18; k++) { const [sx, sy] = P(313 + (hsh(k, 9) % 42), 133 + (hsh(9, k) % 8), 7 + (hsh(k, k) % 5)); g.fillStyle = k % 5 ? rgba(C.teal, 0.8) : C.amber; g.fillRect(sx - 0.6, sy - 0.6, 1.2, 1.2); }
    poly(g, faceN(316, 352, 110, 4, 11), "#0f2826", rgba(C.teal, 0.5), 0.5); } });
  // storage: crates and shelves
  for (const [x, y, w2, h2, c2] of [[100, 232, 7, 8, "#4a3f2e"], [112, 230, 5, 5, "#55482f"], [128, 254, 8, 6, "#4a3f2e"], [172, 236, 6, 10, "#3f3a33"], [170, 258, 5, 5, "#55482f"], [140, 232, 4, 4, "#6a5a3c"]])
    PROPS.push({ d: x + y, f: (g) => { box(g, x - w2, y - w2, x + w2, y + w2, 0, h2, c2); line(g, P(x - w2, y + w2, h2 / 2), P(x + w2, y + w2, h2 / 2), "rgba(0,0,0,.25)", 0.5); } });
  PROPS.push({ d: 86 + 250, f: (g) => { box(g, 84, 228, 90, 268, 0, 18, "#2c2822"); for (const z of [5, 10, 15]) line(g, P(90, 228, z), P(90, 268, z), "#4a4236", 0.6); } });
  // lounge: rug, sofas, a low table
  PROPS.push({ d: 300 + 228, f: (g) => { poly(g, flat(310, 232, 360, 262, 0.05), "#2a2219", rgba(C.amber, 0.25), 0.5); box(g, 306, 228, 364, 234, 0, 5, "#4a3a2c"); box(g, 306, 228, 364, 230, 5, 4, "#55432f"); box(g, 300, 234, 306, 264, 0, 5, "#4a3a2c"); } });
  PROPS.push({ d: 336 + 250, f: (g) => { box(g, 326, 244, 346, 254, 0, 3.5, "#3a342b"); box(g, 332, 247, 336, 251, 3.5, 2, "#d8d2c4"); } });
  // lockers between the north desks, plant beds in the lab, fuel tanks in the hangar
  for (const x of [132, 198, 262, 328]) PROPS.push({ d: x + 10, f: (g) => { box(g, x - 7, 3, x + 7, 9, 0, 18, "#2f2a23"); line(g, P(x, 9, 1), P(x, 9, 17), "#1a1814", 0.6); poly(g, faceN(x - 5, x - 3, 9, 14, 15), rgba(C.amber, 0.8)); } });
  for (const [y0, y1] of [[126, 156], [196, 234], [272, 296]]) PROPS.push({ d: 18 + y1, f: (g) => { box(g, 8, y0, 18, y1, 0, 5, "#2f2a22"); poly(g, flat(9, y0 + 1, 17, y1 - 1, 5.05), "#1c2a17");
    for (let y = y0 + 3; y < y1 - 2; y += 4) for (const x of [11, 15]) { const [sx, sy] = P(x, y, 5), h = 2.5 + hsh(x, y) % 4; g.fillStyle = hsh(y, x) % 2 ? "#5f9a52" : "#7fb86a"; g.beginPath(); g.ellipse(sx, sy - h / 2, 1.5, h / 2 + 0.5, 0, 0, Math.PI * 2); g.fill(); } } });
  for (const y of [296, 196]) PROPS.push({ d: 468 + y, f: (g) => { disc(g, 468, y, 5, 0, 16, "#4a4236", "#2f2a22"); ring(g, 468, y, 5, 8, rgba(C.amber, 0.6), 0.8); } });
  for (const y of [128, 172]) PROPS.push({ d: 428 + y, f: (g) => { box(g, 424, y - 4, 432, y + 4, 0, 9, "#2c2822"); poly(g, flat(425, y - 3, 431, y + 3, 9.05), rgba(C.teal, 0.3)); } });

  function drawCore(g, t, st) {
    const [cx, cy] = CORE, think = !!st.thinking, spin = t * (think ? 0.03 : 0.008), col = think ? C.amber : C.teal;
    disc(g, cx, cy, 40, 0, 3, "#25211b", "#15130f"); disc(g, cx, cy, 32, 3, 3, "#2e2921", "#1a1814"); disc(g, cx, cy, 20, 6, 0.5, "#10171a", null, rgba(col, 0.5)); ring(g, cx, cy, 14, 6.6, rgba(col, 0.25), 0.5); ring(g, cx, cy, 8, 6.6, rgba(col, 0.2), 0.5);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, [sx, sy] = P(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38, 3); g.fillStyle = (k + (t >> 4)) % 8 === 0 ? C.win : rgba(C.amber, 0.55); g.fillRect(sx - 0.7, sy - 0.5, 1.4, 1); }
    const [bx, by] = P(cx, cy, 6), [, ty] = P(cx, cy, 38), beam = g.createLinearGradient(0, by, 0, ty); beam.addColorStop(0, rgba(col, 0.28)); beam.addColorStop(1, rgba(col, 0));
    g.fillStyle = beam; g.fillRect(bx - 5, ty, 10, by - ty);
    const notes = st.notes || 27, nn = Math.min(90, Math.max(8, notes)), back = [], front = [];
    for (let i = 0; i < nn; i++) { const yy = 1 - (i / (nn - 1)) * 2, r = Math.sqrt(1 - yy * yy), a = i * 2.399 + spin * 3, p = [Math.cos(a) * r * 16, Math.sin(a) * r * 16, 38 + yy * 15]; (p[0] + p[1] > 0 ? front : back).push(p); }
    const dot = (p, c, s) => { const [sx, sy] = P(cx + p[0], cy + p[1], p[2]); g.fillStyle = c; g.fillRect(sx - s / 2, sy - s / 2, s, s); };
    back.forEach((p) => dot(p, rgba(col, 0.35), 0.9));
    for (let k = 0; k < 2; k++) { const r = 20 + k * 5, a0 = spin * (k ? -1.4 : 1); for (let j = 0; j < 4; j++) ring(g, cx, cy, r, 38, rgba(col, 0.55 - k * 0.2), 0.6, a0 + j * Math.PI / 2, a0 + j * Math.PI / 2 + 1.1); }
    const [ox, oy] = P(cx, cy, 38); g.globalCompositeOperation = "lighter"; glowAt(g, ox, oy, 22, col, think ? 0.32 : 0.2); g.globalCompositeOperation = "source-over";
    g.fillStyle = "#f4fbfa"; g.beginPath(); g.arc(ox, oy, 1.6, 0, Math.PI * 2); g.fill();
    front.forEach((p) => dot(p, "#eaf6f4", 1.1));
  }
  // while an agent works a job: slide in (first 20%), sit at the desk with a progress ring, slide back out (last 20%)
  function cratePos(c) {
    const stop = STOPS[c.next], f = c.wait > 0 && stop && FEED[stop.id];
    if (!f) return { p: along(c.d), u: -1 };
    const u = 1 - c.wait / (c.w0 || 1), lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], ease = (k) => k * k * (3 - 2 * k);
    return { p: u < 0.2 ? lerp(f.r, f.d, ease(u / 0.2)) : u > 0.8 ? lerp(f.d, f.r, ease((u - 0.8) / 0.2)) : f.d, u, f };
  }
  function arm(g, f, target, t, on) { // a short two-joint inserter on its pedestal, turning toward the job it moves
    const bx = f.r[0] + 7, by = (f.r[1] + f.d[1]) / 2, [sx, sy] = P(bx, by, 3.2), [tx0, ty0] = P(target[0], target[1], 6);
    let dx = tx0 - sx, dy = ty0 - sy; const L = Math.hypot(dx, dy) || 1, reach = on ? 8 : 5; dx = dx / L * reach; dy = dy / L * reach;
    const ex = sx + dx * 0.5 - dy * 0.25, ey = sy + dy * 0.5 - 4.5 + Math.sin(t / 10) * (on ? 0.5 : 0.15), hx = sx + dx, hy = sy + dy - 1.5;
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = "#4a4236"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
    g.strokeStyle = "#a39a8a"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(sx, sy - 0.4); g.lineTo(ex, ey - 0.4); g.lineTo(hx, hy - 0.4); g.stroke();
    g.fillStyle = on ? C.amber : "#6b6252"; g.beginPath(); g.arc(ex, ey, 0.9, 0, 7); g.fill();
    g.strokeStyle = "#cfc8bb"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(hx - 1.2, hy + 0.6); g.lineTo(hx, hy); g.lineTo(hx + 1.2, hy + 0.6); g.stroke(); g.lineCap = "butt";
  }
  function maintBot(g, k, t) { // two little floor robots doing laps of the walkway
    const [x, y] = wPoint(t * (0.32 + k * 0.11) + k * WPER / 2), [sx, sy] = P(x, y, 0);
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx, sy, 3.6, 1.7, 0, 0, 7); g.fill();
    disc(g, x, y, 2.4, 0.4, 1.6, "#d8d2c4", "#9f978a"); disc(g, x, y, 1.3, 2, 0.8, "#2b3a44", "#1d272e");
    if ((t >> 4) % 2) { const [lx, ly] = P(x, y, 3.4); g.fillStyle = k ? C.teal : C.amber; g.fillRect(lx - 0.5, ly - 0.5, 1, 1); }
  }
  function crate(g, c, t) {
    const cp = cratePos(c), [x, y] = cp.p, z = 2 + Math.sin((t + c.bob * 10) / 10) * 0.6;
    const [fx, fy] = P(x, y, 0); g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(fx, fy, 4.5, 2, 0, 0, Math.PI * 2); g.fill();
    box(g, x - 3, y - 3, x + 3, y + 3, z, 5, c.hot ? "#e6b450" : c.col);
    if (c.hot) { const [gx, gy] = P(x, y, z + 8 + Math.sin(t / 7) * 1.5), k = (t + c.bob * 20) % 50; if (k < 12) { g.fillStyle = `rgba(255,240,200,${1 - k / 12})`; g.fillRect(gx - 0.4, gy - 2, 0.8, 4); g.fillRect(gx - 2, gy - 0.4, 4, 0.8); } }
    if (cp.u >= 0.2 && cp.u <= 0.8) { const k = (cp.u - 0.2) / 0.6; ring(g, x, y, 6.5, 0.2, "rgba(255,255,255,.1)", 1.2); ring(g, x, y, 6.5, 0.2, BY[STOPS[c.next].id].c, 1.4, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); }
    if (c.reply) poly(g, flat(x - 1.6, y - 1.6, x + 1.6, y + 1.6, z + 5.05), "#f1ede5");
    if (c.stamp) poly(g, flat(x - 2, y - 2, x + 2, y + 2, z + 5.1), C.ok);
  }
  function ship(g, s) {
    const lift = Math.max(0, s.x - 468) * 0.45, x = s.x, y = s.y, z = 4 + lift, [fx, fy] = P(x, y, 0);
    g.fillStyle = `rgba(0,0,0,${Math.max(0, 0.35 - lift / 120)})`; g.beginPath(); g.ellipse(fx, fy, 6, 2.6, 0, 0, Math.PI * 2); g.fill();
    box(g, x - 7, y - 3, x + 5, y + 3, z, 3, "#d8d2c4"); box(g, x - 4, y - 7, x + 1, y + 7, z + 1, 1, "#9f978a"); box(g, x + 5, y - 2, x + 9, y + 2, z, 2, C.amber);
    const [ex, ey] = P(x - 7, y, z + 1.5); g.globalCompositeOperation = "lighter"; glowAt(g, ex, ey, s.hot ? 12 : 7, s.hot ? "#e6b450" : C.win, 0.6);
    for (let k = 1; k < 8; k++) { const [qx, qy] = P(x - 7 - k * 4, y, z + 1.5 - k * 0.6); g.fillStyle = rgba(s.hot ? "#e6b450" : C.win, 0.35 - k * 0.04); g.fillRect(qx - 0.8, qy - 0.8, 1.6, 1.6); }
    g.globalCompositeOperation = "source-over";
  }
  function parkedShip(g) { const x = 530, y = 228; box(g, x - 9, y - 4, x + 7, y + 4, 0.5, 4, "#cfc8bb"); box(g, x - 5, y - 10, x + 1, y + 10, 1.5, 1.2, "#8f877a"); box(g, x + 7, y - 2.5, x + 12, y + 2.5, 0.5, 3, C.amber); box(g, x - 4, y - 2, x + 2, y + 2, 4.5, 2, "#2b3a44"); }

  // everything that moves, drawn into g (already scaled to station units)
  function drawLive(g) {
    const t = S.t, st = S.stats() || {}; g.lineJoin = "round";
    for (let d = (t * 0.42) % 10; d < RLEN; d += 10) { const [x, y] = along(d), [sx, sy] = P(x, y, 0); g.fillStyle = rgba(C.amber, 0.28); g.fillRect(sx - 0.8, sy - 0.4, 1.6, 0.8); }
    const [cx, cy] = CORE;
    for (const a of actors) {
      if (a.busy <= 0 || a.w.walker || a.w.locked) continue; const [x, y] = a.w.desk, my = (y + cy) / 2, pts = [[cx, cy], [cx, my], [x, my], [x, y + (y < cy ? 6 : -8)]];
      let L = 0; const seg = []; for (let i = 0; i < 3; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); L += l; }
      for (let k = 0; k < 3; k++) { let d = ((t * 0.012 + k / 3) % 1) * L, i = 0; while (i < 2 && d > seg[i]) { d -= seg[i]; i++; } const f = seg[i] ? d / seg[i] : 0, [sx, sy] = P(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, 0); g.fillStyle = a.w.c; g.fillRect(sx - 1, sy - 0.6, 2, 1.2); }
    }
    const items = PROPS.slice();
    items.push({ d: cx + cy, f: () => drawCore(g, t, st) });
    if (!S.ships.length) items.push({ d: 530 + 228, f: () => parkedShip(g) });
    for (const c of S.crates) { const cp = cratePos(c), [x, y] = cp.p; items.push({ d: x + y + 0.5, f: () => crate(g, c, t) }); }
    for (const id in FEED) { const f = FEED[id], c = S.crates.find((q) => q.wait > 0 && STOPS[q.next] && STOPS[q.next].id === id), on = !!c && (1 - c.wait / (c.w0 || 1) < 0.22 || 1 - c.wait / (c.w0 || 1) > 0.78);
      items.push({ d: f.r[0] + 7 + (f.r[1] + f.d[1]) / 2 + 1, f: () => arm(g, f, c ? cratePos(c).p : f.r, t, on) });
      if (on) for (let k = 0; k < 3; k++) { const yy = f.r[1] + (f.d[1] - f.r[1]) * (((t * 0.03 + k / 3) % 1)), [sx, sy] = P(f.r[0], yy, 0.2); g.fillStyle = rgba(C.amber, 0.5); g.fillRect(sx - 1, sy - 0.3, 2, 0.6); } }
    for (let k = 0; k < 2; k++) { const [x, y] = wPoint(t * (0.32 + k * 0.11) + k * WPER / 2); items.push({ d: x + y, f: () => maintBot(g, k, t) }); }
    for (const s of S.ships) items.push({ d: 2000, f: () => ship(g, s) });
    for (const a of actors) {
      const sitting = a.state === "seat" && !a.w.bot, working = a.busy > 0;
      if (a.w.bot) { const lift = a.fly ? Math.sin(Math.min(1, a.fly.u) * Math.PI) * 14 : 0; items.push({ d: a.x + a.y + (a.fly ? 60 : 0), f: () => droneIso(g, a.x, a.y, a.w, t, working && !a.w.locked, lift) }); continue; }
      items.push({ d: (sitting ? a.seat[0] + a.seat[1] : a.x + a.y) + 0.2, f: () => {
        const step = a.state === "walk" ? ((t >> 3) % 2) + 1 : 0, typing = sitting && working ? ((t >> 2) % 2) + 1 : 0;
        person(g, a.x, sitting ? a.seat[1] : a.y, a.w, sitting ? "down" : a.face, step, sitting, typing);
        if (a.w.walker) { const [ex, ey] = P(a.x + 5, a.y - 3, 19 + Math.sin(t / 8) * 1.5); g.fillStyle = "#3d372e"; g.beginPath(); g.arc(ex, ey, 1.8, 0, 7); g.fill(); g.fillStyle = C.red; g.fillRect(ex - 0.5, ey - 0.5, 1, 1); }
      } });
    }
    items.sort((p, q) => p.d - q.d).forEach((i) => i.f(g, t));
    for (const b of S.beams) { const [x0, y0] = P(524, 224, 20), [x1, y1] = P(b.x1, b.y1, 4); line(g, [x0, y0], [x1, y1], rgba(C.teal, b.t / 50), 0.8); }
    for (const p of S.sparks) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + p.t / 5, r = (30 - p.t) / 3, [sx, sy] = P(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 3); g.fillStyle = rgba(p.c, p.t / 30); g.fillRect(sx - 0.5, sy - 0.5, 1, 1); }
  }

  /* ---------- views: any canvas can show the station ---------- */
  const views = [];
  const TOUR = [
    { at: CORE, z: 2.4, tag: "The core", line: (st) => `Jarvis's brain: ${st.notes || 27} notes${st.links ? `, ${st.links} links` : ""}. Every station is wired to it.` },
    { at: [130, 70], z: 2.6, tag: "Scout and Checker", line: () => "The scout drone maps NWA; the Checker proves every fact before anyone builds." },
    { at: [262, 70], z: 2.6, tag: "Builder and Scribe", line: () => "A better site gets built, then a short email that shows it off." },
    { at: [360, 80], z: 2.8, tag: "Auditor", line: () => "Every card gets checked: facts, price, opt-out, address. Nothing slips." },
    { at: [446, 160], z: 2.8, tag: "Your throne", line: (st) => `Finished jobs stack here for your tap.${st.jobsLive ? ` ${st.jobsLive} job${st.jobsLive === 1 ? "" : "s"} live in Jarvis.` : ""}` },
    { at: [500, 226], z: 2.6, tag: "The hangar", line: () => "Approved emails launch from the pad, five a day to start." },
    { at: [300, 300], z: 2.5, tag: "Replies and deals", line: () => "Replies get caught and answered; a yes becomes a proposal and a live site." },
    { at: [40, 210], z: 2.6, tag: "The lab", line: () => "Get Found unlocks with the first client. Degen, the paper-trading bot, is switched off." },
  ];
  const HOME = P(CORE[0] + 20, CORE[1] - 10, 0);
  function mount(canvas, opts = {}) {
    const v = { canvas, g: canvas.getContext("2d"), scale: 1, cx: HOME[0], cy: HOME[1], fit: 1, dpr: 1, stars: [], user: false, active: true, opts, tour: null };
    v.resize = () => {
      const r = canvas.getBoundingClientRect(); if (!r.width) return;
      v.dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(r.width * v.dpr); canvas.height = Math.round(r.height * v.dpr);
      v.fit = Math.min(canvas.width / (SW * 0.9), canvas.height / (SH * 0.9));
      v.home = canvas.height > canvas.width * 1.3 ? Math.min(v.fit * 2.7, canvas.height / SH * 1.2) : v.fit; // tall phones: zoom in, pan sideways
      if (!v.user && !v.tour) { v.scale = v.home; v.cx = HOME[0]; v.cy = HOME[1]; clamp(v); }
      v.stars = Array.from({ length: Math.round(canvas.width * canvas.height / 2600) }, () => ({ x: Math.random(), y: Math.random(), a: 0.12 + Math.random() * 0.5, s: Math.random() < 0.06 ? 1.6 : 1 }));
    };
    v.resize(); window.addEventListener("resize", v.resize);
    const pts = new Map(); let start = null, moved = 0;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; v.tour = null;
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; start = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), scale: v.scale }; } });
    canvas.addEventListener("pointermove", (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1 && start && start.x != null) { const dx = (e.clientX - start.x) * v.dpr, dy = (e.clientY - start.y) * v.dpr; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); v.cx = start.cx - dx / v.scale; v.cy = start.cy - dy / v.scale; v.user = true; clamp(v); }
      if (pts.size === 2 && start && start.dist) { const [a, b] = [...pts.values()]; v.scale = Math.max(v.fit * 0.9, Math.min(v.fit * 6, start.scale * Math.hypot(a[0] - b[0], a[1] - b[1]) / start.dist)); v.user = true; moved = 99; clamp(v); } });
    const up = (e) => { const was = pts.size; pts.delete(e.pointerId); if (was === 1 && moved < 8 && e.type === "pointerup") tap(v, e); if (!pts.size) start = null; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); v.tour = null; v.scale = Math.max(v.fit * 0.9, Math.min(v.fit * 6, v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); v.user = true; clamp(v); }, { passive: false });
    v.zoom = (dir) => { v.tour = null; if (!dir) { v.user = false; v.scale = v.home; v.cx = HOME[0]; v.cy = HOME[1]; clamp(v); return; } v.scale = Math.max(v.fit * 0.9, Math.min(v.fit * 6, v.scale * (dir > 0 ? 1.35 : 1 / 1.35))); v.user = true; clamp(v); };
    v.startTour = () => { v.tour = { i: -1, at: -1e9 }; };
    v.destroy = () => { v.active = false; window.removeEventListener("resize", v.resize); const i = views.indexOf(v); if (i >= 0) views.splice(i, 1); };
    views.push(v); ensureLoop(); return v;
  }
  function clamp(v) { const hw = v.canvas.width / 2 / v.scale, hh = v.canvas.height / 2 / v.scale; v.cx = Math.max(Math.min(hw, SW / 2), Math.min(SW - Math.min(hw, SW / 2), v.cx)); v.cy = Math.max(Math.min(hh, SH / 2), Math.min(SH - Math.min(hh, SH / 2), v.cy)); }
  function toIso(v, e) { const r = v.canvas.getBoundingClientRect(); const sx = (e.clientX - r.left) * v.dpr, sy = (e.clientY - r.top) * v.dpr; return [(sx - v.canvas.width / 2) / v.scale + v.cx, (sy - v.canvas.height / 2) / v.scale + v.cy]; }
  function tap(v, e) {
    const [ix, iy] = toIso(v, e), cb = v.opts.onTap || (() => {}), near = (p, r) => Math.hypot(p[0] - ix, p[1] - iy) < r;
    if (near(P(CORE[0], CORE[1], 26), 26) || Math.hypot(...unP(ix, iy).map((q, i) => q - CORE[i])) < 34) return cb({ kind: "core" });
    const tj = BY.tj.desk; if (near(P(tj[0], tj[1], 10), 22)) return cb({ kind: "throne", worker: BY.tj });
    let best = null, bd = 14;
    for (const a of actors) { const p = P(a.x, a.state === "seat" && !a.w.bot ? a.seat[1] : a.y, a.w.bot ? 15 : 8), d = Math.hypot(p[0] - ix, p[1] - iy); if (d < bd) { bd = d; best = a.w; } }
    for (const w of WORKERS) { if (w.throne) continue; const p = P(w.desk[0], w.desk[1], 8), d = Math.hypot(p[0] - ix, p[1] - iy); if (d < bd) { bd = d; best = w; } }
    if (best) cb({ kind: "worker", worker: best });
  }
  const nm = (w) => w.n.charAt(0) + w.n.slice(1).toLowerCase();
  const MONO = "'IBM Plex Mono', ui-monospace, monospace";
  function plate(g, x, y, w, h, r, fill, stroke) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } }
  function render(v) {
    const c = v.canvas, g = v.g, W = c.width, H = c.height, d = v.dpr; if (!W || !H) return;
    const st = S.stats() || {};
    if (v.tour) { // cinema: glide between stations with a caption
      const now = performance.now();
      if (now - v.tour.at > 6500) { v.tour.i = (v.tour.i + 1) % TOUR.length; v.tour.at = now; }
      const T = TOUR[v.tour.i], z = v.fit * T.z, [ax, ay] = P(T.at[0], T.at[1], 8);
      v.cx += (ax - v.cx) * 0.05; v.cy += (ay - v.cy) * 0.05; v.scale += (z - v.scale) * 0.04; clamp(v);
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = C.space; g.fillRect(0, 0, W, H);
    const pxx = (v.cx - SW / 2) * 0.05 * d, pyy = (v.cy - SH / 2) * 0.05 * d;
    for (const s of v.stars) { g.fillStyle = `rgba(232,228,218,${s.a})`; g.fillRect((((s.x * W - pxx) % W) + W) % W | 0, (((s.y * H - pyy) % H) + H) % H | 0, s.s * d, s.s * d); }
    { const R = Math.max(W, H) * 0.55, px0 = -R * 0.45 - pxx * 2, py0 = -R * 0.5 - pyy * 2; // a planet's dark limb, top left
      const pg = g.createRadialGradient(px0 + R * 0.25, py0 + R * 0.3, R * 0.2, px0, py0, R); pg.addColorStop(0, "#0b0f14"); pg.addColorStop(0.93, "#0d1319"); pg.addColorStop(1, "rgba(90,140,170,.35)");
      g.fillStyle = pg; g.beginPath(); g.arc(px0, py0, R, 0, Math.PI * 2); g.fill(); }
    const ox = W / 2 - v.cx * v.scale, oy = H / 2 - v.cy * v.scale;
    g.imageSmoothingEnabled = true; g.drawImage(base, 0, 0, base.width, base.height, ox, oy, SW * v.scale, SH * v.scale);
    g.setTransform(v.scale, 0, 0, v.scale, ox, oy); drawLive(g); g.setTransform(1, 0, 0, 1, 0, 0);
    // labels and speech, crisp in screen space
    const fs = Math.round(Math.max(10.5 * d, Math.min(13 * d, v.scale * 3.6))); g.font = `500 ${fs}px ${MONO}`; g.textBaseline = "middle";
    const Sx = (x, y, z = 0) => { const [a, b] = P(x, y, z); return [ox + a * v.scale, oy + b * v.scale]; }, q = tjQueue();
    const label = (sx, sy, text, dot, ink) => { const tw = g.measureText(text).width, pw = tw + 22 * d, ph = fs + 8 * d, x = sx - pw / 2;
      plate(g, x, sy, pw, ph, 4 * d, "rgba(12,11,9,.82)", "rgba(245,166,35,.16)"); g.fillStyle = dot; g.beginPath(); g.arc(x + 9 * d, sy + ph / 2, 2.6 * d, 0, 7); g.fill();
      g.fillStyle = ink; g.textAlign = "left"; g.fillText(text, x + 15 * d, sy + ph / 2 + 0.5 * d); };
    const showLabels = v.scale > v.fit * 1.25 || W > 900 * d || !v.tour;
    if (showLabels) for (const w of WORKERS) {
      if (w.walker) continue; const a = A[w.id], live = w.throne ? q > 0 : a && a.busy > 0 && !w.locked;
      const [sx, sy] = Sx(w.desk[0], w.desk[1] + (w.throne ? 18 : w.bot ? 10 : 6));
      label(sx, sy, w.throne ? (q ? `Your throne · ${q} waiting` : "Your throne") : nm(w), w.locked ? C.red : w.throne ? C.amber : live ? C.ok : C.idle, live || w.throne ? C.ink : "#b5ad9f");
    }
    { const [sx, sy] = Sx(CORE[0] + 30, CORE[1] + 30); label(sx, sy, `Jarvis core · ${st.notes || 27} notes${st.jobsLive ? ` · ${st.jobsLive} jobs live` : ""}`, st.thinking ? C.amber : C.teal, C.ink); }
    g.textAlign = "center";
    for (const a of actors) {
      if (!a.bubble) continue; const sitting = a.state === "seat" && !a.w.bot;
      const [sx, sy] = Sx(a.x, sitting ? a.seat[1] : a.y, a.w.bot ? 22 : 18), tw = g.measureText(a.bubble).width + 14 * d, th = fs + 8 * d;
      plate(g, sx - tw / 2, sy - th, tw, th, 4 * d, "rgba(29,27,23,.94)", "rgba(255,255,255,.08)");
      g.fillStyle = C.ink; g.fillText(a.bubble, sx, sy - th / 2 + 0.5 * d);
      if (a.busy > 0 && a.workFor > 1) { const bw = tw - 12 * d; g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(sx - bw / 2, sy + 3 * d, bw, 2 * d); g.fillStyle = C.amber; g.fillRect(sx - bw / 2, sy + 3 * d, bw * (1 - a.busy / a.workFor), 2 * d); }
    }
    for (const p of S.pops) { // small rewards: a tick when a station finishes, "+1 sent" when a ship leaves
      const k = p.t / (p.big ? 90 : 60), [sx, sy] = Sx(p.x, p.y, p.z + (1 - Math.min(1, k)) * 14); g.globalAlpha = Math.min(1, k * 2);
      g.font = `700 ${Math.round((p.big ? 15 : 12) * d)}px Rajdhani, system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = p.c; g.fillText(p.s, sx, sy); g.globalAlpha = 1; }
    if (v.tour && v.tour.i >= 0) { // caption card
      const T = TOUR[v.tour.i], text = T.line(st), pad = 14 * d, f2 = 14 * d, bw = Math.min(W - 24 * d, 460 * d), bx = (W - bw) / 2, bh = 74 * d, by = H - bh - 14 * d;
      plate(g, bx, by, bw, bh, 8 * d, "rgba(14,13,11,.92)", "rgba(245,166,35,.22)");
      g.textAlign = "left"; g.textBaseline = "top"; g.font = `600 ${12 * d}px ${MONO}`; g.fillStyle = C.amber; g.fillText(`${v.tour.i + 1} of ${TOUR.length} · ${T.tag}`, bx + pad, by + 12 * d);
      g.font = `400 ${f2}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`; g.fillStyle = "#d8d2c4"; wrapText(g, text, bx + pad, by + 32 * d, bw - 2 * pad, f2 * 1.35);
    }
  }
  function wrapText(g, s, x, y, w, lh) { const words = s.split(" "); let ln = ""; for (const wd of words) { const tst = ln ? ln + " " + wd : wd; if (g.measureText(tst).width > w && ln) { g.fillText(ln, x, y); y += lh; ln = wd; } else ln = tst; } g.fillText(ln, x, y); }

  let looping = false, lastTs = 0, warmed = false, odd = false;
  function warm() { if (!warmed) { warmed = true; drawBase(); for (let i = 0; i < 2400; i++) step(); S.shipped = 0; S.pops.length = 0; } }
  function ensureLoop() { warm(); if (looping) return; looping = true; requestAnimationFrame(loop); }
  function loop(ts) {
    const live = document.hidden ? [] : views.filter((v) => v.active && v.canvas.isConnected && v.canvas.offsetParent !== null);
    if (!live.length) { lastTs = ts; if (views.length) requestAnimationFrame(loop); else looping = false; return; } // idle until a view shows again
    for (const v of live) if (Math.abs(v.canvas.clientWidth * v.dpr - v.canvas.width) > 2 || Math.abs(v.canvas.clientHeight * v.dpr - v.canvas.height) > 2) v.resize();
    const n = reduce ? 0 : Math.min(4, Math.round((ts - lastTs) / 16.7) || 1); lastTs = ts;
    for (let i = 0; i < n; i++) step();
    odd = !odd; if (odd) live.forEach(render); // draw at 30 fps: smooth enough for small figures, half the battery
    requestAnimationFrame(loop);
  }
  // a flat copy of the live station for hosts that draw it themselves (the Show off gate)
  const world = document.createElement("canvas"); world.width = SW; world.height = SH;
  const wg = world.getContext("2d");
  function drawWorld() { wg.setTransform(1, 0, 0, 1, 0, 0); wg.fillStyle = C.space; wg.fillRect(0, 0, SW, SH); wg.drawImage(base, 0, 0, SW, SH); drawLive(wg); }

  /* ---------- full-screen overlay (used inside Jarvis) ---------- */
  const ICON = {
    tour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
    cards: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="13" height="12" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/></svg>',
    imp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  let ov = null;
  function overlay(opts = {}) {
    if (ov) { ov.el.hidden = false; ov.v.active = true; if (opts.cinema) ov.v.startTour(); ensureLoop(); requestAnimationFrame(() => ov.v.resize()); return ov; }
    if (!document.getElementById("jf-style")) {
      const s = document.createElement("style"); s.id = "jf-style";
      s.textContent = `
.jf-ov{position:fixed;inset:0;z-index:9000;background:#06070a;display:flex;flex-direction:column;color:#e6e1d7;font:15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding-top:env(safe-area-inset-top,0px)}
.jf-ov[hidden]{display:none!important}
.jf-bar{display:flex;align-items:center;gap:8px;min-height:60px;padding:6px max(8px,env(safe-area-inset-right,0px)) 6px max(16px,env(safe-area-inset-left,0px));border-bottom:1px solid rgba(245,166,35,.14)}
.jf-ttl{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.jf-ttl b{font:600 15px/1.2 ${MONO};color:#f5a623}
.jf-line{font:12px/1.3 ${MONO};color:#9a9284;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jf-pop{animation:jfpop .6s ease-out}@keyframes jfpop{0%{color:#e6b450}100%{color:#9a9284}}
@media (prefers-reduced-motion:reduce){.jf-pop{animation:none}}
.jf-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;height:44px;padding:0 12px;background:transparent;border:1px solid rgba(245,166,35,.22);border-radius:6px;color:#e6e1d7;font:500 14px/1 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .15s ease-out}
.jf-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}
.jf-btn:hover{background:rgba(245,166,35,.08)}.jf-btn:focus-visible{outline:2px solid #f5a623;outline-offset:2px}
.jf-btn.pri{background:#f5a623;border-color:#f5a623;color:#1a1206}.jf-btn.pri:hover{background:#ffb84d}
.jf-btn.ic{padding:0;width:44px}
.jf-stage{position:relative;flex:1 1 0;min-height:0;display:flex}
.jf-ov canvas.jf-cv{position:static;inset:auto;flex:1 1 0;width:100%;height:auto;min-height:0;display:block;cursor:grab;z-index:auto;-webkit-mask-image:none;mask-image:none}
.jf-c{position:absolute;width:16px;height:16px;border:0 solid rgba(245,166,35,.5);pointer-events:none}
.jf-c.a{top:10px;left:10px;border-top-width:1px;border-left-width:1px}.jf-c.b{top:10px;right:10px;border-top-width:1px;border-right-width:1px}
.jf-c.c{bottom:10px;left:10px;border-bottom-width:1px;border-left-width:1px}.jf-c.d{bottom:10px;right:10px;border-bottom-width:1px;border-right-width:1px}
.jf-foot{display:flex;gap:12px;align-items:center;padding:8px max(8px,env(safe-area-inset-right,0px)) calc(8px + env(safe-area-inset-bottom,0px)) max(8px,env(safe-area-inset-left,0px));border-top:1px solid rgba(245,166,35,.14);font:12px/1.3 ${MONO};color:#8a8274}
.jf-seg{display:inline-flex;border:1px solid rgba(245,166,35,.22);border-radius:6px;overflow:hidden;flex:none}
.jf-seg button{min-width:44px;height:44px;padding:0 12px;background:none;border:0;color:#e6e1d7;font:500 15px/1 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer}
.jf-seg button+button{border-left:1px solid rgba(245,166,35,.16)}.jf-seg button:hover{background:rgba(245,166,35,.08)}
.jf-card{position:absolute;left:0;right:0;bottom:0;max-width:560px;margin:0 auto;background:#12110f;border:1px solid rgba(245,166,35,.18);border-bottom:0;border-radius:12px 12px 0 0;padding:22px 16px 18px;box-shadow:0 -12px 32px rgba(0,0,0,.5)}
.jf-card::before{content:"";position:absolute;top:8px;left:50%;width:36px;height:4px;margin-left:-18px;border-radius:2px;background:#3a352d}
.jf-card[hidden]{display:none!important}
.jf-card h4{margin:0 52px 6px 0;font:600 17px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#f2eee6;display:flex;align-items:center;gap:8px}
.jf-card h4 i{width:8px;height:8px;border-radius:50%;flex:none}
.jf-card p{margin:0 0 10px;color:#d8d2c4}
.jf-card dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0;font:12.5px/1.45 ${MONO}}
.jf-card dt{color:#8a8274}.jf-card dd{margin:0;color:#d8d2c4}
.jf-card .x{position:absolute;top:10px;right:10px}
.jf-toast{position:absolute;left:50%;transform:translateX(-50%);top:12px;background:#1d1b17;border:1px solid rgba(245,166,35,.3);color:#e6e1d7;padding:10px 14px;border-radius:8px;font-size:14px;max-width:min(90vw,420px);text-align:center}
.jf-toast[hidden]{display:none!important}
@media (max-width:560px){.jf-hint,.jf-long{display:none}.jf-btn{padding:0 10px}.jf-bar{gap:6px}}`;
      document.head.appendChild(s);
    }
    const el = document.createElement("div"); el.className = "jf-ov"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "The factory");
    el.innerHTML = `<div class="jf-bar"><div class="jf-ttl"><b>Factory</b><span class="jf-line" id="jf-line">Sites by TJ crew</span></div>
      <button class="jf-btn" id="jf-tour" type="button" aria-label="Tour">${ICON.tour}<span class="jf-long">Tour</span></button>
      ${opts.onImprove ? `<button class="jf-btn ic" id="jf-imp" type="button" aria-label="Improve the design" title="Improve the design">${ICON.imp}</button>` : ""}
      ${opts.cardsUrl ? `<a class="jf-btn pri" href="${opts.cardsUrl}" target="_blank" rel="noopener">${ICON.cards}<span>Cards</span></a>` : ""}
      <button class="jf-btn ic" id="jf-x" type="button" aria-label="Back to Jarvis">${ICON.x}</button></div>
      <div class="jf-stage"><canvas class="jf-cv" aria-label="The factory: crew passing jobs round the Jarvis core"></canvas>
      <span class="jf-c a"></span><span class="jf-c b"></span><span class="jf-c c"></span><span class="jf-c d"></span>
      <div class="jf-card" hidden></div><div class="jf-toast" hidden></div></div>
      <div class="jf-foot"><div class="jf-seg"><button data-z="-1" type="button" aria-label="Zoom out">−</button><button data-z="1" type="button" aria-label="Zoom in">+</button><button data-z="0" type="button">Fit</button></div><span class="jf-hint">Drag, pinch, tap a worker. Crew motion is a loop; the core's numbers are live.</span></div>`;
    document.body.appendChild(el);
    const card = el.querySelector(".jf-card"), toast = el.querySelector(".jf-toast");
    const say = (m) => { toast.textContent = m; toast.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => (toast.hidden = true), 2600); };
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    const row = (k, val) => (val ? `<dt>${k}</dt><dd>${esc(val)}</dd>` : "");
    const v = mount(el.querySelector(".jf-cv"), { onTap: (hit) => {
      const xb = `<button class="jf-btn ic x" type="button" aria-label="Close">${ICON.x}</button>`;
      if (hit.kind === "core") { const st = S.stats() || {}; card.innerHTML = `${xb}<h4><i style="background:${st.thinking ? C.amber : C.teal}"></i>Jarvis core</h4><p>The brain in the middle of the factory. Every dot is a real note; it turns amber while Jarvis thinks.</p><dl>${row("Notes", st.notes || 27)}${row("Links", st.links)}${row("Lessons", st.lessons)}${row("Jobs", `${st.jobsLive || 0} live · ${st.jobsDone || 0} done`)}</dl>`; }
      else { const w = hit.worker, a = A[w.id], on = a && a.busy > 0 && !w.locked; card.innerHTML = `${xb}<h4><i style="background:${w.locked ? C.red : w.throne ? C.amber : on ? C.ok : C.idle}"></i>${esc(nm(w))}</h4><p>${esc(w.job)}</p><dl>${row("Type", w.throne ? "You" : w.bot ? "Bot (free, no Claude usage)" : "Claude agent")}${row("Runs", w.when)}${row("Load", w.ct)}${row("Latest", w.last)}${row("Rule", w.rules)}</dl>`; }
      card.hidden = false; card.querySelector(".x").onclick = () => (card.hidden = true);
    } });
    el.querySelectorAll("[data-z]").forEach((b) => (b.onclick = () => v.zoom(+b.dataset.z)));
    el.querySelector("#jf-tour").onclick = () => { card.hidden = true; v.startTour(); };
    const close = () => { el.hidden = true; v.active = false; card.hidden = true; v.tour = null; opts.onClose && opts.onClose(); };
    el.querySelector("#jf-x").onclick = close;
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    if (opts.onImprove) el.querySelector("#jf-imp").onclick = async () => { try { const m = await opts.onImprove(); say(m || "Queued: Jarvis will redesign himself and the factory."); } catch { say("Couldn't queue that. Try again in a moment."); } };
    const lineEl = el.querySelector("#jf-line");
    const upd = () => { if (el.hidden) return; const st = S.stats() || {}, busy = actors.filter((a) => a.busy > 0 && !a.w.locked).length; lineEl.textContent = `${S.shipped} sent this visit · ${busy} at work · ${S.crates.length} on the rail${st.jobsLive ? ` · ${st.jobsLive} jobs live` : ""}`;
      if (S.shipped !== upd.last) { upd.last = S.shipped; lineEl.classList.remove("jf-pop"); void lineEl.offsetWidth; lineEl.classList.add("jf-pop"); } };
    upd(); setInterval(upd, 1000);
    ov = { el, v, close };
    if (opts.cinema) v.startTour();
    requestAnimationFrame(() => v.resize());
    return ov;
  }

  window.JarvisFactory = {
    WORKERS, mount, overlay, drawCrew: (g, x, y, w) => crew(g, x, y, w, "down", 0, false, 0),
    setStats(fn) { S.stats = typeof fn === "function" ? fn : () => ({}); },
    setAccent(c) { ACCENT = c || ACCENT; },
    redraw() { drawBase(); },
    isOpen: () => forcedOpen || !!(ov && !ov.el.hidden),
    setOpen(v) { forcedOpen = !!v; }, // the 3D Vault (hud/src/vault-ui.js) covers the page too
    // For hosts that draw the station themselves (Jarvis's Show off flight): steps the crew once and returns the live picture.
    tick() { warm(); if (!looping && !reduce) step(); drawWorld(); return world; },
    ASPECT: SH / SW,
    TOUR,
    status: () => ({ working: actors.filter((a) => a.busy > 0 && !a.w.locked).length, rail: S.crates.length, waiting: tjQueue() }),
    close: () => ov && ov.close(),
  };
})();
