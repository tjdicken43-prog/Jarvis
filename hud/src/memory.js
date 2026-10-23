/* ---------- Notes search (works with nothing else) ---------- */
const STOP = new Set("the a an and or of to in on for is are what whats how do does i my me we our it this that with about can you tell jarvis hey".split(" "));
const words = (s) => (s.toLowerCase().match(/[a-z0-9$]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w));
function search(q, k = 4) {
  const qs = words(q);
  return nodes.map((n) => {
    const name = n.name.toLowerCase(), body = n.text.toLowerCase();
    let score = 0;
    for (const w of qs) { if (name.includes(w)) score += 5; score += Math.min(body.split(w).length - 1, 5); }
    return { n, score };
  }).filter((r) => r.score > 0 && r.n.name !== "CLAUDE").sort((a, b) => b.score - a.score).slice(0, k).map((r) => r.n);
}
function offlineAnswer(q) {
  const hits = search(q, 3);
  if (!hits.length) return "Nothing in the brain on that yet, boss.";
  const qs = words(q), lines = hits[0].text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const best = lines.filter((l) => qs.some((w) => l.toLowerCase().includes(w))).slice(0, 4);
  return `From ${hits[0].name}:\n` + (best.length ? best : lines.slice(0, 4)).join("\n") +
    (hits.length > 1 ? `\n\nAlso see: ${hits.slice(1).map((h) => h.name).join(", ")}.` : "");
}

