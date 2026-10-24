/* ---------- Jobs: big asks go to Claude Code and come back here ---------- */
let jobsSeen = null; // status per job at first load, so only new results get announced
function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? "now" : m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d";
}
function watchJobs(db) {
  db.collection("jobs").orderBy("created", "desc").limit(20).onSnapshot((snap) => {
    const list = $("jobs"); list.innerHTML = "";
    const first = jobsSeen === null; if (first) jobsSeen = {};
    let open = 0;
    for (const d of snap.docs) {
      const j = d.data(), was = jobsSeen[d.id];
      if (j.status === "queued" || j.status === "working") open++;
      const fresh = !first && was && was !== j.status && (j.status === "done" || j.status === "needs-tj");
      jobsSeen[d.id] = j.status;
      const el = document.createElement("article"); el.className = "job" + (fresh ? " fresh" : "");
      el.innerHTML = `<div class="row"><span class="chip"></span><time></time></div><div class="ask"></div>`;
      el.querySelector(".chip").className = "chip " + j.status;
      el.querySelector(".chip").textContent = j.status === "needs-tj" ? "Needs you" : j.status[0].toUpperCase() + j.status.slice(1);
      el.querySelector("time").textContent = ago(j.updated || j.created);
      el.querySelector(".ask").textContent = j.ask;
      if (j.answer) { const a = document.createElement("div"); a.className = "answer"; a.textContent = j.answer; el.append(a); }
      for (const l of j.links || []) {
        if (!/^https:\/\//.test(l.url || "")) continue;
        const a = document.createElement("a"); a.href = l.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = l.title || l.url; el.append(a);
      }
      list.append(el);
      if (fresh) {
        renderReply(say("jarvis", ""), `SAY: ${j.status === "done" ? "The job's done, boss." : "That job needs you, boss."}\n${j.answer || ""}`);
        blip("job"); speak(j.status === "done" ? "The job's done, boss. Details are on screen." : "That job needs your call, boss.");
        if (!$("jobsPanel").classList.contains("active")) $("badge").textContent = "●";
      }
    }
    $("jobsCount").textContent = open ? `${open} running` : `${snap.size} total`;
    if (snap.empty) list.innerHTML = `<p class="empty">Nothing queued. Tap <b>Job</b>, or just ask for something big (code, research, a PR) and I'll send it to Claude Code. Answers land here.</p>`;
  }, () => { $("jobs").innerHTML = `<p class="empty">Jobs need the claude.ai copy of Jarvis.</p>`; });
}
async function queueJob(askText) {
  const db = await dbPromise;
  if (!db) { say("note", "Jobs only work in the claude.ai copy of Jarvis."); return false; }
  const at = new Date().toISOString();
  await db.collection("jobs").add({ ask: askText, status: "queued", created: at, updated: at, ...(aboutNote ? { note: aboutNote } : {}) });
  const mcp = await mcpPromise;
  if (!mcp) { say("note", "Job queued. Jarvis backend picks it up on its next run (every 3 hours, 6:15am to 9:15pm)."); return true; }
  wakeRunner(db, mcp);
  return true;
}
// One run handles a whole batch: wait for a quiet moment after the last job, and don't start a second run
// while one is already working (the run keeps checking the queue until it's empty).
let wakeTimer = 0;
const WAKE_QUIET = 25000;
function wakeRunner(db, mcp) {
  if (!wakeTimer) say("note", "Job queued. I'll send the batch to Jarvis backend in a moment, in case you've got more.");
  clearTimeout(wakeTimer);
  wakeTimer = setTimeout(async () => {
    wakeTimer = 0;
    let last = 0, lock = 0;
    try { const k = await db.doc("memory/runner").get(); if (k.exists) { last = Date.parse(k.data().kickedAt) || 0; lock = Date.parse(k.data().lockAt) || 0; } } catch {}
    const busy = Object.values(jobsSeen || {}).includes("working");
    // a run that holds the lock keeps checking the queue until it's empty, so it will take these too
    if ((busy && Date.now() - last < 20 * 60000) || Date.now() - lock < 25 * 60000) { say("note", "Jarvis backend is already on it; it'll take these too."); return; }
    try {
      await mcp.callTool("Claude Code Remote", "fire_trigger", { trigger_id: RUNNER });
      try { await db.doc("memory/runner").set({ kickedAt: new Date().toISOString() }); } catch {}
      say("note", "Sent to Jarvis backend. I'll tell you when it's back.");
    } catch { say("note", "Couldn't wake Jarvis backend; it picks the jobs up on its next run (every 3 hours, 6:15am to 9:15pm)."); }
  }, WAKE_QUIET);
}
/* ---------- Morning brief: Jarvis backend writes briefs/<date> at 6:15; the page shows it once a day ---------- */
const CENTRAL = "America/Chicago";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: CENTRAL }); // YYYY-MM-DD
let todayCal = null; // today's calendar, fetched when TJ asks for a brief, for the system prompt
function showBriefDoc(b) {
  const el = say("jarvis", "");
  el.classList.add("brief");
  renderReply(el, `SAY: ${b.say || "Morning, boss. Here's your day."}\n${(b.lines || []).join("\n")}`);
  return el;
}
async function loadBrief(db) {
  try {
    const d = await db.doc("briefs/" + today()).get();
    return d.exists ? d.data() : null;
  } catch { return null; }
}
async function calendarToday() {
  const mcp = await mcpPromise;
  if (!mcp) return null;
  const day = today();
  const res = await mcp.callTool("Google Calendar", "list_events",
    { startTime: day + "T00:00:00", endTime: day + "T23:59:59", timeZone: CENTRAL, orderBy: "startTime", pageSize: 25 });
  const list = res?.payload?.events || res?.payload?.items || [];
  return list.map((e) => {
    const at = e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString("en-US", { timeZone: CENTRAL, hour: "numeric", minute: "2-digit" }) : "all day";
    return `${at}: ${e.summary || "(no title)"}`;
  });
}
async function briefMe() {
  const db = await dbPromise, b = db && (await loadBrief(db));
  if (b) { say("you", "Brief me"); showBriefDoc(b); speak(b.say || "Morning, boss. Here's your day."); store.set("briefShown", today()); return; }
  try { todayCal = await calendarToday(); } catch { todayCal = null; }
  ask("Brief me on today: my calendar, J Street, my top to-dos and anything waiting on me.");
}
dbPromise.then(async (db) => {
  if (!db || store.get("briefShown") === today()) return;
  const b = await loadBrief(db);
  if (!b) return;
  store.set("briefShown", today());
  document.querySelector(".chips")?.remove();
  showBriefDoc(b);
});

