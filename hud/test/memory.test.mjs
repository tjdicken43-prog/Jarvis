// Checks the phone page's chat memory against a fake store that, like the real one, hands back frozen data.
// 1) a reply with a "For the brain" line saves both the chat and the lesson, as its own lessons/<id> record (no "object is not extensible");
// 2) a reload (what tab or app switching can do on claude.ai) comes back to the same chat.
// Run: node hud/test/memory.test.mjs   (needs Playwright; NODE_PATH=<global node_modules> for a global install,
// CHROMIUM=/path if it can't find a browser)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright"); // plain require, so NODE_PATH works for a global install

const page_url = "file://" + fileURLToPath(new URL("../index.html", import.meta.url));
const fake = () => {
  const docs = (window.__docs = JSON.parse(sessionStorage.getItem("fakeDocs") || "{}"));
  const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const snap = (id, d) => ({ id, exists: !!d, data: () => freeze(structuredClone(d)) });
  const save = () => sessionStorage.setItem("fakeDocs", JSON.stringify(docs));
  const db = {
    doc: (p) => ({ get: async () => snap(p.split("/").pop(), docs[p]), set: async (d) => { docs[p] = structuredClone(d); save(); } }),
    collection: (c) => {
      const all = () => Object.entries(docs).filter(([k]) => k.startsWith(c + "/")).map(([k, d]) => snap(k.slice(c.length + 1), d));
      const q = { orderBy: () => q, limit: () => q,
        get: async () => { const ds = all().sort((a, b) => (b.data().started || "").localeCompare(a.data().started || "")); return { docs: ds, empty: !ds.length }; },
        onSnapshot: (fn) => fn({ docs: all(), size: all().length, empty: !all().length }),
        add: async (d) => { docs[c + "/" + Date.now()] = d; save(); } };
      return q;
    },
  };
  const sample = async () => ({ text: "SAY: Noted, boss.\nFor the brain: TJ likes lo-fi to fall asleep (check)." });
  window.claude = { use: async (n) => ({ db, sample }[n] || null) };
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => sessionStorage.getItem("fakeDocs") || sessionStorage.setItem("fakeDocs", JSON.stringify(
  { "memory/lessons": { items: [{ text: "older lesson", at: "2026-10-20T00:00:00Z", filed: true }] } })));
await page.addInitScript(fake);
await page.goto(page_url);
await page.waitForTimeout(800);
await page.fill("#q", "I like lo-fi to fall asleep");
await page.press("#q", "Enter");
await page.waitForTimeout(800);
const log1 = await page.locator("#log").innerText();
const docs1 = await page.evaluate(() => window.__docs);
const chats1 = Object.keys(docs1).filter((k) => k.startsWith("chats/"));

await page.reload();
await page.waitForFunction(() => document.querySelector("#log").innerText.includes("lo-fi"), null, { timeout: 5000 }).catch(() => {});
const log2 = await page.locator("#log").innerText();
const docs2 = await page.evaluate(() => window.__docs);
const chats2 = Object.keys(docs2).filter((k) => k.startsWith("chats/"));
await browser.close();

const checks = [
  ["no save error", !/Couldn't save/.test(log1)],
  ["lesson saved as its own record, old list kept", Object.keys(docs1).filter((k) => k.startsWith("lessons/")).length === 1 && docs1["memory/lessons"]?.items?.length === 1],
  ["chat saved", chats1.length === 1 && docs1[chats1[0]].turns.length === 2],
  ["same chat after reload", chats2.length === 1 && chats2[0] === chats1[0]],
  ["chat shown again after reload", log2.includes("I like lo-fi to fall asleep")],
  ["no page errors", !errors.length],
];
for (const [name, ok] of checks) console.log((ok ? "ok   " : "FAIL ") + name);
if (errors.length) console.log(errors.join("\n"));
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
