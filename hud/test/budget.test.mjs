// Checks the Budget sheet's Approve button against a fake page store:
// 1) a pending ask shows with Approve, and Approve writes status "approved" to spend/<id>;
// 2) an ask bigger than what's safe to spend can't be approved (the $25 reserve is hard);
// 3) the wallet icon shows the pending count.
// Run: node hud/test/budget.test.mjs   (needs Playwright; NODE_PATH=<global node_modules> for a global install)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const hud = new URL("..", import.meta.url);
const page_url = "file://" + fileURLToPath(new URL("index.html", hud));
const budget = { as_of: "2099-01-01", balance: 118, floor: 25, refill: 150, next_refill: "2099-01-10", days_to_refill: 9, committed: 7.25,
  headroom: 85.75, coming: [], next_period: [], next_period_need: 0, services: [], alerts: [], frozen: false, recent: [] };
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
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/brain.js", (r) => r.fulfill({ contentType: "text/javascript",
  body: readFileSync(new URL("brain.js", hud), "utf8") + `\nwindow.BRAIN.budget = ${JSON.stringify(budget)};` }));
await page.addInitScript(() => sessionStorage.getItem("fakeDocs") || sessionStorage.setItem("fakeDocs", JSON.stringify({
  "spend/a1": { service: "vercel", amount: 20, why: "Hosting for the demo sites (new service).", asked: "2099-01-01T10:00:00Z", status: "pending" },
  "spend/a2": { service: "render", amount: 120, why: "Bigger database.", asked: "2099-01-01T09:00:00Z", status: "pending" },
})));
await page.addInitScript(fake);
await page.goto(page_url);
await page.waitForTimeout(800);
const count = await page.getAttribute("#budgetBtn", "data-count");
await page.click("#budgetBtn");
await page.waitForTimeout(300);
const asks = page.locator(".bAsk");
const n = await asks.count();
const bigDisabled = await asks.nth(1).locator("button.primary").isDisabled();
await asks.nth(0).locator("button.primary").click();
await page.waitForTimeout(300);
const docs = await page.evaluate(() => window.__docs);
const left = await page.locator(".bAsk").count();
await browser.close();

const checks = [
  ["wallet shows 2 waiting", count === "2"],
  ["both asks listed", n === 2],
  ["over-reserve ask can't be approved", bigDisabled],
  ["Approve writes approved + time", docs["spend/a1"].status === "approved" && !!docs["spend/a1"].decided],
  ["other ask still pending", docs["spend/a2"].status === "pending" && left === 1],
  ["no page errors", !errors.length],
];
for (const [name, ok] of checks) console.log(ok ? "PASS" : "FAIL", name);
if (errors.length) console.log(errors.join("\n"));
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
