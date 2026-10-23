// Checks the morning brief, reminders and memory panel against a fake store and fake connectors.
// 1) today's briefs/<date> shows on open, once;
// 2) a "REMIND:" line in a reply becomes a Google Calendar create_event with a pop-up at that minute (Central time);
// 3) MEMORY lists what Personal says and WRONG saves a correction lesson.
// Run: node hud/test/assistant.test.mjs   (needs Playwright, like memory.test.mjs)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const page_url = "file://" + fileURLToPath(new URL("../index.html", import.meta.url));
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const fake = (today) => {
  const docs = (window.__docs = JSON.parse(sessionStorage.getItem("fakeDocs") || "{}"));
  const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const snap = (id, d) => ({ id, exists: !!d, data: () => freeze(structuredClone(d)) });
  const save = () => sessionStorage.setItem("fakeDocs", JSON.stringify(docs));
  let n = 0;
  const db = {
    doc: (p) => ({ get: async () => snap(p.split("/").pop(), docs[p]), set: async (d) => { docs[p] = structuredClone(d); save(); } }),
    collection: (c) => {
      const all = () => Object.entries(docs).filter(([k]) => k.startsWith(c + "/")).map(([k, d]) => snap(k.slice(c.length + 1), d));
      const q = { orderBy: () => q, limit: () => q,
        get: async () => { const ds = all(); return { docs: ds, empty: !ds.length }; },
        onSnapshot: (fn) => fn({ docs: all(), size: all().length, empty: !all().length }),
        add: async (d) => { const id = "x" + Date.now() + n++; docs[c + "/" + id] = d; save(); return { id }; } };
      return q;
    },
  };
  window.__calls = [];
  const mcp = { callTool: async (server, tool, input) => { window.__calls.push({ server, tool, input }); return { payload: {} }; } };
  const sample = async () => ({ text: `SAY: I'll remind you at three, boss.\nREMIND: ${today}T15:00 | Call the gym` });
  window.claude = { use: async (n) => ({ db, sample, mcp }[n] || null) };
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript((today) => sessionStorage.getItem("fakeDocs") || sessionStorage.setItem("fakeDocs", JSON.stringify(
  { ["briefs/" + today]: { date: today, say: "Morning, boss. Light day.", lines: ["8:00 AM: J Street until noon"] } })), today);
await page.addInitScript(fake, today);
await page.goto(page_url);
await page.waitForTimeout(800);
const log1 = await page.locator("#log").innerText();

await page.fill("#q", "Remind me to call the gym at 3");
await page.press("#q", "Enter");
await page.waitForTimeout(800);
const calls = await page.evaluate(() => window.__calls);
const log2 = await page.locator("#log").innerText();

await page.click("#memBtn");
await page.waitForTimeout(200);
const mem = await page.locator("#memList").innerText();
await page.locator(".memItem", { hasText: "Wakes at 6:00, showers first" }).locator("button").click();
await page.fill(".memFix input", "Wakes at 5:30 now");
await page.press(".memFix input", "Enter");
await page.waitForTimeout(300);
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
const docs = await page.evaluate(() => window.__docs);

await page.reload();
await page.waitForTimeout(800);
const log3 = await page.locator("#log").innerText();
await browser.close();

const ev = calls.find((c) => c.tool === "create_event")?.input || {};
const fixes = Object.entries(docs).filter(([k, d]) => k.startsWith("lessons/") && d.correction);
const checks = [
  ["brief shows on open", log1.includes("Light day") && log1.includes("J Street until noon")],
  ["brief shows only once a day", !log3.includes("Light day")],
  ["reminder goes to Google Calendar", calls.some((c) => c.server === "Google Calendar" && c.tool === "create_event")],
  ["reminder at 3 PM Central with a pop-up on the minute", ev.startTime === today + "T15:00:00" && ev.endTime === today + "T15:15:00" && ev.timeZone === "America/Chicago" && ev.overrideReminders?.[0]?.minutes === 0 && ev.summary.includes("Call the gym")],
  ["reminder confirmed on screen", /Reminder set for today at 3:00 PM/.test(log2)],
  ["memory lists Personal", mem.includes("Wakes at 6:00") && mem.includes("Celiac") && !mem.includes("(ask TJ)")],
  ["WRONG saves a correction lesson", fixes.length === 1 && fixes[0][1].text.includes("Wakes at 5:30 now") && fixes[0][1].note === "Personal" && fixes[0][1].filed === false],
  ["no page errors", !errors.length],
];
for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
if (errors.length) console.log(errors.join("\n"));
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
