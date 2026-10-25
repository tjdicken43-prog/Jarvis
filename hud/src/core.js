const BRAIN = window.BRAIN || { notes: [], stats: {} };
const FACTORY_NOTES = /^(Sites by TJ|Jarvis)$/; // these notes open the factory (hud/factory.js)
const RUNNER = "trig_018dWp58ssWVgPRB7eHuMeva"; // the Claude Code scheduled task that works the job queue
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem("jarvis." + k) ?? d; } catch { return d; } },
  set(k, v) { try { v == null ? localStorage.removeItem("jarvis." + k) : localStorage.setItem("jarvis." + k, v); } catch {} },
};
// The code is split over hud/src/*.js; wait for every piece to load before any store work starts.
const loaded = document.readyState === "loading" ? new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true })) : Promise.resolve();
const use = (name) => loaded.then(() => (window.claude?.use ? window.claude.use(name).catch(() => null) : null));
const samplePromise = use("sample");
const dbPromise = use("db");
const mcpPromise = use("mcp");

/* ---------- Clock (TJ is on Central time) ---------- */
function tick() {
  const d = new Date(), tz = { timeZone: "America/Chicago" };
  $("time").textContent = d.toLocaleTimeString("en-US", { ...tz, hour: "numeric", minute: "2-digit" });
  $("date").textContent = d.toLocaleDateString("en-US", { ...tz, weekday: "short", month: "short", day: "numeric" });
  const h = +d.toLocaleString("en-US", { ...tz, hour: "numeric", hour12: false }) % 24;
  $("bigTime").textContent = d.toLocaleTimeString("en-US", { ...tz, hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/, "");
  $("bigLine").textContent = d.toLocaleDateString("en-US", { ...tz, weekday: "long", month: "long", day: "numeric" }) + " · Bentonville";
  $("greet").textContent = `Good ${h < 4 ? "evening" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"}, TJ`;
}
tick(); setInterval(tick, 10000);

/* ---------- Brain panel ---------- */
const byName = new Map(BRAIN.notes.map((n) => [n.name, n]));
function renderBrain(memories) {
  const s = BRAIN.stats;
  const cells = [[s.notes ?? 0, "notes"], [s.open_todos ?? 0, "for you"], [s.checks ?? 0, "to check", s.checks > 0], [memories, "memories"]];
  $("stats").innerHTML = "";
  for (const [v, k, warn] of cells) {
    const el = document.createElement("div"); el.className = "stat" + (warn ? " warn" : "");
    el.innerHTML = `<b></b><span></span>`; el.querySelector("b").textContent = v; el.querySelector("span").textContent = k;
    $("stats").append(el);
  }
  let waiting = 0; try { waiting = lessons.filter((l) => !l.filed).length; } catch {} // lessons isn't set up on the first call
  $("growth").textContent = waiting ? `${waiting} lesson${waiting > 1 ? "s" : ""} orbiting, waiting to be learned. Tap Learn now or I file them on my next run.` : "Everything I've learned is filed in the notes.";
}
renderBrain(0);
(function renderNow() {
  const todo = byName.get("To do")?.text || "";
  const now = (todo.split(/^## Now\s*$/m)[1] || "").split(/^## /m)[0];
  const items = [...now.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1].replace(/\[\[|\]\]|`/g, "").replace(/\s*See .*$/, ""));
  for (const t of items.slice(0, 8)) { const li = document.createElement("li"); li.textContent = t; $("now").append(li); }
  if (!items.length) $("now").innerHTML = "<li>Nothing urgent.</li>";
  const week = BRAIN.notes.map((n) => n.name).filter((n) => /^\d{4} Week \d+$/.test(n)).sort().pop();
  $("weekName").textContent = week ? week.replace(/^\d{4} /, "") : "";
})();

/* ---------- Tabs (phone) ---------- */
function showTab(name) {
  document.querySelectorAll("[data-go]").forEach((b) => b.setAttribute("aria-selected", b.dataset.go === name));
  document.querySelectorAll("[data-tab]").forEach((el) => el.classList.toggle("active", el.dataset.tab === name));
  if (name === "jobs") $("badge").textContent = "";
}
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.go)));
showTab("comms");

/* ---------- State ---------- */
let mode = "idle", level = 0;
function setMode(m) {
  mode = m;
  $("status").dataset.mode = m;
  $("status").textContent = { idle: "At your service", listening: "Listening", thinking: "Thinking", speaking: "Speaking" }[m];
  $("mic").classList.toggle("on", m === "listening");
}


/* ---------- Scroll edges: a list that runs on fades at the bottom, and stops fading once you reach the end ---------- */
function edge(el) { el.classList.toggle("more", el.scrollHeight - el.scrollTop - el.clientHeight > 4); }
for (const el of document.querySelectorAll(".panel > .scroll")) {
  el.addEventListener("scroll", () => edge(el), { passive: true });
  new ResizeObserver(() => edge(el)).observe(el);
  new MutationObserver(() => edge(el)).observe(el, { childList: true, subtree: true });
}