/* ---------- Reminders: "REMIND:" lines become Google Calendar events that pop up on the phone at that minute ---------- */
const REMIND_RE = /^REMIND:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\s*\|\s*(.+)$/gim;
function pad(n) { return String(n).padStart(2, "0"); }
function plus15(local) { // "2026-10-21T15:00" -> "2026-10-21T15:15:00", wall-clock math with no time zone
  const [d, t] = local.split("T"), [y, mo, da] = d.split("-").map(Number), [h, mi] = t.split(":").map(Number);
  const x = new Date(Date.UTC(y, mo - 1, da, h, mi + 15));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}T${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:00`;
}
function whenText(local) {
  const [d, t] = local.split("T"), [h, mi] = t.split(":").map(Number);
  const time = `${h % 12 || 12}:${pad(mi)} ${h < 12 ? "AM" : "PM"}`;
  return d === today() ? `today at ${time}` : `${d} at ${time}`;
}
async function setReminder(local, text) {
  const mcp = await mcpPromise;
  try {
    if (!mcp) throw new Error("no connectors here");
    await mcp.callTool("Google Calendar", "create_event", {
      summary: text, startTime: local + ":00", endTime: plus15(local), timeZone: CENTRAL,
      overrideReminders: [{ method: "popup", minutes: 0 }], description: "Set by Jarvis from your phone page.",
    });
    say("note", `Reminder set for ${whenText(local)}: ${text}. Your calendar app will ping you.`);
  } catch (e) {
    const code = e?.code || e?.message || e;
    if (await queueJob(`Create a Google Calendar event on TJ's primary calendar titled "${text}" at ${local} America/Chicago, 15 minutes long, with a popup reminder at 0 minutes.`))
      say("note", `Couldn't reach Google Calendar from here (${code}), so Jarvis backend will add the reminder.`);
  }
}

