// Manual check for the phone page's chat memory. Run: NODE_PATH=$(npm root -g) node hud/check-save.js
// Fakes the claude.ai store with frozen data (like the real one hands back), then checks that
// a reply with a "For the brain" line saves, and that a reload picks the same chat back up.
const { chromium } = require("playwright");
const path = require("path");

const fake = (seed) => `
const deep = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deep); Object.freeze(o); } return o; };
const docs = JSON.parse(localStorage.getItem("fakedb") || ${JSON.stringify(JSON.stringify(seed))});
const keep = () => localStorage.setItem("fakedb", JSON.stringify(docs));
const snap = (id) => ({ id, exists: id in docs, data: () => deep(JSON.parse(JSON.stringify(docs[id] || {}))) });
const db = {
  doc: (id) => ({ get: async () => snap(id), set: async (v) => { docs[id] = JSON.parse(JSON.stringify(v)); keep(); } }),
  collection: (c) => {
    const q = { orderBy: () => q, limit: () => q,
      get: async () => { const d = Object.keys(docs).filter((k) => k.startsWith(c + "/")).sort().reverse().map((k) => ({ ...snap(k), id: k.slice(c.length + 1) })); return { empty: !d.length, docs: d }; },
      onSnapshot: () => () => {} };
    return q;
  },
};
window.claude = { use: async (n) => (n === "db" ? db : null) };`;

(async () => {
  const now = new Date().toISOString();
  const seed = { "memory/lessons": { items: [{ text: "old lesson", at: now, filed: true }] } };
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(fake(seed));
  const url = "file://" + path.join(__dirname, "index.html");
  await page.goto(url);
  await page.waitForTimeout(800);
  await page.evaluate(() => remember("I like lo-fi to sleep", "SAY: Noted, boss.\nFor the brain: TJ falls asleep to lo-fi."));
  await page.waitForTimeout(300);
  const log = await page.locator("#log").innerText();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fakedb")));
  const ok1 = !/Couldn't save/.test(log) && saved["memory/lessons"].items.length === 2 && Object.keys(saved).some((k) => k.startsWith("chats/"));
  console.log(ok1 ? "PASS save with frozen store" : "FAIL save: " + log);

  await page.reload();
  await page.waitForTimeout(800);
  const after = await page.locator("#log").innerText();
  const ok2 = after.includes("I like lo-fi to sleep");
  const ids = await page.evaluate(() => chatId);
  const ok3 = Object.keys(saved).includes("chats/" + ids);
  console.log(ok2 && ok3 ? "PASS chat resumes after reload" : "FAIL resume: " + after.slice(0, 200));
  if (errors.length) console.log("page errors:", errors.join(" | "));
  await browser.close();
  process.exit(ok1 && ok2 && ok3 ? 0 : 1);
})();
