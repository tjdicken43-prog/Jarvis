/* ---------- Budget sheet (money/budget: ledger + rules, packed into brain.js; nothing here costs usage) ---------- */
const BUDGET = BRAIN.budget || null;
const usd = (n) => "$" + (+n).toFixed(2).replace(/\.00$/, "");
const centralDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // YYYY-MM-DD
const dayGap = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
// Asks agents leave for TJ (new service, one-off, over a cap) live in the page store as spend/<id>:
// { service, amount, why, asked, status: "pending" | "approved" | "declined", decided }. Jarvis backend buys only "approved" ones.
let asks = [];

function renderBudget() {
  const box = $("budgetBody");
  box.innerHTML = "";
  const add = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; box.append(el); return el; };
  if (!BUDGET) { add("p", "empty", "No budget packed yet. Jarvis backend adds it on the next page refresh."); return; }
  const b = BUDGET, today = centralDay(), days = dayGap(today, b.next_refill), stale = dayGap(b.as_of, today);

  const pending = asks.filter((a) => a.status === "pending");
  if (pending.length) {
    add("h4", null, "Waiting for your OK");
    for (const a of pending) {
      const r = add("div", "bAsk");
      r.innerHTML = "<div><b></b><span></span><small></small></div><div class=\"bBtns\"><button type=\"button\" class=\"gear ghost\">Decline</button><button type=\"button\" class=\"gear primary\">Approve</button></div>";
      r.querySelector("b").textContent = usd(a.amount); r.querySelector("span").textContent = " " + a.service;
      // the reserve is hard: the button can OK a new service or a bigger cap, never a dip under the floor
      const fits = !b.frozen && +a.amount <= b.headroom;
      r.querySelector("small").textContent = (a.why || "") + (fits ? "" : ` Would dip into the ${usd(b.floor)} reserve, so it waits for the refill.`);
      const [no, yes] = r.querySelectorAll("button");
      yes.disabled = !fits;
      yes.addEventListener("click", () => decide(a, "approved"));
      no.addEventListener("click", () => decide(a, "declined"));
    }
  }

  const top = add("div", "bTop");
  for (const [v, k, cls] of [[usd(b.balance), "on the card"], [usd(b.headroom), "safe to spend", b.frozen ? "bad" : "good"], [days > 0 ? days + (days === 1 ? " day" : " days") : "today", "to refill"]]) {
    const c = document.createElement("div"); c.className = "bCell " + (cls || "");
    c.innerHTML = "<b></b><span></span>"; c.querySelector("b").textContent = v; c.querySelector("span").textContent = k; top.append(c);
  }

  // one bar: what's due before refill, the floor that never gets touched, and what's actually free
  const total = Math.max(b.balance, b.refill), pct = (n) => Math.max(0, Math.min(100, (n / total) * 100)) + "%";
  const bar = add("div", "bBar"); bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", `${usd(b.committed)} due before refill, ${usd(b.floor)} reserve, ${usd(b.headroom)} free`);
  for (const [n, cls] of [[b.committed, "due"], [Math.min(b.floor, Math.max(b.balance - b.committed, 0)), "floor"], [b.headroom, "free"]]) {
    const s = document.createElement("i"); s.className = cls; s.style.width = pct(n); bar.append(s);
  }
  add("div", "bKey", `Due before refill ${usd(b.committed)} · Reserve ${usd(b.floor)} (never spent) · Free ${usd(b.headroom)}`);

  const alerts = [...b.alerts];
  if (stale > 3) alerts.unshift(`These numbers are from ${b.as_of}. Ask Jarvis backend to refresh the page.`);
  if (days <= 0) alerts.unshift(`Refill was due ${b.next_refill}. Raise the card limit by ${usd(b.refill)}, then log it.`);
  if (alerts.length) { const ul = add("ul", "bAlerts"); for (const a of alerts) { const li = document.createElement("li"); li.textContent = a; ul.append(li); } }

  const list = (title, items, line) => {
    add("h4", null, title);
    if (!items.length) { add("p", "empty", "Nothing."); return; }
    for (const it of items) { const r = add("div", "bRow"); const [l, rt, sub] = line(it); r.innerHTML = "<span></span><b></b>"; r.querySelector("span").textContent = l; r.querySelector("b").textContent = rt; if (sub) { const s = document.createElement("small"); s.textContent = sub; r.querySelector("span").append(s); } }
  };
  list(`Due before ${b.next_refill}`, b.coming, (c) => [c.service, usd(c.amount), c.date]);

  add("h4", null, "Per service, last 30 days");
  for (const s of b.services) {
    const r = add("div", "bRow svc"); const used = s.cap ? s.spent_30d / s.cap : 0;
    r.innerHTML = "<span></span><b></b><i><u></u></i>";
    r.querySelector("span").textContent = s.service; r.querySelector("b").textContent = `${usd(s.spent_30d)} of ${usd(s.cap)}`;
    r.querySelector("u").style.width = Math.min(used * 100, 100) + "%"; if (used >= 0.8) r.classList.add("hot");
  }
  add("p", null, `Next two weeks need ${usd(b.next_period_need)} of the ${usd(b.refill)} refill.`);
  list("Recent charges", b.recent, (r) => [r.service, (r.kind === "refund" ? "+" : "−") + usd(r.amount), `${r.date} · approved by ${r.approved_by || "unknown"}`]);
}

async function decide(a, status) {
  const db = await dbPromise; if (!db) return;
  const { id, ...data } = a;
  try { await db.doc("spend/" + id).set({ ...data, status, decided: new Date().toISOString() }); } catch { return; }
  say("jarvis", status === "approved" ? `Approved ${usd(a.amount)} for ${a.service}. Jarvis backend buys it and logs it.` : `Declined ${a.service}. Nothing bought.`);
}
dbPromise.then((db) => {
  if (!db) return;
  db.collection("spend").orderBy("asked", "desc").limit(20).onSnapshot((snap) => {
    asks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const n = asks.filter((a) => a.status === "pending").length;
    $("budgetBtn").classList.toggle("alert", n > 0 || !!BUDGET?.frozen || !!BUDGET?.alerts?.length);
    $("budgetBtn").dataset.count = n || "";
    if ($("budget").open) renderBudget();
  });
});

$("budgetBtn").addEventListener("click", () => { renderBudget(); $("budget").showModal(); });
$("budgetDone").addEventListener("click", () => $("budget").close());
if (BUDGET?.frozen || BUDGET?.alerts?.length) $("budgetBtn").classList.add("alert");
