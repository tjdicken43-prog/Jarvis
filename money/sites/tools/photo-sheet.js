// One run per business: pulls images from their site and Google profile into one contact sheet.
// Look at the sheet once, pick the real photos (not stock, not AI-made), then ask the owner for more.
// Needs a Full-network cloud environment. Setup: npm i playwright sharp
// Usage: node photo-sheet.js <slug> <site-url> "<Google Maps search, e.g. Name Town AR>" [out-dir]
const { chromium, devices } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [slug, site, gq, outArg] = process.argv.slice(2);
if (!slug || !site) { console.log('usage: node photo-sheet.js <slug> <site-url> "<maps query>" [out]'); process.exit(1); }
const out = path.resolve(outArg || 'photo-out', slug);
fs.mkdirSync(path.join(out, 'raw'), { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'].find(f => fs.existsSync(f));
const skip = /\.cur$|StaticMapService|spacer|arrow|icon|\.svg|\.gif|gravatar|loading|analytics|trustindex|maps\/vt|captcha|googleusercontent\.com\/a[-/]/;

(async () => {
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const imgs = new Set();
  // 1. Their site: home page plus up to 4 inner pages, at a 390 px phone size (also saves the "before" shot).
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  p.on('response', r => { if ((r.headers()['content-type'] || '').startsWith('image/') && !skip.test(r.url())) imgs.add(r.url()); });
  await p.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(8000); // gives bot-check pages time to pass
  await p.screenshot({ path: path.join(out, 'before-phone.png') });
  for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(150); }
  const links = await p.$$eval('a[href]', a => [...new Set(a.map(x => x.href))].filter(h => h.startsWith(location.origin) && /about|project|gallery|work|team|media/i.test(h)));
  const social = await p.$$eval('a[href]', a => [...new Set(a.map(x => x.href))].filter(h => /facebook|instagram|share\.google|maps/.test(h)));
  for (const u of links.slice(0, 4)) {
    await p.goto(u, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(120); }
  }
  await ctx.close();
  // 2. Google profile: photo links come back inside the Maps page data.
  if (gq) {
    const g = await b.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
    const grab = t => { t = t.replace(/\\\//g, '/').replace(/\\u003d/g, '=');
      for (const m of t.matchAll(/https:\/\/lh[0-9]\.googleusercontent\.com\/(?:p|gps-cs-s|geougc|geougc-cs|gps-proxy)\/[A-Za-z0-9_\-]+/g)) imgs.add(m[0] + '=w1400'); };
    g.on('response', async r => { if (/\/maps\/|tbm=map/.test(r.url())) { try { grab(await r.text()); } catch {} } });
    await g.goto('https://www.google.com/maps/search/' + encodeURIComponent(gq) + '?hl=en', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await g.waitForTimeout(7000);
    const first = g.locator('a.hfpxzc').first();
    if (await first.count()) { await first.click(); await g.waitForTimeout(5000); }
    const ph = g.locator('button:has-text("See photos")').first();
    if (await ph.count()) { await ph.click(); await g.waitForTimeout(6000); }
    grab(await g.content());
  }
  await b.close();
  // 3. Download, keep anything 300 px or bigger, and lay it out as one numbered sheet.
  const files = [];
  for (const u of imgs) {
    try {
      const buf = execFileSync('curl', ['-sL', '-m', '30', u], { maxBuffer: 50e6 });
      const m = await sharp(buf).metadata(); if (m.width < 300 && m.height < 300) continue;
      const f = path.join(out, 'raw', String(files.length).padStart(2, '0') + '.' + (m.format === 'jpeg' ? 'jpg' : m.format));
      fs.writeFileSync(f, buf); files.push([f, u]);
    } catch (e) { console.log('skip', u.slice(0, 80), e.message); }
  }
  fs.writeFileSync(path.join(out, 'sources.txt'), files.map(([f, u]) => path.basename(f) + ' ' + u).join('\n') + '\n\nsocial: ' + social.join(' ') + '\n');
  const W = 300, H = 220, tiles = [];
  for (const [i, [f]] of files.entries()) {
    const img = await sharp(f).resize(W, H - 20, { fit: 'contain', background: '#888' }).toBuffer();
    const lbl = Buffer.from(`<svg width="${W}" height="20"><rect width="100%" height="100%"/><text x="4" y="14" font-size="12" fill="#fff">${i}</text></svg>`);
    tiles.push({ input: lbl, left: (i % 4) * W, top: Math.floor(i / 4) * H }, { input: img, left: (i % 4) * W, top: Math.floor(i / 4) * H + 20 });
  }
  if (files.length) await sharp({ create: { width: 4 * W, height: Math.ceil(files.length / 4) * H, channels: 3, background: '#fff' } }).composite(tiles).png().toFile(path.join(out, 'sheet.png'));
  console.log(`${files.length} images. Look at ${path.join(out, 'sheet.png')} once; sources in sources.txt`);
})();
