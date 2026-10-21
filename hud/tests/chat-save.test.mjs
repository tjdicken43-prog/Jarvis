// Checks the phone page saves chats and lessons when the store hands back frozen data,
// and keeps the same chat across a Chat -> Jobs -> Chat trip and a page reload.
// Run: NODE_PATH=$(npm root -g) node hud/tests/chat-save.test.mjs
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const page_url = "file://" + path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../index.html");

// A fake claude.ai runtime: a store kept in localStorage that freezes everything it returns and everything it is given.
const fake = () => {
  const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const load = () => JSON.parse(localStorage.getItem("mockdb") || "{}");
  const save = (d) => localStorage.setItem("mockdb", JSON.stringify(d));
  const snap = (id, v) => ({ id, exists: v !== undefined, data: () => freeze(JSON.parse(JSON.stringify(v ?? {}))) });
  if (!localStorage.getItem("mockdb")) save({ "memory/lessons": { items: [{ text: "old lesson", at: "2026-10-20T00:00:00Z", filed: true }] } });
  const db = {
    doc: (p) => ({
      get: async () => snap(p, load()[p]),
      set: async (v) => { freeze(v); const d = load(); d[p] = JSON.parse(JSON.stringify(v)); save(d); },
    }),
    collection: (c) => {
      const q = {
        orderBy: () => q, limit: () => q,
        get: async () => {
          const docs = Object.entries(load()).filter(([k]) => k.startsWith(c + "/")).sort((a, b) => (b[1].started || "").localeCompare(a[1].started || ""))
            .map(([k, v]) => snap(k.slice(c.length + 1), v));
          return { empty: !docs.length, docs, size: docs.length };
        },
        onSnapshot: (fn) => fn({ size: 0, forEach() {}, docs: [] }),
      };
      return q;
    },
  };
  let n = 0;
  const sample = async () => ({ text: `SAY: Reply ${++n}, boss.\nFor the brain: lesson ${n} (${Date.now()})` });
  window.claude = { use: async (name) => ({ db, sample }[name] ?? null) };
};

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(fake);
await page.goto(page_url);
const ask = async (q) => { await page.fill("#q", q); await page.press("#q", "Enter"); await page.waitForTimeout(600); };
const notes = () => page.$$eval(".msg.note", (els) => els.map((e) => e.textContent));
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem("mockdb")));

await page.waitForTimeout(500);
await ask("first question");
await ask("second question");
let bad = (await notes()).filter((t) => /Couldn't save/.test(t));
if (bad.length) fail("save threw: " + bad[0]);
let d = await db();
const chats = Object.keys(d).filter((k) => k.startsWith("chats/"));
if (chats.length !== 1) fail("expected 1 chat, got " + chats.length);
if (d[chats[0]]?.turns?.length !== 4) fail("expected 4 turns, got " + d[chats[0]]?.turns?.length);
if (d["memory/lessons"].items.length !== 3) fail("expected 3 lessons, got " + d["memory/lessons"].items.length);

// Chat -> Jobs -> Chat, then a reload (what the claude.ai frame can do when TJ leaves the tab)
await page.click('[data-go="jobs"]'); await page.click('[data-go="comms"]');
await page.reload(); await page.waitForTimeout(800);
const shown = await page.$$eval(".msg.you", (els) => els.map((e) => e.textContent));
if (!shown.includes("first question")) fail("old chat not shown after reload: " + JSON.stringify(shown));
await ask("third question");
d = await db();
const chats2 = Object.keys(d).filter((k) => k.startsWith("chats/"));
if (chats2.length !== 1) fail("reload started a new chat: " + chats2.join(", "));
if (d[chats2[0]]?.turns?.length !== 6) fail("expected 6 turns after reload, got " + d[chats2[0]]?.turns?.length);

// "new chat" starts fresh
await ask("new chat"); await page.waitForTimeout(800);
await ask("fresh question");
d = await db();
if (Object.keys(d).filter((k) => k.startsWith("chats/")).length !== 2) fail("new chat did not start a second chat");
bad = (await notes()).filter((t) => /Couldn't save/.test(t));
if (bad.length) fail("save threw later: " + bad[0]);

await browser.close();
if (!process.exitCode) console.log("PASS: frozen store saves, chat kept across tabs and reload, new chat works");
