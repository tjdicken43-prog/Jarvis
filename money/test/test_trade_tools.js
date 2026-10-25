// Offline test: Tradesheet math, plus the site bar on every page of the trade-tools site.
const assert = require("assert"), fs = require("fs"), path = require("path");
const site = path.join(__dirname, "..", "lanes", "trade-tools", "site");
const T = require(path.join(site, "assets", "calc.js"));

// pitch factor: 6/12 is 1.118, 12/12 is 1.414, flat is 1
assert.strictEqual(T.pitchFactor(0), 1);
assert(Math.abs(T.pitchFactor(6) - 1.1180) < 1e-3 && Math.abs(T.pitchFactor(12) - Math.SQRT2) < 1e-9);

// 40 x 30 footprint at 6/12: 1200 * 1.118 = 1341.6 sq ft = 13.4 squares; moderate waste 15% = 15.4 squares; 3 bundles each = 47
let r = T.roofing({ area_mode: "footprint", length: 40, width: 30, pitch: 6, complexity: "moderate" });
assert.strictEqual(r.roof_area_sqft, 1342); assert.strictEqual(r.squares, 13.4); assert.strictEqual(r.squares_with_waste, 15.4);
assert.strictEqual(r.shingle_bundles, 47); assert.strictEqual(r.underlayment_rolls, 2);
assert.strictEqual(r.eave_rake_lf, 140); assert.strictEqual(r.starter_bundles, 2); assert.strictEqual(r.drip_edge_pieces, 14);
assert.strictEqual(r.ridge_cap_bundles, 2);
// known roof area, 4 bundles a square, no length info: no starter or ridge guess
r = T.roofing({ area_mode: "roof", roof_area: 2500, complexity: "simple", bundles_per_square: 4 });
assert.strictEqual(r.squares, 25); assert.strictEqual(r.shingle_bundles, 110); assert.strictEqual(r.starter_bundles, 0);
assert.throws(() => T.roofing({ area_mode: "roof", roof_area: 0, complexity: "simple" }));
assert.throws(() => T.roofing({ area_mode: "roof", roof_area: 900, complexity: "huge" }));

// HVAC: 2000 sq ft, 8 ft, average everything, 2 people = 50,000 BTU = 4.17 tons -> nearest nominal size is 4
let h = T.hvac({ sqft: 2000, ceiling_ft: 8, insulation: "average", windows: "average", sun: "mixed", people: 2 });
assert.strictEqual(h.btu_mid, 50000); assert.strictEqual(h.nominal_tons, 4);
assert(h.tons_low < h.tons_mid && h.tons_mid < h.tons_high);
h = T.hvac({ sqft: 1200, ceiling_ft: 8, insulation: "good", windows: "few", sun: "shaded", people: 2 });
assert.strictEqual(h.nominal_tons, 2); assert(h.sqft_per_ton > 500);
assert.throws(() => T.hvac({ sqft: 100, insulation: "average", windows: "average", sun: "mixed" }));
assert.throws(() => T.hvac({ sqft: 1500, insulation: "none", windows: "average", sun: "mixed" }));

// estimate: markup on materials only, tax on taxable lines only, deposit off the total
let e = T.estimate({ markup_pct: 20, tax_pct: 10, deposit_pct: 50, lines: [
  { desc: "Shingles", qty: 10, unit: 100, kind: "material", taxable: true },
  { desc: "Labor", qty: 20, unit: 50, kind: "labor", taxable: false }] });
assert.strictEqual(e.subtotal, 2200); assert.strictEqual(e.tax, 120); assert.strictEqual(e.total, 2320);
assert.strictEqual(e.deposit, 1160); assert.strictEqual(e.balance, 1160);
assert.throws(() => T.estimate({ lines: [{ desc: "", qty: 1, unit: 5 }] }));

// site bar on every page
const pages = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
  fs.statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") && pages.push(p); } })(site);
assert(pages.length >= 5, "pages: " + pages.length);
const css = fs.readFileSync(path.join(site, "assets", "site.css"), "utf8");
const banned = /\b(elevate|seamless|unlock|unleash|empower|cutting-edge|state-of-the-art|your trusted partner|look no further|we pride ourselves|one-stop shop|nestled|lorem|todo)\b|\{\{|example\.com|555-/i;
const radii = [...css.matchAll(/border-radius:\s*(\d+)px/g)].map((m) => +m[1]);
assert(radii.length && Math.max(...radii) <= 8 && !/999px|50%/.test(css), "radii " + radii);
assert(!/gradient/i.test(css), "no gradients");
for (const p of pages) {
  const html = fs.readFileSync(p, "utf8"), rel = path.relative(site, p);
  assert(!banned.test(html), rel + " has banned wording: " + (html.match(banned) || [])[0]);
  assert(/<title>[^<]{10,70}<\/title>/.test(html), rel + " title");
  assert(/<meta name="description" content="[^"]{60,170}"/.test(html), rel + " description");
  assert(/<meta name="viewport"/.test(html) && /<h1>/.test(html), rel + " viewport/h1");
  assert(!/!/.test(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/!=|&excl;/g, "")), rel + " exclamation mark in copy");
  for (const m of html.matchAll(/(?:href|src)="([^"#:]+?)"/g)) {   // local links must exist
    const t = path.join(path.dirname(p), m[1]); const ok = fs.existsSync(t) || fs.existsSync(path.join(t, "index.html"));
    assert(ok, rel + " broken link " + m[1]);
  }
}
console.log("trade tools ok:", pages.length, "pages");
