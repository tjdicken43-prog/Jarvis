// Checks the Tax sheet against a fake page store:
// 1) it opens from the Budget sheet and lists filings with their numbers;
// 2) Approve writes tax/<id> status "approved" and opens the payment page; "I paid it" then writes "paid";
// 3) a paid filing drops off the list; the wallet lights up when a filing is due soon.
// Run: node hud/test/tax.test.mjs   (needs Playwright; NODE_PATH=<global node_modules> for a global install)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const hud = new URL("..", import.meta.url);
const page_url = "file://" + fileURLToPath(new URL("index.html", hud));
const filing = (id, title, amount, due) => ({ id, kind: "fed", title, form: "Form 1040-ES", period: "2099-01-01 to 2099-03-31", due, amount,
  paid: 0, pay_url: "https://www.irs.gov/payments/direct-pay", how: "IRS Direct Pay.", numbers: ["Pay now: $" + amount] });
const tax = { as_of: "2099-01-01", year: 2099, profit_ytd: 1200, setaside_pct: 25, owed_ytd: 300, income_tax_ytd: {}, sales_tax_ytd: 0,
  income_tax_paid: 0, examples: [{ item: "monitoring", price: 200, sales_tax: 19, charge: 219, income_setaside: 47.5, move: 66.5 }],
  items: [{ item: "monitoring", label: "Gym security", taxable: true, why: "GR-9.12" }], rate: 0.095, rate_where: "Bentonville",
  filings: [filing("fed-2099-Q1", "Federal estimate 2099 Q1", 180, "2099-04-15"), filing("ar-2099-Q1", "Arkansas estimate 2099 Q1", 40, "2099-04-15")],
  soon: ["fed-2099-Q1"], alerts: ["Have a CPA check these numbers once before the first quarterly payment."], cpa_checked: false, income_rows: 3 };
const fake = () => {
  const docs = (window.__docs = JSON.parse(sessionStorage.getItem("fakeDocs") || "{}"));
  const subs = [];
  const snap = (id, d) => ({ id, exists: !!d, data: () => structuredClone(d) });
  const save = () => { sessionStorage.setItem("fakeDocs", JSON.stringify(docs)); subs.forEach((f) => f()); };
  const db = {
    doc: (p) => ({ get: async () => snap(p.split("/").pop(), docs[p]), set: async (d) => { docs[p] = structuredClone(d); save(); } }),
    collection: (c) => {
      const all = () => Object.entries(docs).filter(([k]) => k.startsWith(c + "/")).map(([k, d]) => snap(k.slice(c.length + 1), d));
      const q = { orderBy: () => q, limit: () => q, get: async () => ({ docs: all(), empty: !all().length }),
        onSnapshot: (fn) => { const run = () => fn({ docs: all(), size: all().length, empty: !all().length }); subs.push(run); run(); },
        add: async (d) => { docs[c + "/" + Date.now()] = d; save(); } };
      return q;
    },
  };
  window.claude = { use: async (n) => ({ db }[n] || null) };
  window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; };
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/brain.js", (r) => r.fulfill({ contentType: "text/javascript",
  body: readFileSync(new URL("brain.js", hud), "utf8") + `\nwindow.BRAIN.tax = ${JSON.stringify(tax)};` }));
await page.addInitScript(fake);
await page.goto(page_url);
await page.waitForTimeout(800);
const lit = await page.evaluate(() => document.getElementById("budgetBtn").classList.contains("alert"));
await page.click("#budgetBtn");
await page.waitForTimeout(200);
await page.click("#taxBtn");
await page.waitForTimeout(300);
const n = await page.locator(".tFile").count();
const soon = await page.locator(".tFile.soon").count();
const nums = await page.locator(".tFile").first().locator(".tNums li").count();
await page.locator(".tFile").first().locator("button.primary").click();
await page.waitForTimeout(300);
const a1 = await page.evaluate(() => ({ d: window.__docs["tax/fed-2099-Q1"], o: window.__opened }));
const label = await page.locator(".tFile").first().locator("button.primary").textContent();
await page.locator(".tFile").first().locator("button.primary").click();
await page.waitForTimeout(300);
const a2 = await page.evaluate(() => window.__docs["tax/fed-2099-Q1"]);
const left = await page.locator(".tFile").count();
const wide = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
await page.screenshot({ path: process.env.SHOT || "/tmp/tax-sheet.png" });
await browser.close();

const checks = [
  ["wallet lit for a filing due soon", lit],
  ["two filings listed, one marked soon", n === 2 && soon === 1],
  ["numbers shown", nums === 1],
  ["Approve writes approved", a1.d?.status === "approved" && a1.d?.amount === 180],
  ["Approve opens the IRS page", a1.o[0] === "https://www.irs.gov/payments/direct-pay"],
  ["button turns into I paid it", label === "I paid it"],
  ["I paid it writes paid", a2?.status === "paid"],
  ["paid filing drops off", left === 1],
  ["no sideways scroll on phone", wide],
  ["no page errors", errors.length === 0],
];
for (const [k, ok] of checks) console.log((ok ? "ok   " : "FAIL ") + k + (k === "no page errors" && !ok ? ": " + errors.join("; ") : ""));
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