/* ---------- Memory panel: what Jarvis knows, and a way to correct it ---------- */
function memItem(text, meta, note) {
  const row = document.createElement("div"); row.className = "memItem";
  row.innerHTML = `<span></span><button type="button">Wrong</button>`;
  row.querySelector("span").textContent = text;
  if (meta) { const m = document.createElement("small"); m.textContent = meta; row.querySelector("span").append(m); }
  row.querySelector("button").addEventListener("click", () => {
    if (row.nextElementSibling?.classList.contains("memFix")) return;
    const fix = document.createElement("form"); fix.className = "memFix";
    fix.innerHTML = `<input placeholder="What's right? (blank = just remove it)"><button type="submit" class="gear">Save</button>`;
    fix.addEventListener("submit", async (e) => {
      e.preventDefault();
      const right = fix.querySelector("input").value.trim();
      const db = await dbPromise;
      if (!db) return;
      const lesson = { text: `Correction: "${text}" is wrong.${right ? " TJ says: " + right : " TJ wants it removed."}`, at: new Date().toISOString(), filed: false, correction: true, ...(note ? { note } : {}) };
      try {
        const ref = await db.collection("lessons").add(lesson);
        lessons.push({ id: ref?.id, ...lesson }); renderBrain(lessons.length);
        fix.replaceWith(Object.assign(document.createElement("p"), { className: "empty", textContent: "Got it. Jarvis backend fixes it on the next run, or tap Learn now." }));
      } catch (err) { fix.querySelector("input").value = ""; fix.querySelector("input").placeholder = "Couldn't save (" + (err?.code || err?.message || err) + ")"; }
    });
    row.after(fix); fix.querySelector("input").focus();
  });
  return row;
}
/* ---------- The factory: the Sites by TJ crew floor, any time (hud/factory.js) ---------- */
const STATION_URL = "https://claude.ai/artifact/HuVXWvLf2chPTziUg7LgNJ"; // the job cards (TJ's private Jarvis Station page)
window.JarvisFactory?.setStats(() => { const [l, d] = jobCounts(); return { notes: nodes.length, links: edges.length, lessons: lessons.length, jobsLive: l, jobsDone: d, thinking: mode === "thinking" }; });
const EVENTS_SQL = "SELECT id, step, ok, reason, prospect_id, detail FROM events ORDER BY id DESC LIMIT 40";
async function vaultRows() { // the agency's real event log; [] while Render is paused or not connected (the Vault then runs its demo)
  const mcp = await mcpPromise; if (!mcp) return [];
  try { return briefRows(await mcp.callTool("Render", "query_render_postgres", { postgresId: AGENCY.db, workspaceId: AGENCY.workspace, sql: EVENTS_SQL })).reverse(); } catch { return []; }
}
let vaultOpen = false;
function openFactory() {
  $("card").classList.remove("show"); lastInput = t;
  if (window.JarvisVault && !vaultOpen) { vaultOpen = true; window.JarvisFactory?.setOpen?.(true); window.JarvisVault.open({ rows: vaultRows, onClose: () => { vaultOpen = false; window.JarvisFactory?.setOpen?.(false); lastInput = t; } }); return; }
  const F = window.JarvisFactory; if (!F) return;
  F.setAccent(`rgb(${ARC})`);
  F.overlay({ cardsUrl: STATION_URL, cinema: SHOW(), onClose: () => { lastInput = t; },
    onImprove: async () => (await queueJob("Design pass per hud/DESIGN_LOOP.md: screenshot the Jarvis page and the factory at phone size, pick the 3 biggest design wins for both, build them, test, open a PR, merge, republish, and tell me what changed."))
      ? "Queued. Jarvis backend will redesign himself and the factory, then tell you what changed." : "Jobs only work in the claude.ai copy of Jarvis." });
}
$("factoryBtn").addEventListener("click", openFactory);
// The factory card on the home screen: a live window onto the station, cropped round the core, about 12 frames a second
(function factoryMini() {
  const F = window.JarvisFactory, cv = $("factoryMini"); if (!F || !cv) return;
  const g = cv.getContext("2d"); let last = 0;
  const frame = (ts) => {
    requestAnimationFrame(frame);
    if (ts - last < 80 || document.hidden || F.isOpen() || !cv.offsetParent) return; last = ts;
    const w = F.tick(), cw = cv.offsetWidth < 200 ? 380 : 620, ch = cw * cv.height / cv.width; // crop: the core and the rooms round it; a phone thumbnail crops tighter so the crew still read
    g.imageSmoothingEnabled = true; g.drawImage(w, 430 - cw / 2, 300 - ch / 2, cw, ch, 0, 0, cv.width, cv.height);
  };
  requestAnimationFrame(frame);
  const line = () => { const s = F.status(); $("factoryLine").innerHTML = `<i></i>${s.working} at work · ${s.rail} on the rail${s.waiting ? ` · ${s.waiting} for you` : ""}`; };
  line(); setInterval(line, 2000);
})();
$("memBtn").addEventListener("click", () => {
  const list = $("memList"); list.innerHTML = "";
  const head = (t) => list.append(Object.assign(document.createElement("h4"), { textContent: t }));
  const personal = byName.get("Personal")?.text || "";
  for (const part of personal.split(/^## /m).slice(1)) {
    const [title, ...rest] = part.split("\n");
    const items = rest.filter((l) => /^- /.test(l) && !/\(ask TJ\)/.test(l)).map((l) => l.slice(2).replace(/\[\[|\]\]/g, ""));
    if (!items.length) continue;
    head(title.trim());
    for (const t of items) list.append(memItem(t, "", "Personal"));
  }
  const recent = lessons.filter((l) => !l.correction).slice(-25).reverse();
  if (recent.length) head("Learned in chats");
  for (const l of recent) list.append(memItem(l.text, `${(l.at || "").slice(0, 10)} · ${l.filed ? "filed in the notes" : "waiting to be filed"}`, l.note));
  if (!list.children.length) list.innerHTML = `<p class="empty">Nothing yet. Tell me about yourself and I'll remember it.</p>`;
  $("memory").showModal();
});
$("memDone").addEventListener("click", () => $("memory").close());

/* ---------- Past chats: reopen any saved chat and carry on ---------- */
function ago2(iso) { return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
$("chatsBtn").addEventListener("click", async () => {
  $("chats").showModal();
  const db = await dbPromise, list = $("chatList");
  if (!db) { list.innerHTML = `<p class="empty">Saved chats live in the claude.ai copy of Jarvis.</p>`; return; }
  try {
    const q = await db.collection("chats").orderBy("started", "desc").limit(50).get();
    list.innerHTML = q.empty ? `<p class="empty">No saved chats yet.</p>` : "";
    for (const d of q.docs) {
      const c = d.data(), first = (c.turns || []).find((m) => m.who === "tj")?.text || "(empty)";
      const b = document.createElement("button"); b.type = "button"; if (d.id === chatId) b.className = "current";
      b.innerHTML = `<time></time><span></span>`;
      const n = (c.turns || []).filter((m) => m.who === "tj").length;
      b.querySelector("time").textContent = `${ago2(c.started)} · ${n} message${n === 1 ? "" : "s"}${d.id === chatId ? " · open now" : ""}`;
      b.querySelector("span").textContent = first.length > 90 ? first.slice(0, 90) + "…" : first;
      b.addEventListener("click", () => { openChat(d.id, c); $("chats").close(); });
      list.append(b);
    }
  } catch (e) { list.innerHTML = `<p class="empty">Couldn't load chats (${e?.code || e?.message || e}).</p>`; }
});
function openChat(id, c) {
  chatId = id; turns = [...(c.turns || [])];
  history.length = 0;
  $("log").innerHTML = "";
  say("note", `Chat from ${ago2(c.started)}. Keep talking to carry on.`);
  for (const m of turns) {
    if (m.who === "tj") { say("you", m.text); history.push({ role: "user", content: m.text }); }
    else { renderReply(say("jarvis", ""), m.text); history.push({ role: "assistant", content: m.text }); }
  }
  showTab("comms");
}
$("newChat").addEventListener("click", () => {
  chatId = new Date().toISOString().replace(/[:.]/g, "-"); turns = []; history.length = 0;
  $("log").innerHTML = ""; say("note", "New chat. The old ones are under Chats.");
  $("chats").close();
});
$("chatsDone").addEventListener("click", () => $("chats").close());

$("jobMode").addEventListener("click", () => {
  const on = $("jobMode").getAttribute("aria-pressed") !== "true";
  $("jobMode").setAttribute("aria-pressed", on);
  $("q").placeholder = on ? "Describe the job for Claude Code" : "Talk to Jarvis";
  $("q").focus();
});


/* ---------- Readout under the dial: the same numbers the rings draw ---------- */
function readout() {
  if (!$("rNotes")) return; // the Workshop look has no readout strip; the Brain panel shows these numbers
  const d = mindData();
  $("rNotes").textContent = nodes.length; $("rLinks").textContent = d.links;
  $("rJobs").innerHTML = `${d.done}<small> / ${d.done + d.live + d.need}</small>`;
  $("rLessons").innerHTML = `${d.filed}<small>${d.waiting ? " +" + d.waiting : ""}</small>`;
}
readout(); setInterval(readout, 2000);
