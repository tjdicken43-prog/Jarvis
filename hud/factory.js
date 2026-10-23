/* The Factory: an alien-tech factory floor where TJ's crew works (Sites by TJ).
   One shared engine for the Jarvis page and the Jarvis Station page.
   - JarvisFactory.mount(canvas, opts) draws the live floor into any canvas (drag, pinch, wheel, tap).
   - JarvisFactory.overlay(opts) opens it full screen with its own bar, info card and buttons.
   The walking is for show; the core is Jarvis's real brain (notes, links, jobs) when the host passes stats().
   All art is drawn here in code: our own pixels, no outside images. */
(function () {
  "use strict";
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WW = 480, WH = 340, CORE = [240, 190];

  /* ---------- crew ---------- */
  // bot = GitHub bot (drawn as a hover drone), agent = Claude agent (drawn as a suited crew member)
  const WORKERS = [
    { id: "scout", n: "SCOUT", bot: true, c: "#46c8ff", desk: [100, 70], act: "mapping NWA", holo: "globe", when: "Mondays 6:00", ct: "2,665 scanned", job: "Builds the cold list every Monday from Overture Maps and OpenStreetMap, then checks each website.", last: "Oct 22: 2,665 businesses, 1,098 bad sites, 556 emails.", rules: "Respects robots.txt. Never contacts anyone." },
    { id: "checker", n: "CHECKER", c: "#7bc88a", desk: [165, 70], act: "checking facts", holo: "lens", when: "Daily 5:47", ct: "15 a week", job: "Verifies each lead: open, independent, real problem, real email, every fact with a source.", last: "Starts Monday.", rules: "No source, no claim." },
    { id: "builder", n: "BUILDER", c: "#ff9d2f", desk: [230, 70], act: "building site", holo: "page", when: "Daily 5:47", ct: "10 a week", job: "Writes the copy for a better site; a bot builds the preview and takes the before and after phone pictures.", last: "First trade template made Oct 23.", rules: "Concept preview bar, noindex, removed after 14 days." },
    { id: "scribe", n: "SCRIBE", c: "#b46bff", desk: [295, 70], act: "writing email", holo: "mail", when: "Daily 5:47", ct: "10 a week", job: "Writes one short email and two nudges with the playbook that fits the site's real problem, and explains why it should work.", last: "Starts Monday.", rules: "Postal address, opt-out, honest subject, checked facts only." },
    { id: "auditor", n: "AUDITOR", c: "#e8f0e8", desk: [360, 70], act: "scanning card", holo: "shield", when: "After Scribe", ct: "every card", job: "Blocks any card with placeholder text, a missing link, a wrong price or a missing opt-out.", last: "Starts Monday.", rules: "Never grades its own work." },
    { id: "tj", n: "YOUR THRONE", c: "#ffd34a", desk: [446, 150], act: "", holo: "cards", when: "Whenever you open the job cards", ct: "approve", job: "Finished jobs land here as cards: their site next to ours, a one-line description, one Approve button.", last: "", rules: "Nothing goes out without your tap.", throne: true },
    { id: "sender", n: "SENDER", bot: true, c: "#ffd34a", desk: [446, 214], act: "launching email", holo: "ship", when: "Weekdays 9–11", ct: "locked · warm-up", job: "Sends only approved emails, 5 a day to start, from the hangar. Two nudges on days 3 and 7.", last: "Off until the inbox is warm (2–4 weeks).", rules: "Pauses itself after 3 errors in a row, 2% bounces or one spam mark." },
    { id: "watcher", n: "WATCHER", bot: true, c: "#46c8ff", desk: [446, 270], act: "catching replies", holo: "dish", when: "Every 30 min", ct: "locked", job: "Catches replies, bounces and opt-outs with the dish and stops nudges instantly.", last: "Off until sending starts.", rules: "Opt-outs go on the do-not-contact list forever." },
    { id: "responder", n: "RESPONDER", c: "#ff7ad9", desk: [360, 312], act: "drafting reply", holo: "chat", when: "On a reply", ct: "per reply", job: "Sorts each reply and drafts the answer for your cards. Hot replies ping your phone.", last: "Weeks 2–3.", rules: "Never sends. After 2 emails with no progress, hands it to you to call or drop by." },
    { id: "closer", n: "CLOSER", c: "#ffd34a", desk: [295, 312], act: "writing proposal", holo: "coin", when: "On a yes", ct: "per yes", job: "Proposal page, payment link and simple terms.", last: "Weeks 2–3.", rules: "Prices only from the price list." },
    { id: "launcher", n: "LAUNCHER", c: "#7bc88a", desk: [230, 312], act: "going live", holo: "rocket", when: "On payment", ct: "per client", job: "Puts the paid site live and sends the client the domain steps.", last: "After the first yes.", rules: "Domain always in the client's name." },
    { id: "ledger", n: "LEDGER", bot: true, c: "#ffd34a", desk: [165, 312], act: "counting", holo: "coin", when: "Daily", ct: "$0 · 0 clients", job: "Counts the pipeline, money in, costs and follow-up dates.", last: "No money yet. Honest zero.", rules: "Only real numbers." },
    { id: "keeper", n: "KEEPER", c: "#e8f0e8", desk: [100, 312], act: "writing brief", holo: "page", when: "End of each run", ct: "brief 6:15", job: "Writes the brief lines and refreshes the pages.", last: "Starts Monday.", rules: "Writes what happened, not what was hoped." },
    { id: "getfound", n: "GET FOUND", c: "#46c8ff", desk: [34, 170], act: "locked", holo: "pin", when: "Weekly per client", ct: "unlocks at client 1", job: "Google profile posts, review reply drafts and a monthly report.", last: "Locked until the first client.", rules: "Never writes or buys reviews.", locked: true },
    { id: "degen", n: "DEGEN", bot: true, c: "#ff5c4d", desk: [34, 250], act: "paper trading", holo: "chart", when: "Every 15 min", ct: "paper only", job: "Paper-trades new tokens with fake money to test a strategy.", last: "Running. No real money, ever.", rules: "Paper only." },
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
  const TINT = { scout: "#8a7a66", checker: "#46c8ff", builder: "#7bc88a", scribe: "#ff9d2f", auditor: "#b46bff", tj: "#e8f0e8", sender: "#ffd34a", watcher: "#46c8ff", responder: "#ff7ad9", closer: "#ffd34a", launcher: "#7bc88a", ledger: "#7bc88a", keeper: "#7bc88a" };

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
  const S = { t: 0, crates: [], ships: [], beams: [], sparks: [], nextSpawn: 0, lastApprove: 0, stats: () => ({}) };
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
  function spawn() { if (S.crates.some((c) => c.d < 18)) return; S.crates.push({ d: 0, col: TINT.scout, next: 0, wait: 0, bob: Math.random() * 6 }); S.sparks.push({ x: RAIL[0][0], y: RAIL[0][1], t: 30, c: "#46c8ff" }); }
  function spawnReply() {
    const i = STOP_I.watcher, d = STOPS[i].d - 16; if (S.crates.some((c) => Math.abs(c.d - d) < 16)) return;
    S.beams.push({ x0: 470, y0: 318, x1: along(d)[0], y1: along(d)[1], t: 40 });
    S.crates.push({ d, col: "#46c8ff", next: i, wait: 0, reply: true, bob: 0 });
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
          if (stop.id === "sender") { c.gone = true; const [x, y] = along(c.d); S.ships.push({ x, y, vx: 0.2, t: 0 }); }
        }
        continue;
      }
      let v = 0.42; if (ahead && ahead.d - c.d < 14) v = 0;
      if (stop && c.d + v >= stop.d && c.d <= stop.d + 0.01) {
        c.d = stop.d;
        if (stop.id === "tj") { if (S.t - S.lastApprove > 540) { S.lastApprove = S.t; c.next++; c.col = TINT.tj; c.stamp = 50; } continue; }
        const a = A[stop.id];
        if (a && (a.state === "seat")) { c.wait = a.w.bot ? 100 : 150 + Math.random() * 120; a.busy = c.wait; a.workFor = c.wait; a.bubble = a.w.act; a.bt = c.wait; }
        continue;
      }
      c.d += v; if (c.stamp) c.stamp--;
      if (c.d >= RLEN - 1) { c.gone = true; const [x, y] = along(c.d); S.sparks.push({ x, y, t: 30, c: "#7bc88a" }); }
    }
    S.crates = cs.filter((c) => !c.gone);
    S.ships.forEach((s) => { s.t++; if (s.t < 40) { s.x += (468 - s.x) * 0.05; s.y += (214 - s.y) * 0.08; } else { s.vx += 0.12; s.x += s.vx; } });
    S.ships = S.ships.filter((s) => s.x < WW + 60);
    S.beams.forEach((b) => b.t--); S.beams = S.beams.filter((b) => b.t > 0);
    S.sparks.forEach((p) => p.t--); S.sparks = S.sparks.filter((p) => p.t > 0);
    for (const a of actors) {
      if (a.busy > 0) a.busy--;
      if (a.bt > 0) a.bt--; else a.bubble = "";
      if (a.w.id === "degen") { a.busy = 30; if (S.t % 300 === 0) { a.bubble = Math.random() < 0.5 ? "paper +2.1%" : "paper −0.8%"; a.bt = 160; } continue; }
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
  // hover drone, 9 x 6, centre at (x, y)
  function drone(g, x, y, w, t, busy) {
    const b = Math.sin(t / 9) * 1.2; y = Math.round(y + b);
    px(g, x - 4, y - 3, 9, 1, "#3a4152"); px(g, x - 5, y - 2, 11, 3, "#2a2f3c"); px(g, x - 3, y + 1, 7, 1, "#1c2029");
    px(g, x - 1, y - 2, 3, 2, w.c); px(g, x, y - 2, 1, 1, "#ffffff");
    px(g, x - 5, y - 3, 1, 1, w.c); px(g, x + 5, y - 3, 1, 1, w.c);
    const f = (t >> 2) % 2; px(g, x - 3, y + 2, 1, 1 + f, busy ? "#9ff" : "#4ad"); px(g, x + 3, y + 2, 1, 1 + (1 - f), busy ? "#9ff" : "#4ad");
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

  /* ---------- static layer: hull, floor, rail, stations ---------- */
  const base = document.createElement("canvas"); base.width = WW; base.height = WH;
  const STARS = Array.from({ length: 50 }, (_, i) => [(i * 97) % WW, (i * 53) % 26 + 10]);
  function drawBase() {
    const g = base.getContext("2d"); g.imageSmoothingEnabled = false; g.clearRect(0, 0, WW, WH);
    const oct = (x0, y0, x1, y1, b) => { g.beginPath(); g.moveTo(x0 + b, y0); g.lineTo(x1 - b, y0); g.lineTo(x1, y0 + b); g.lineTo(x1, y1 - b); g.lineTo(x1 - b, y1); g.lineTo(x0 + b, y1); g.lineTo(x0, y1 - b); g.lineTo(x0, y0 + b); g.closePath(); };
    // hull and bio-veined walls
    g.fillStyle = "#17121f"; oct(0, 0, WW, WH, 22); g.fill();
    g.fillStyle = "#0a0d12"; oct(10, 44, WW - 10, WH - 10, 16); g.fill();
    // hex floor with glowing seams
    const hx = 8, hy = 7;
    for (let row = 0; row * hy < WH; row++) for (let col = 0; col * hx * 1.5 < WW; col++) {
      const x = col * hx * 1.5 + 10, y = row * hy + (col % 2 ? hy / 2 : 0) + 44; if (y > WH - 14 || x > WW - 14) continue;
      g.fillStyle = (row * 7 + col * 3) % 11 === 0 ? "#0f1720" : "#0c1118"; g.fillRect(x, y, hx, hy - 1);
      g.fillStyle = "#141c26"; g.fillRect(x, y, hx, 1);
      if ((row * 13 + col * 5) % 37 === 0) { g.fillStyle = "rgba(63,242,208,.35)"; g.fillRect(x + 1, y + hy - 2, hx - 2, 1); }
    }
    // top wall: big viewports onto space
    g.fillStyle = "#1d1727"; g.fillRect(22, 8, WW - 44, 36);
    [[40, 12, 120], [180, 12, 120], [320, 12, 120]].forEach(([x, y, w]) => {
      g.fillStyle = "#030208"; g.fillRect(x, y, w, 26);
      STARS.forEach(([sx, sy]) => { if (sx > x && sx < x + w) { g.fillStyle = (sx + sy) % 3 ? "rgba(220,220,255,.7)" : "rgba(180,120,255,.9)"; g.fillRect(sx, sy, 1, 1); } });
      g.fillStyle = "rgba(120,60,200,.18)"; g.fillRect(x + w * 0.55, y + 4, 30, 14);
      g.fillStyle = "#3b3150"; g.fillRect(x - 2, y - 2, w + 4, 2); g.fillRect(x - 2, y + 26, w + 4, 2);
      for (let k = 0; k <= w; k += 30) g.fillRect(x + k - 1, y, 2, 26);
    });
    // bio veins along the walls
    g.fillStyle = "rgba(160,80,255,.35)";
    for (let x = 30; x < WW - 30; x += 3) g.fillRect(x, 41 + Math.round(Math.sin(x / 9) * 1.5), 1, 1);
    for (let y = 60; y < WH - 30; y += 3) { g.fillRect(5 + Math.round(Math.sin(y / 7)), y, 1, 1); g.fillRect(WW - 6 + Math.round(Math.sin(y / 7)), y, 1, 1); }
    // plasma tubes on the side walls
    [[14, 80], [14, 200], [WW - 18, 70]].forEach(([x, y]) => { g.fillStyle = "#26303d"; g.fillRect(x - 1, y - 2, 6, 40); g.fillStyle = "#0e2a33"; g.fillRect(x, y, 4, 36); });
    // hangar airlock on the right wall (Sender launches emails into space)
    g.fillStyle = "#26303d"; g.fillRect(WW - 14, 196, 14, 40); g.fillStyle = "#030208"; g.fillRect(WW - 10, 200, 10, 32);
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? "#1a1510" : "#c9a227"; g.fillRect(WW - 16, 196 + k * 5, 2, 5); }
    // reply dish on the bottom-right
    g.fillStyle = "#3a4152"; g.fillRect(WW - 22, WH - 30, 2, 14); g.fillStyle = "#cfd3dc"; for (let k = 0; k < 9; k++) g.fillRect(WW - 26 + k, WH - 32 - Math.abs(k - 4), 1, 1);
    // rail: magnetic track (the crates hover above it)
    for (let i = 0; i < RAIL.length - 1; i++) {
      const a = RAIL[i], b = RAIL[i + 1], x0 = Math.min(a[0], b[0]) - 3, y0 = Math.min(a[1], b[1]) - 3, w = Math.abs(b[0] - a[0]) + 7, h = Math.abs(b[1] - a[1]) + 7;
      g.fillStyle = "#06080b"; g.fillRect(x0, y0, w, h);
      g.fillStyle = "#2a3646"; if (w > h) { g.fillRect(x0, y0, w, 1); g.fillRect(x0, y0 + h - 1, w, 1); } else { g.fillRect(x0, y0, 1, h); g.fillRect(x0 + w - 1, y0, 1, h); }
    }
    // the core pit: rings of machinery round Jarvis's brain
    const [cx, cy] = CORE;
    for (let r = 42; r > 24; r -= 1) { g.fillStyle = r % 4 === 0 ? "#1c2533" : r > 36 ? "#121924" : "#0b0f16"; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#05070a"; g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillStyle = "#2c3a4e"; g.fillRect(Math.round(cx + Math.cos(a) * 39) - 1, Math.round(cy + Math.sin(a) * 39) - 1, 3, 3); }
    // conduits: one from the core to every station (they light up when that station works)
    g.strokeStyle = "#141c27"; g.lineWidth = 3;
    WORKERS.forEach((w) => { if (w.walker) return; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, (w.desk[1] + cy) / 2); g.lineTo(w.desk[0], (w.desk[1] + cy) / 2); g.lineTo(w.desk[0], w.desk[1] + (w.desk[1] < cy ? 6 : -10)); g.stroke(); });
    // re-lay the rail over the conduits
    for (let i = 0; i < RAIL.length - 1; i++) { const a = RAIL[i], b = RAIL[i + 1]; g.fillStyle = "#06080b"; g.fillRect(Math.min(a[0], b[0]) - 2, Math.min(a[1], b[1]) - 2, Math.abs(b[0] - a[0]) + 5, Math.abs(b[1] - a[1]) + 5); }
    // bio tanks inside the ring (alien plants in glowing fluid)
    Object.entries(SPOTS).forEach(([k, [x, y]]) => {
      if (!k.startsWith("tank")) return;
      g.fillStyle = "#26303d"; g.fillRect(x - 7, y - 16, 14, 18); g.fillStyle = "#0d2a2a"; g.fillRect(x - 5, y - 14, 10, 13);
      g.fillStyle = "#2e8c5a"; g.fillRect(x - 1, y - 9, 2, 8); g.fillRect(x - 3, y - 11, 2, 3); g.fillRect(x + 1, y - 12, 2, 4); g.fillStyle = "#7bf0b0"; g.fillRect(x - 3, y - 12, 1, 1); g.fillRect(x + 2, y - 13, 1, 1);
      g.fillStyle = "#3a4152"; g.fillRect(x - 7, y + 2, 14, 2);
    });
    // holotable at the bottom of the ring
    g.fillStyle = "#1c2533"; g.fillRect(222, 246, 36, 10); g.fillStyle = "#2c3a4e"; g.fillRect(222, 246, 36, 1);
    // stations
    WORKERS.forEach((w) => {
      if (w.walker) return; const [x, y] = w.desk;
      if (w.throne) { // raised gold command platform
        g.fillStyle = "#3a2f10"; g.fillRect(x - 18, y - 16, 36, 30); g.fillStyle = "#5a4818"; g.fillRect(x - 16, y - 14, 32, 26);
        g.fillStyle = "#ffd34a"; g.fillRect(x - 18, y - 16, 36, 1); g.fillRect(x - 18, y + 13, 36, 1);
        g.fillStyle = "#2a2f3c"; g.fillRect(x - 5, y - 12, 10, 12); g.fillStyle = "#ffd34a"; g.fillRect(x - 5, y - 12, 10, 1);
        g.fillStyle = "#1c2029"; g.fillRect(x - 12, y + 2, 24, 6); g.fillStyle = "#ffd34a"; g.fillRect(x - 12, y + 2, 24, 1);
        return;
      }
      if (w.bot) { // drone dock: a glowing pad
        g.fillStyle = "#1c2533"; g.fillRect(x - 9, y - 4, 18, 8); g.fillStyle = "#2c3a4e"; g.fillRect(x - 9, y - 4, 18, 1);
        g.fillStyle = rgba(w.c, 0.5); g.fillRect(x - 6, y - 1, 12, 1); g.fillRect(x - 4, y + 1, 8, 1);
        g.fillStyle = "#26303d"; g.fillRect(x + 10, y - 12, 6, 14); g.fillStyle = "#0a0d12"; g.fillRect(x + 11, y - 11, 4, 5);
        return;
      }
      // agent console: curved alien desk with a screen
      g.fillStyle = "#151a24"; g.fillRect(x - 6, y - 16, 12, 9); g.fillStyle = "#222a38"; g.fillRect(x - 5, y - 15, 10, 3); // chair
      g.fillStyle = "#26303d"; g.fillRect(x - 13, y - 6, 26, 6); g.fillRect(x - 15, y - 4, 2, 4); g.fillRect(x + 13, y - 4, 2, 4);
      g.fillStyle = rgba(w.c, 0.7); g.fillRect(x - 13, y - 6, 26, 1);
      g.fillStyle = "#1a202b"; g.fillRect(x - 13, y, 26, 6); g.fillStyle = "#0b0f16"; g.fillRect(x - 11, y + 6, 22, 2);
      g.fillStyle = "#0a0d12"; g.fillRect(x - 6, y - 13, 12, 7);
      if (w.locked) for (let i = 0; i < 34; i += 4) { g.fillStyle = (i / 4) % 2 ? "#1a1510" : "#c9a227"; g.fillRect(x - 17 + i, y + 9, 4, 2); }
    });
  }

  /* ---------- the living world, drawn once per frame ---------- */
  const world = document.createElement("canvas"); world.width = WW; world.height = WH;
  const wg = world.getContext("2d");
  let ACCENT = "#ffaa33";
  function drawWorld() {
    const g = wg, t = S.t, st = S.stats() || {}; g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, WW, WH); g.drawImage(base, 0, 0);
    // plasma bubbles
    [[14, 80], [14, 200], [WW - 18, 70]].forEach(([x, y], i) => { for (let k = 0; k < 4; k++) { const yy = y + 34 - ((t * 0.4 + k * 9 + i * 5) % 34); px(g, x + 1 + (k % 2) * 2, Math.round(yy), 1, 1, "#5ff2ff"); } px(g, x, y, 4, 36, "rgba(63,200,255,.10)"); });
    // rail energy
    for (let d = (t * 0.42) % 8; d < RLEN; d += 8) { const [x, y] = along(d); px(g, Math.round(x), Math.round(y), 1, 1, "rgba(63,242,208,.55)"); }
    // conduits pulse toward busy stations
    const [cx, cy] = CORE;
    for (const a of actors) {
      if (a.busy <= 0 || a.w.walker) continue; const [x, y] = a.w.desk, my = (y + cy) / 2;
      const pts = [[cx, cy], [cx, my], [x, my], [x, y + (y < cy ? 6 : -10)]];
      for (let k = 0; k < 3; k++) {
        let u = ((t * 0.012 + k / 3) % 1), L = 0; const seg = []; for (let i = 0; i < 3; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); L += l; }
        let d = u * L, i = 0; while (i < 2 && d > seg[i]) { d -= seg[i]; i++; } const f = seg[i] ? d / seg[i] : 0;
        px(g, Math.round(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f) - 1, Math.round(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f) - 1, 2, 2, a.w.c);
      }
    }
    // JARVIS CORE: the brain in the middle of the factory (real notes when the host passes them)
    const notes = st.notes || 27, think = !!st.thinking, spin = t * (think ? 0.03 : 0.008);
    for (let k = 0; k < 3; k++) { // rotating rings
      const r = 30 - k * 3, a0 = spin * (k % 2 ? -1 : 1) * (1 + k * 0.4);
      for (let j = 0; j < 40; j++) { if ((j + k) % 5 === 0) continue; const a = a0 + j / 40 * Math.PI * 2; px(g, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.9), 1, 1, k === 1 ? "#7a3cff" : "#3ff2d0"); }
    }
    const nn = Math.min(60, Math.max(8, notes));
    for (let i = 0; i < nn; i++) { // every note a star inside the orb
      const ph = i * 2.399, yy = 1 - (i / (nn - 1)) * 2, rr = Math.sqrt(1 - yy * yy), a = ph + spin * 3;
      const x3 = Math.cos(a) * rr, z3 = Math.sin(a) * rr, x = cx + x3 * 15, y = cy + yy * 14 * 0.92 + z3 * 3;
      px(g, Math.round(x), Math.round(y), 1, 1, z3 > 0 ? "#e8f6ff" : "rgba(120,180,255,.6)");
    }
    const pulse = 0.5 + 0.5 * Math.sin(t / (think ? 6 : 18));
    px(g, cx - 2, cy - 2, 4, 4, think ? "#ffd34a" : "#9ff7ff"); px(g, cx - 1, cy - 3, 2, 6, "#ffffff");
    // crates: anti-grav cubes
    for (const c of S.crates) {
      const [x0, y0] = along(c.d), x = Math.round(x0), y = Math.round(y0 - 3 + Math.sin((t + c.bob * 10) / 10));
      px(g, x - 3, Math.round(y0) + 1, 7, 1, "rgba(63,242,208,.35)");
      px(g, x - 3, y - 4, 6, 5, c.col); px(g, x - 3, y - 4, 6, 1, "rgba(255,255,255,.45)"); px(g, x, y - 4, 1, 5, "rgba(0,0,0,.3)");
      if (c.reply) { px(g, x - 2, y - 3, 4, 3, "#ffffff"); px(g, x - 1, y - 2, 2, 1, c.col); }
      if (c.stamp) px(g, x - 2, y - 9, 5, 3, "#7bc88a");
    }
    // the throne: a pile of job cards waiting for TJ
    const q = tjQueue(), tj = BY.tj.desk;
    for (let i = 0; i < Math.min(q, 5); i++) px(g, tj[0] + 6, tj[1] - 2 - i * 2, 8, 2, i % 2 ? "#e8f0e8" : "#cfd6dc");
    if (q && (t >> 4) % 2) px(g, tj[0] - 4, tj[1] - 11, 8, 4, "#ffd34a");
    // ships leaving through the airlock
    for (const s of S.ships) { px(g, Math.round(s.x) - 3, Math.round(s.y), 6, 2, "#ffd34a"); px(g, Math.round(s.x) + 3, Math.round(s.y), 1, 1, "#fff"); for (let k = 1; k < 6; k++) px(g, Math.round(s.x) - 3 - k * 2, Math.round(s.y), 1, 1, `rgba(255,211,74,${0.6 - k * 0.1})`); }
    for (const b of S.beams) { g.strokeStyle = `rgba(70,200,255,${b.t / 40})`; g.lineWidth = 1; g.beginPath(); g.moveTo(b.x0, b.y0); g.lineTo(b.x1, b.y1); g.stroke(); }
    for (const p of S.sparks) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + p.t / 5, r = (30 - p.t) / 3; px(g, Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r), 1, 1, p.c); }
    // crew + stations, back to front
    const items = [];
    for (const a of actors) {
      const sitting = a.state === "seat" && !a.w.bot, working = a.busy > 0;
      if (a.w.bot) { items.push({ y: a.y + 4, f: () => { px(g, Math.round(a.x) - 3, a.seat[1] + 8, 7, 1, "rgba(0,0,0,.5)"); drone(g, Math.round(a.x), a.y, a.w, t, working); if (working && !a.fly) { g.fillStyle = rgba(a.w.c, 0.18); g.beginPath(); g.moveTo(a.x, a.y + 2); g.lineTo(a.x - 6, a.y + 12); g.lineTo(a.x + 6, a.y + 12); g.fill(); } } }); }
      else items.push({ y: sitting ? a.w.desk[1] - 6.5 : a.y, f: () => {
        const step = a.state === "walk" ? ((S.t >> 3) % 2) + 1 : 0, typing = sitting && working ? ((S.t >> 2) % 2) + 1 : 0;
        const x = Math.round(a.x), y = Math.round(sitting ? a.seat[1] : a.y);
        if (!sitting) px(g, x - 3, y, 7, 2, "rgba(0,0,0,.4)");
        crew(g, x, y, a.w, sitting ? "down" : a.face === "up" ? "up" : a.face === "down" ? "down" : a.face, step, sitting, typing);
        if (a.w.walker) { const ex = x + 6, ey = y - 14 + Math.round(Math.sin(t / 8) * 1.5); px(g, ex - 1, ey - 1, 3, 3, "#cfd3dc"); px(g, ex, ey, 1, 1, "#ff5c4d"); }
      } });
      if (sitting) items.push({ y: a.w.desk[1] - 5, f: () => { const [x, y] = a.w.desk; px(g, x - 5, y - 12, 10, 5, working ? a.w.c : "#151a22"); if (working) for (let i = 0; i < 3; i++) px(g, x - 4, y - 11 + ((i * 2 + (t >> 3)) % 4), 2 + ((i * 3 + (t >> 4)) % 6), 1, "rgba(0,0,0,.45)"); } });
    }
    items.sort((p, q2) => p.y - q2.y).forEach((i) => i.f());
    // holograms over busy stations, and the throne hologram when cards wait
    for (const a of actors) if (a.busy > 0 && !a.fly && a.w.holo) { const [x, y] = a.w.desk; holo(g, a.w.holo, x, y - (a.w.bot ? 26 : 24), a.w.c, t); g.fillStyle = rgba(a.w.c, 0.12); g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x - 7, y - 24); g.lineTo(x + 7, y - 24); g.fill(); }
    if (q) holo(g, "cards", tj[0], tj[1] - 26, "#ffd34a", t);
    // lighting: darken, then add glows
    g.fillStyle = "rgba(2,3,8,.30)"; g.fillRect(0, 0, WW, WH);
    g.globalCompositeOperation = "lighter";
    const glow = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
    glow(cx, cy, 52, think ? "#ffd34a" : "#3ff2d0", 0.22 + pulse * 0.12); glow(cx, cy, 16, "#ffffff", 0.25);
    for (const a of actors) if (a.busy > 0 && !a.fly) glow(a.w.desk[0], a.w.desk[1] - 8, 22, a.w.c, 0.22);
    glow(tj[0], tj[1] - 4, 30, "#ffd34a", q ? 0.3 : 0.12);
    [[14, 80], [14, 200], [WW - 18, 70]].forEach(([x, y]) => glow(x + 2, y + 18, 16, "#3fc8ff", 0.14));
    glow(WW - 6, 216, 20, "#ffd34a", 0.12);
    for (const s of S.ships) glow(s.x, s.y, 10, "#ffd34a", 0.4);
    g.globalCompositeOperation = "source-over";
  }

  /* ---------- views: any canvas can show the floor ---------- */
  const views = [];
  const TOUR = [
    { at: CORE, z: 2.2, tag: "THE CORE", line: (st) => `Jarvis's brain: ${st.notes || 27} notes${st.links ? `, ${st.links} links` : ""}. Every station is wired to it.` },
    { at: [130, 70], z: 2.4, tag: "SCOUT · CHECKER", line: () => "The scout drone maps NWA; the Checker proves every fact before anyone builds." },
    { at: [262, 70], z: 2.4, tag: "BUILDER · SCRIBE", line: () => "A better site gets built, then a short email that shows it off." },
    { at: [360, 80], z: 2.6, tag: "AUDITOR", line: () => "Every card gets scanned: facts, price, opt-out, address. Nothing slips." },
    { at: [446, 160], z: 2.6, tag: "YOUR THRONE", line: (st) => `Finished jobs stack here for your tap.${st.jobsLive ? ` ${st.jobsLive} job${st.jobsLive === 1 ? "" : "s"} live in Jarvis.` : ""}` },
    { at: [446, 222], z: 2.6, tag: "THE HANGAR", line: () => "Approved emails launch from here, five a day to start." },
    { at: [300, 300], z: 2.3, tag: "REPLIES · DEALS", line: () => "Replies get caught and answered; a yes becomes a proposal and a live site." },
    { at: [60, 210], z: 2.4, tag: "THE LAB", line: () => "Get Found unlocks with the first client. Degen paper-trades, fake money only." },
  ];
  function mount(canvas, opts = {}) {
    const v = { canvas, g: canvas.getContext("2d"), scale: 1, cx: WW / 2, cy: WH / 2, fit: 1, dpr: 1, stars: [], user: false, active: true, opts, tour: null };
    v.resize = () => {
      const r = canvas.getBoundingClientRect(); if (!r.width) return;
      v.dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(r.width * v.dpr); canvas.height = Math.round(r.height * v.dpr);
      v.fit = Math.min(canvas.width / (WW + 12), canvas.height / (WH + 12));
      v.home = canvas.height > canvas.width * 1.3 ? Math.min(v.fit * 1.7, canvas.height * 0.62 / WH) : v.fit; // tall phones: fill the height, pan sideways
      if (!v.user && !v.tour) { v.scale = v.home; v.cx = WW / 2; v.cy = WH / 2; clamp(v); }
      v.stars = Array.from({ length: Math.round(canvas.width * canvas.height / 2400) }, () => ({ x: Math.random(), y: Math.random(), a: 0.15 + Math.random() * 0.6, s: Math.random() < 0.08 ? 2 : 1, c: Math.random() < 0.25 }));
    };
    v.resize(); window.addEventListener("resize", v.resize);
    const pts = new Map(); let start = null, moved = 0;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; v.tour = null;
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; start = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), scale: v.scale }; } });
    canvas.addEventListener("pointermove", (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1 && start && start.x != null) { const dx = (e.clientX - start.x) * v.dpr, dy = (e.clientY - start.y) * v.dpr; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); v.cx = start.cx - dx / v.scale; v.cy = start.cy - dy / v.scale; v.user = true; clamp(v); }
      if (pts.size === 2 && start && start.dist) { const [a, b] = [...pts.values()]; v.scale = Math.max(v.fit * 0.9, Math.min(v.fit * 5, start.scale * Math.hypot(a[0] - b[0], a[1] - b[1]) / start.dist)); v.user = true; moved = 99; clamp(v); } });
    const up = (e) => { const was = pts.size; pts.delete(e.pointerId); if (was === 1 && moved < 8 && e.type === "pointerup") tap(v, e); if (!pts.size) start = null; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); v.tour = null; v.scale = Math.max(v.fit * 0.9, Math.min(v.fit * 5, v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); v.user = true; clamp(v); }, { passive: false });
    v.zoom = (dir) => { v.tour = null; if (!dir) { v.user = false; v.scale = v.home; v.cx = WW / 2; v.cy = WH / 2; clamp(v); return; } v.scale = Math.max(v.fit * 0.9, Math.min(v.fit * 5, v.scale * (dir > 0 ? 1.35 : 1 / 1.35))); v.user = true; clamp(v); };
    v.startTour = () => { v.tour = { i: -1, at: -1e9 }; };
    v.destroy = () => { v.active = false; window.removeEventListener("resize", v.resize); const i = views.indexOf(v); if (i >= 0) views.splice(i, 1); };
    views.push(v); ensureLoop(); return v;
  }
  function clamp(v) { const hw = v.canvas.width / 2 / v.scale, hh = v.canvas.height / 2 / v.scale; v.cx = Math.max(Math.min(hw, WW / 2), Math.min(WW - Math.min(hw, WW / 2), v.cx)); v.cy = Math.max(Math.min(hh, WH / 2), Math.min(WH - Math.min(hh, WH / 2), v.cy)); }
  function toWorld(v, e) { const r = v.canvas.getBoundingClientRect(); const sx = (e.clientX - r.left) * v.dpr, sy = (e.clientY - r.top) * v.dpr; return [(sx - v.canvas.width / 2) / v.scale + v.cx, (sy - v.canvas.height / 2) / v.scale + v.cy]; }
  function tap(v, e) {
    const [x, y] = toWorld(v, e), cb = v.opts.onTap || (() => {});
    if (Math.hypot(x - CORE[0], y - CORE[1]) < 30) return cb({ kind: "core" });
    const tj = BY.tj.desk; if (Math.abs(x - tj[0]) < 20 && Math.abs(y - tj[1]) < 18) return cb({ kind: "throne", worker: BY.tj });
    let best = null, bd = 18;
    for (const a of actors) { const d = Math.hypot(a.x - x, a.y - 6 - y); if (d < bd) { bd = d; best = a.w; } }
    for (const w of WORKERS) { if (w.throne) continue; const d = Math.hypot(w.desk[0] - x, w.desk[1] - 4 - y); if (d < bd) { bd = d; best = w; } }
    if (best) cb({ kind: "worker", worker: best });
  }
  function render(v) {
    const c = v.canvas, g = v.g, W = c.width, H = c.height; if (!W || !H) return;
    const st = S.stats() || {};
    if (v.tour) { // cinema: glide between stations with a caption
      const now = performance.now();
      if (now - v.tour.at > 6500) { v.tour.i = (v.tour.i + 1) % TOUR.length; v.tour.at = now; }
      const T = TOUR[v.tour.i], z = v.fit * T.z;
      v.cx += (T.at[0] - v.cx) * 0.05; v.cy += (T.at[1] - v.cy) * 0.05; v.scale += (z - v.scale) * 0.04; clamp(v);
    }
    g.imageSmoothingEnabled = false; g.fillStyle = "#020106"; g.fillRect(0, 0, W, H);
    const neb = g.createRadialGradient(W * 0.78, H * 0.25, 0, W * 0.78, H * 0.25, Math.max(W, H) * 0.65); neb.addColorStop(0, "rgba(110,50,190,.22)"); neb.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = neb; g.fillRect(0, 0, W, H);
    const neb2 = g.createRadialGradient(W * 0.15, H * 0.85, 0, W * 0.15, H * 0.85, Math.max(W, H) * 0.5); neb2.addColorStop(0, "rgba(30,140,160,.14)"); neb2.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = neb2; g.fillRect(0, 0, W, H);
    const pxx = (v.cx - WW / 2) * 0.06 * v.dpr, pyy = (v.cy - WH / 2) * 0.06 * v.dpr;
    for (const s of v.stars) { g.fillStyle = s.c ? `rgba(190,150,255,${s.a})` : `rgba(230,235,255,${s.a})`; g.fillRect((((s.x * W - pxx) % W) + W) % W | 0, (((s.y * H - pyy) % H) + H) % H | 0, s.s, s.s); }
    const ox = W / 2 - v.cx * v.scale, oy = H / 2 - v.cy * v.scale;
    g.drawImage(world, 0, 0, WW, WH, Math.round(ox), Math.round(oy), Math.round(WW * v.scale), Math.round(WH * v.scale));
    // labels and speech bubbles, crisp in screen space
    const fs = Math.max(11 * v.dpr, Math.min(17 * v.dpr, v.scale * 4.4)); g.font = `${fs}px VT323, 'IBM Plex Mono', monospace`; g.textAlign = "center"; g.textBaseline = "top";
    const Sx = (x, y) => [ox + x * v.scale, oy + y * v.scale], q = tjQueue();
    const showLabels = v.scale > v.fit * 1.25 || W > 900 * v.dpr || !v.tour;
    if (showLabels) for (const w of WORKERS) {
      if (w.walker) continue; const [sx, sy] = Sx(w.desk[0], w.desk[1] + (w.throne ? 16 : w.bot ? 6 : 9)), a = A[w.id];
      const live = w.throne ? q > 0 : a && a.busy > 0, label = w.throne ? (q ? `YOUR THRONE · ${q} WAITING` : "YOUR THRONE") : w.n;
      const tw = g.measureText(label).width + 8 * v.dpr; g.fillStyle = "rgba(0,0,0,.72)"; g.fillRect(sx - tw / 2, sy, tw, fs + 2 * v.dpr);
      g.fillStyle = w.throne ? "#ffd34a" : live ? "#7bc88a" : w.locked ? "#ff5c4d" : "rgba(200,190,230,.75)"; g.fillText(label, sx, sy + v.dpr);
    }
    { const [sx, sy] = Sx(CORE[0], CORE[1] + 44); const label = `JARVIS CORE · ${st.notes || 27} NOTES${st.jobsLive ? ` · ${st.jobsLive} JOBS LIVE` : ""}`; const tw = g.measureText(label).width + 8 * v.dpr; g.fillStyle = "rgba(0,0,0,.72)"; g.fillRect(sx - tw / 2, sy, tw, fs + 2 * v.dpr); g.fillStyle = st.thinking ? "#ffd34a" : "#9ff7ff"; g.fillText(label, sx, sy + v.dpr); }
    for (const a of actors) {
      if (!a.bubble) continue; const sitting = a.state === "seat";
      const [sx, sy] = Sx(a.x, (a.w.bot ? a.y - 6 : (sitting && !a.w.bot ? a.seat[1] : a.y)) - 16), t2 = a.bubble;
      const tw = g.measureText(t2).width + 10 * v.dpr, th = fs + 4 * v.dpr;
      g.fillStyle = "rgba(232,236,255,.95)"; g.fillRect(sx - tw / 2, sy - th, tw, th); g.fillRect(sx - 2 * v.dpr, sy, 4 * v.dpr, 3 * v.dpr);
      g.fillStyle = "#14101f"; g.fillText(t2, sx, sy - th + 2 * v.dpr);
      if (a.busy > 0 && a.workFor > 1) { const bw = Math.max(24 * v.dpr, 22 * v.scale / 3); g.fillStyle = "#000"; g.fillRect(sx - bw / 2, sy + 4 * v.dpr, bw, 3 * v.dpr); g.fillStyle = a.w.c; g.fillRect(sx - bw / 2, sy + 4 * v.dpr, bw * (1 - a.busy / a.workFor), 3 * v.dpr); }
    }
    if (v.tour && v.tour.i >= 0) { // caption
      const T = TOUR[v.tour.i], line = T.line(st), pad = 12 * v.dpr, f2 = 13 * v.dpr;
      g.textAlign = "left"; g.font = `${f2 * 1.25}px VT323, monospace`; const tagW = g.measureText(T.tag).width;
      g.font = `${f2}px 'IBM Plex Mono', monospace`; const lineW = Math.min(W - 2 * pad - 20 * v.dpr, g.measureText(line).width);
      const bw = Math.max(tagW, lineW) + 2 * pad, bx = (W - bw) / 2, by = H - 74 * v.dpr;
      g.fillStyle = "rgba(4,3,10,.82)"; g.fillRect(bx, by, bw, 56 * v.dpr); g.fillStyle = ACCENT; g.fillRect(bx, by, 3 * v.dpr, 56 * v.dpr);
      g.font = `${f2 * 1.25}px VT323, monospace`; g.fillStyle = ACCENT; g.fillText(T.tag, bx + pad, by + 8 * v.dpr);
      g.font = `${f2}px 'IBM Plex Mono', monospace`; g.fillStyle = "rgba(235,236,255,.92)"; wrapText(g, line, bx + pad, by + 30 * v.dpr, bw - 2 * pad, f2 * 1.3);
    }
  }
  function wrapText(g, s, x, y, w, lh) { const words = s.split(" "); let line = ""; for (const wd of words) { const tst = line ? line + " " + wd : wd; if (g.measureText(tst).width > w && line) { g.fillText(line, x, y); y += lh; line = wd; } else line = tst; } g.fillText(line, x, y); }

  let looping = false, lastTs = 0, warmed = false;
  function ensureLoop() {
    if (!warmed) { warmed = true; drawBase(); for (let i = 0; i < 2400; i++) step(); }
    if (looping) return; looping = true; requestAnimationFrame(loop);
  }
  function loop(ts) {
    const live = views.filter((v) => v.active && v.canvas.isConnected && v.canvas.offsetParent !== null);
    if (!live.length) { lastTs = ts; if (views.length) requestAnimationFrame(loop); else looping = false; return; } // idle until a view shows again
    for (const v of live) if (Math.abs(v.canvas.clientWidth * v.dpr - v.canvas.width) > 2 || Math.abs(v.canvas.clientHeight * v.dpr - v.canvas.height) > 2) v.resize();
    const n = reduce ? 0 : Math.min(4, Math.round((ts - lastTs) / 16.7) || 1); lastTs = ts;
    for (let i = 0; i < n; i++) step();
    drawWorld(); live.forEach(render);
    requestAnimationFrame(loop);
  }

  /* ---------- full-screen overlay (used inside Jarvis) ---------- */
  let ov = null;
  function overlay(opts = {}) {
    if (ov) { ov.el.hidden = false; ov.v.active = true; if (opts.cinema) ov.v.startTour(); ensureLoop(); requestAnimationFrame(() => ov.v.resize()); return ov; }
    if (!document.getElementById("jf-style")) {
      const s = document.createElement("style"); s.id = "jf-style";
      s.textContent = `
.jf-ov{position:fixed;inset:0;z-index:9000;background:#020106;display:flex;flex-direction:column;color:#e8e6ff;font-family:'IBM Plex Mono',ui-monospace,monospace;padding-top:env(safe-area-inset-top,0px)}
.jf-ov[hidden]{display:none!important}
.jf-bar{display:flex;align-items:center;gap:8px;padding:8px max(12px,env(safe-area-inset-right,0px)) 8px max(12px,env(safe-area-inset-left,0px));border-bottom:1px solid rgba(159,232,255,.18);flex-wrap:wrap}
.jf-ttl{font-family:'Chakra Petch','VT323',sans-serif;font-weight:600;letter-spacing:.2em;font-size:15px;color:#9fe8ff}
.jf-line{font-size:11px;color:rgba(232,230,255,.65);letter-spacing:.06em;flex:1;min-width:140px}
.jf-btn{background:none;border:1px solid rgba(159,232,255,.35);color:#9fe8ff;font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.12em;padding:6px 10px;cursor:pointer;text-decoration:none;white-space:nowrap}
.jf-btn:hover,.jf-btn:focus-visible{background:rgba(159,232,255,.12);outline:none}
.jf-btn.gold{border-color:#ffd34a;color:#ffd34a}
.jf-ov canvas.jf-cv{position:static;inset:auto;flex:1 1 0;height:0;min-height:0;display:block;width:100%;cursor:grab;z-index:auto}
.jf-foot{display:flex;gap:6px;align-items:center;padding:6px max(12px,env(safe-area-inset-right,0px)) calc(6px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px));border-top:1px solid rgba(159,232,255,.18);font-size:11px;color:rgba(232,230,255,.6);flex-wrap:wrap}
.jf-card{position:absolute;left:12px;right:12px;bottom:calc(52px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;background:rgba(8,6,18,.94);border:1px solid rgba(159,232,255,.3);padding:12px 14px;font-size:12px;line-height:1.55}
.jf-card[hidden]{display:none!important}
.jf-card h4{margin:0 0 4px;font:600 16px 'Chakra Petch','VT323',sans-serif;letter-spacing:.14em}
.jf-card .k{color:rgba(232,230,255,.55)}
.jf-card .x{float:right}
.jf-toast{position:absolute;left:50%;transform:translateX(-50%);top:64px;background:#9fe8ff;color:#04121a;padding:6px 12px;font-size:12px;letter-spacing:.06em;max-width:90vw;text-align:center}
.jf-toast[hidden]{display:none!important}
@media (max-width:560px){.jf-line,.jf-long{display:none}.jf-foot span:last-child{display:none}.jf-ttl{flex:1;font-size:13px;letter-spacing:.12em;white-space:nowrap}.jf-btn{padding:6px 7px;letter-spacing:.06em}.jf-bar{gap:6px;flex-wrap:nowrap}}`;
      document.head.appendChild(s);
    }
    const el = document.createElement("div"); el.className = "jf-ov"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "The Factory");
    el.innerHTML = `<div class="jf-bar"><span class="jf-ttl">THE FACTORY</span><span class="jf-line" id="jf-line">alien tech floor · Sites by TJ crew</span>
      <button class="jf-btn" id="jf-tour" type="button">TOUR</button>
      ${opts.cardsUrl ? `<a class="jf-btn gold" href="${opts.cardsUrl}" target="_blank" rel="noopener"><span class="jf-long">JOB </span>CARDS ↗</a>` : ""}
      ${opts.onImprove ? `<button class="jf-btn" id="jf-imp" type="button">IMPROVE ▸</button>` : ""}
      <button class="jf-btn" id="jf-x" type="button" aria-label="Back to Jarvis">✕</button></div>
      <canvas class="jf-cv" aria-label="The factory floor: crew passing jobs round the Jarvis core"></canvas>
      <div class="jf-foot"><button class="jf-btn" data-z="-1" type="button" aria-label="Zoom out">−</button><button class="jf-btn" data-z="1" type="button" aria-label="Zoom in">+</button><button class="jf-btn" data-z="0" type="button">FIT</button><span style="flex:1"></span><span>drag · pinch · tap a worker · the walking is for show</span></div>
      <div class="jf-card" hidden></div><div class="jf-toast" hidden></div>`;
    document.body.appendChild(el);
    const card = el.querySelector(".jf-card"), toast = el.querySelector(".jf-toast");
    const say = (m) => { toast.textContent = m; toast.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => (toast.hidden = true), 2600); };
    const v = mount(el.querySelector(".jf-cv"), { onTap: (hit) => {
      if (hit.kind === "core") { const st = S.stats() || {}; card.innerHTML = `<button class="jf-btn x" type="button">CLOSE</button><h4 style="color:#9ff7ff">JARVIS CORE</h4><div>The brain at the centre of the factory: ${st.notes || 27} notes${st.links ? `, ${st.links} links` : ""}${st.lessons != null ? `, ${st.lessons} lessons` : ""}. When Jarvis thinks, it glows gold.</div><div class="k">${st.jobsLive ? `${st.jobsLive} jobs live · ` : ""}${st.jobsDone ? `${st.jobsDone} done` : "no jobs right now"}</div>`; }
      else { const w = hit.worker; card.innerHTML = `<button class="jf-btn x" type="button">CLOSE</button><h4 style="color:${w.c}">${w.n}</h4><div>${w.job}</div><div class="k">${w.throne ? "You" : w.bot ? "Bot drone (free, no Claude usage)" : "Claude agent"} · ${w.when} · ${w.ct}</div><div class="k">${w.last || ""} ${w.rules}</div>`; }
      card.hidden = false; card.querySelector(".x").onclick = () => (card.hidden = true);
    } });
    el.querySelectorAll("[data-z]").forEach((b) => (b.onclick = () => v.zoom(+b.dataset.z)));
    el.querySelector("#jf-tour").onclick = () => { card.hidden = true; v.startTour(); };
    const close = () => { el.hidden = true; v.active = false; card.hidden = true; v.tour = null; opts.onClose && opts.onClose(); };
    el.querySelector("#jf-x").onclick = close;
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    if (opts.onImprove) el.querySelector("#jf-imp").onclick = async () => { try { const m = await opts.onImprove(); say(m || "Queued: Jarvis will redesign himself and the factory."); } catch { say("Couldn't queue that. Try again in a moment."); } };
    const lineEl = el.querySelector("#jf-line");
    setInterval(() => { if (el.hidden) return; const st = S.stats() || {}, busy = actors.filter((a) => a.busy > 0).length; lineEl.textContent = `${busy} working · ${S.crates.length} jobs on the rail · core: ${st.notes || 27} notes${st.jobsLive ? ` · ${st.jobsLive} Jarvis jobs live` : ""}`; }, 1000);
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
    isOpen: () => !!(ov && !ov.el.hidden),
    // For hosts that draw the floor themselves (Jarvis's Show off flight): steps the crew once and returns the live 480x340 floor.
    tick() { if (!warmed) { warmed = true; drawBase(); for (let i = 0; i < 2400; i++) step(); } if (!looping && !reduce) step(); drawWorld(); return world; },
    TOUR,
    status: () => ({ working: actors.filter((a) => a.busy > 0).length, rail: S.crates.length, waiting: tjQueue() }),
    close: () => ov && ov.close(),
  };
})();