/* ---------- Memory: every chat and lesson is saved ---------- */
let chatId = new Date().toISOString().replace(/[:.]/g, "-");
const RESUME_MS = 6 * 3600e3; // reopening the page within 6 hours picks the same chat back up
let lessons = [], lastChat = [], touches = { counts: {} }, aboutNote = null, touchTimer = 0;
let turns = [];
dbPromise.then(async (db) => {
  if (!db) return;
  try {
    lessons = await loadLessons(db);
    renderBrain(lessons.length);
    const tc = await db.doc("memory/touches").get();
    if (tc.exists) { const t = structuredClone(tc.data()); touches = { ...t, counts: { ...(t.counts || {}) } }; } // store data comes back frozen
    await checkNew(db);
    const prev = await db.collection("chats").orderBy("started", "desc").limit(1).get();
    if (!prev.empty) {
      const doc = prev.docs[0], last = doc.data(), past = last.turns || [];
      if (!turns.length && past.length && Date.now() - Date.parse(last.updated || last.started) < RESUME_MS) resumeChat(doc.id, past);
      else lastChat = past.slice(-10);
    }
  } catch {}
  watchJobs(db);
});
// Show the recent chat again instead of a blank screen, and keep saving into it.
function resumeChat(id, past) {
  chatId = id;
  turns.push(...past);
  document.querySelector(".chips")?.remove();
  say("note", "Picked up your chat from " + new Date(past[0].at).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }) + ". Everything is saved.");
  for (const t of past) {
    if (t.who === "tj") { say("you", t.text); history.push({ role: "user", content: t.text }); }
    else { renderReply(say("jarvis", ""), t.text); history.push({ role: "assistant", content: t.text }); }
  }
}
// Each lesson is its own record in "lessons", so the page and Jarvis backend never overwrite each other's
// lists. Older lessons from the single "memory/lessons" list are still read.
async function loadLessons(db) {
  const out = [];
  try { const l = await db.doc("memory/lessons").get(); if (l.exists) out.push(...(l.data().items || [])); } catch {}
  try { const q = await db.collection("lessons").orderBy("at", "asc").limit(500).get(); for (const d of q.docs) out.push({ id: d.id, ...d.data() }); } catch {}
  return out;
}
function touch(name) {
  touches.counts[name] = (touches.counts[name] || 0) + 1; touches.last = name;
  clearTimeout(touchTimer);
  touchTimer = setTimeout(async () => { const db = await dbPromise; if (db) try { await db.doc("memory/touches").set(touches); } catch {} }, 1500);
}
function topTouched(k = 5) {
  return Object.entries(touches.counts).sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, c]) => `${n} (${c})`);
}
/* New sections: notes the brain grew since TJ last looked */
let seenNames = null;
async function checkNew(db) {
  const all = nodes.map((n) => n.name);
  const sd = await db.doc("memory/seen").get();
  if (!sd.exists) { seenNames = all; await db.doc("memory/seen").set({ names: all, at: new Date().toISOString() }); }
  else seenNames = sd.data().names || [];
  const fresh = nodes.filter((n) => !seenNames.includes(n.name));
  for (const n of fresh) { n.isNew = true; n.hot = 1; }
  $("newList").innerHTML = "";
  for (const n of fresh) {
    const li = document.createElement("li"); li.textContent = n.name; li.style.cursor = "pointer";
    li.addEventListener("click", () => openNote(n)); $("newList").append(li);
  }
  $("newBox").hidden = $("debrief").hidden = !fresh.length;
  if (fresh.length) {
    say("note", `The brain grew ${fresh.length} new section${fresh.length > 1 ? "s" : ""}: ${fresh.map((n) => n.name).join(", ")}. Tap DEBRIEF ME in BRAIN.`);
    $("badge").textContent = "●";
  }
}
$("debrief").addEventListener("click", async () => {
  const fresh = nodes.filter((n) => n.isNew).map((n) => n.name);
  if (!fresh.length) return;
  ask(`Debrief me on the new sections of my brain: ${fresh.join(", ")}. For each one: what it means, what it does for me, and what to do with it next.`);
  for (const n of nodes) n.isNew = false;
  $("newBox").hidden = $("debrief").hidden = true;
  const db = await dbPromise;
  if (db) try { await db.doc("memory/seen").set({ names: nodes.map((n) => n.name), at: new Date().toISOString() }); } catch {}
});
$("learn").addEventListener("click", async () => {
  const waiting = lessons.filter((l) => !l.filed).length;
  const mcp = await mcpPromise;
  if (!mcp) { say("note", "Learning runs from the claude.ai copy of Jarvis."); return; }
  try {
    await mcp.callTool("Claude Code Remote", "fire_trigger", { trigger_id: RUNNER });
    say("note", waiting ? `Sent ${waiting} lesson${waiting > 1 ? "s" : ""} to Claude Code to file into the brain. New sections show up here when they land.` : "Nothing new to learn yet, but I've woken Claude Code to work the queue.");
    speak("Filing what I've learned, boss.");
  } catch (e) { say("note", "Couldn't reach Claude Code: " + (e?.message || e)); }
});
function memoryText() {
  let t = "";
  const top = topTouched();
  if (top.length) t += "\nNotes TJ opens most on the brain map (lean on these): " + top.join(", ") + "\n";
  if (lessons.length) t += "\nThings TJ told you in earlier chats (newer wins if they clash):\n" + lessons.map((l) => `- ${l.at.slice(0, 10)}: ${l.text}`).join("\n") + "\n";
  if (lastChat.length) t += "\nEnd of your last chat with TJ:\n" + lastChat.map((m) => (m.who === "tj" ? "TJ: " : "Jarvis: ") + m.text).join("\n") + "\n";
  return t;
}
async function remember(q, text) {
  const db = await dbPromise;
  if (!db) return;
  const at = new Date().toISOString();
  turns.push({ who: "tj", text: q, at }, { who: "jarvis", text, at });
  try {
    await db.doc("chats/" + chatId).set({ started: turns[0].at, updated: at, turns, filed: false });
  } catch (e) { say("note", "Couldn't save this chat (" + (e?.code || e?.message || e) + "). It's still on screen; I'll retry with your next message."); }
  // every "For the brain:" line in the reply becomes its own lesson record
  for (const m of text.matchAll(/For the brain:\s*(.+)/gi)) {
    const lesson = { text: m[1].replace(/\*+/g, "").trim(), at, filed: false, chat: chatId, ...(aboutNote ? { note: aboutNote } : {}) };
    if (!lesson.text) continue;
    try {
      const ref = await db.collection("lessons").add(lesson);
      lessons.push({ id: ref?.id, ...lesson });
      renderBrain(lessons.length);
      say("note", "Saved to memory: " + lesson.text);
    } catch (e) { say("note", "Couldn't save that lesson (" + (e?.code || e?.message || e) + "). Jarvis backend will still find it in this chat."); }
  }
  aboutNote = null;
}

