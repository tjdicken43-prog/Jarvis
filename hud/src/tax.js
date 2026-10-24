/* ---------- Tax sheet (money/tax: income + rules, packed into brain.js; nothing here costs usage) ---------- */
// Jarvis can't file or pay. Approve marks a filing OK'd in the page store as tax/<id> and opens the payment page
// with the numbers above it; "I paid it" closes it. Jarvis backend copies paid ones into money/tax/paid.csv.
const TAX = BRAIN.tax || null;
let taxMarks = {};

function renderTax() {
  const box = $("taxBody");
  box.innerHTML = "";
  const add = (tag, cls, text, to = box) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; to.append(el); return el; };
  if (!TAX) { add("p", "empty", "No tax numbers packed yet. Jarvis backend adds them on the next page refresh."); return; }
  const t = TAX, today = centralDay();
  const open = t.filings.filter((f) => taxMarks[f.id]?.status !== "paid");
  const next = open[0];

  const top = add("div", "bTop");
  for (const [v, k, cls] of [[t.setaside_pct + "%", "of profit to set aside"], [usd(t.owed_ytd), "owed this year so far"],
    [next ? (dayGap(today, next.due) > 0 ? dayGap(today, next.due) + " days" : "due now") : "none", "to next filing", next && dayGap(today, next.due) <= 7 ? "bad" : ""]]) {
    const c = add("div", "bCell " + cls, null, top); c.innerHTML = "<b></b><span></span>";
    c.querySelector("b").textContent = v; c.querySelector("span").textContent = k;
  }
  add("div", "bKey", `Plus every cent of sales tax you collect. Profit ${t.year} so far ${usd(t.profit_ytd)}.`);

  const alerts = [...t.alerts];
  if (dayGap(t.as_of, today) > 7) alerts.unshift(`These numbers are from ${t.as_of}. Ask Jarvis backend to refresh the page.`);
  if (alerts.length) { const ul = add("ul", "bAlerts"); for (const a of alerts) add("li", null, a, ul); }

  add("h4", null, "Filings");
  if (!open.length) add("p", "empty", t.income_rows ? "All paid. Nothing due." : "Nothing yet. Filings show up here once the first client pays.");
  for (const f of open) {
    const mark = taxMarks[f.id], approved = mark?.status === "approved";
    const r = add("div", "bAsk tFile" + (t.soon.includes(f.id) ? " soon" : ""));
    const head = add("div", null, null, r); head.innerHTML = "<b></b><span></span><small></small>";
    head.querySelector("b").textContent = usd(f.amount); head.querySelector("span").textContent = " " + f.title;
    head.querySelector("small").textContent = `Due ${f.due} · ${f.form} · covers ${f.period}`;
    const ul = add("ul", "tNums", null, r);
    for (const n of f.numbers) add("li", null, n, ul);
    add("small", null, approved ? `Approved. ${f.how}` : f.how, r);
    const btns = add("div", "bBtns", null, r);
    const link = add("a", "gear ghost", approved ? "Open payment page" : "Payment page", btns);
    link.href = f.pay_url; link.target = "_blank"; link.rel = "noopener";
    const yes = add("button", "gear primary", approved ? "I paid it" : (f.amount > 0 ? "Approve" : "Approve $0 filing"), btns);
    yes.type = "button";
    yes.addEventListener("click", () => {
      if (!approved) window.open(f.pay_url, "_blank", "noopener");
      markTax(f, approved ? "paid" : "approved");
    });
  }

  add("h4", null, "From each payment");
  for (const e of t.examples) {
    const r = add("div", "bRow"); r.innerHTML = "<span></span><b></b>";
    const it = t.items.find((i) => i.item === e.item);
    r.querySelector("span").textContent = it ? it.label : e.item;
    r.querySelector("b").textContent = "move " + usd(e.move);
    add("small", null, `Charge ${usd(e.charge)}${e.sales_tax ? ` (${usd(e.price)} + ${usd(e.sales_tax)} sales tax)` : ", no sales tax"} · ${usd(e.income_setaside)} for income tax`, r.querySelector("span"));
  }

  add("h4", null, `Sales tax, ${(t.rate * 100).toFixed(1).replace(/\.0$/, "")}% in ${t.rate_where}`);
  for (const i of t.items) {
    const r = add("div", "bRow"); r.innerHTML = "<span></span><b></b>";
    r.querySelector("span").textContent = i.label; r.querySelector("b").textContent = i.taxable ? "taxed" : "not taxed";
    add("small", null, i.why, r.querySelector("span"));
  }
  add("p", "tFine", "Estimates from money/tax/tax.py. Jarvis prepares the numbers; you file and pay on the official site. A CPA checks the method once before the first quarterly payment.");
}

async function markTax(f, status) {
  const db = await dbPromise; if (!db) return;
  try { await db.doc("tax/" + f.id).set({ filing: f.id, title: f.title, amount: f.amount, due: f.due, status, decided: new Date().toISOString() }); } catch { return; }
  say("jarvis", status === "approved" ? `${f.title}: ${usd(f.amount)} approved. Payment page is open. Tap I paid it when it goes through.` : `${f.title} marked paid. Jarvis backend logs it.`);
}
dbPromise.then((db) => {
  if (!db) return;
  db.collection("tax").limit(50).onSnapshot((snap) => {
    taxMarks = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    if ($("tax").open) renderTax();
  });
});

const taxSoon = () => (TAX?.soon || []).filter((id) => taxMarks[id]?.status !== "paid").length;
if (taxSoon()) $("budgetBtn").classList.add("alert");
$("taxBtn").addEventListener("click", () => { $("budget").close(); renderTax(); $("tax").showModal(); });
$("taxDone").addEventListener("click", () => $("tax").close());
