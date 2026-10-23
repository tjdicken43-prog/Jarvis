// Dev mock of the agency API. In-memory. Usage: node scripts/mock-api.mjs  (PORT default 8000)
import http from "node:http";

const FOOTER = "Sent by Your Name, 123 Main St, Springfield. Reply STOP or unsubscribe: https://example.com/u/abc";
const prospects = [
  { id: 1, name: "Atlas Plumbing & Drain", trade: "plumbing", city: "Tulsa, OK", phone: "918-555-0142", email: "info@atlasplumbing.example", website: "https://atlasplumbing.example", rating: 4.6, review_count: 87, site_state: "outdated", flaw: "No mobile layout and no click-to-call", flaw_evidence: "https://example.com/evidence/1", mockup_url: "https://example.com/mockup/1" },
  { id: 2, name: "Ridgeline Roofing", trade: "roofing", city: "Wichita, KS", phone: "316-555-0177", email: "hello@ridgelineroofing.example", website: "https://ridgelineroofing.example", rating: 4.2, review_count: 31, site_state: "slow", flaw: "Contact form errors out", flaw_evidence: "https://example.com/evidence/2", mockup_url: null },
];
const now = () => new Date().toISOString();
const emails = [1, 2].map((i) => ({
  id: i, prospect_id: i, kind: "cold", status: "draft", edited: false, created_at: now(), approved_at: null, sent_at: null, send_after: null,
  subject: i === 1 ? "Missed calls at Atlas Plumbing" : "Your contact form is broken",
  body: i === 1 ? "Hi, I looked at your site on my phone and the call button is missing. I rebuilt it and added an AI receptionist that answers after hours. Want the preview?" : "Hi, your quote form returns an error. I fixed it in a rebuilt version of the site. Can I send it over?",
}));
let suppressions = [{ id: 1, email: "no@example.com", domain: null, reason: "asked to stop", created_at: now() }];
let paused = false;
const item = (e) => ({ email: { ...e, prospect_id: undefined }, prospect: prospects.find((p) => p.id === e.prospect_id), footer: FOOTER });

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  let raw = ""; for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  const p = u.pathname; const m = req.method;
  let r;
  if (m === "GET" && p === "/health") return send(res, 200, { ok: true, db: true, drafter: "stub", mailer: "stub", mailing_address_set: false, sent_today: emails.filter((e) => e.status === "sent").length, daily_cap: 20, paused, send_window: "Weekdays 9-11am Central", in_window: false });
  if (m === "GET" && p === "/stats") return send(res, 200, { prospects: {}, emails: {}, suppressions: suppressions.length });
  if (m === "GET" && p === "/queue") { const s = u.searchParams.get("status") || "draft"; return send(res, 200, { items: emails.filter((e) => e.status === s).map(item) }); }
  if (m === "POST" && p === "/outreach/draft") return send(res, 200, { created: [], skipped: [{ prospect_id: 9, name: "Dry Creek HVAC", reason: "no email address" }] });
  if (m === "POST" && p === "/send") { const a = emails.filter((e) => e.status === "approved"); return send(res, 200, { sent: 0, dry_run: true, held: a.map((e) => ({ email_id: e.id, reason: "outside send window" })), detail: "Stub mailer: nothing sent" }); }
  if (m === "POST" && p === "/settings/pause") { paused = !!body.paused; return send(res, 200, { paused }); }
  if (p === "/suppressions") {
    if (m === "GET") return send(res, 200, { items: suppressions });
    if (m === "POST") { if (!body.email && !body.domain) return send(res, 422, { detail: "email or domain required" }); const row = { id: suppressions.length + 1, email: body.email || null, domain: body.domain || null, reason: body.reason, created_at: now() }; suppressions.push(row); return send(res, 200, row); }
  }
  if ((r = p.match(/^\/emails\/(\d+)(?:\/(\w+))?$/))) {
    const e = emails.find((x) => x.id === +r[1]);
    if (!e) return send(res, 404, { detail: "not found" });
    const act = r[2];
    if (m === "GET" && !act) return send(res, 200, item(e));
    if (m === "PATCH" && !act) { if (e.status !== "draft") return send(res, 409, { detail: "only drafts can be edited" }); if (body.subject != null) e.subject = body.subject; if (body.body != null) e.body = body.body; e.edited = true; return send(res, 200, item(e)); }
    if (m === "POST" && act === "approve") { e.status = "approved"; e.approved_at = now(); return send(res, 200, { item: item(e), queued: true, detail: "Queued for the next send window (stub mode, nothing will be sent)" }); }
    if (m === "POST" && act === "unapprove") { e.status = "draft"; e.approved_at = null; return send(res, 200, item(e)); }
    if (m === "POST" && act === "cancel") { e.status = "cancelled"; return send(res, 200, item(e)); }
  }
  send(res, 404, { detail: "not found" });
}).listen(+(process.env.PORT || 8000), () => console.log("mock api on", process.env.PORT || 8000));
