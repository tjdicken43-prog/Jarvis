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
const PLANS = { front_desk: { name: "Front Desk", monthly_cents: 14900, minutes: 300 }, front_desk_plus: { name: "Front Desk Plus", monthly_cents: 24900, minutes: 800 } };
const client = (id, name, trade, plan, billing, status, used) => {
  const inc = PLANS[plan].minutes, over = Math.max(0, used - inc), price = PLANS[plan].monthly_cents * (billing === "annual" ? 10 : 1);
  return { id, prospect_id: null, business_name: name, contact_name: null, email: `office@${name.split(" ")[0].toLowerCase()}.example`, phone: null, trade, plan, billing, status,
    included_minutes: inc, minutes_used: used, calls: Math.round(used / 3), over_minutes: over, overage_cents: over * 25, price_cents: price,
    monthly_value_cents: billing === "annual" ? Math.round(price / 12) : price, checkout_url: null, started_at: status === "pending" ? null : "2026-10-02T15:00:00Z", has_stripe: status !== "pending" };
};
const clients = [
  client(1, "Ozark Pipe Co", "plumbing", "front_desk", "monthly", "active", 212),
  client(2, "Ridge Roofing", "roofing", "front_desk_plus", "annual", "active", 846),
  client(3, "Benton Air", "hvac", "front_desk", "monthly", "past_due", 40),
  client(4, "Rogers Drain Pros", "plumbing", "front_desk", "monthly", "pending", 0),
];
const leads = [
  { id: 1, customer_name: "Pat L.", zip: "72712", trade: "plumbing", job_description: "Water heater leaking in garage", urgency: "emergency", source: "site form", status: "new", job_value_cents: null, commission_pct: 15, commission_cents: null, created_at: now(), matched_to: null },
  { id: 2, customer_name: "Sam R.", zip: "72756", trade: "roofing", job_description: "Hail damage, insurance claim open", urgency: "this_week", source: "site form", status: "matched", job_value_cents: 1240000, commission_pct: 15, commission_cents: 186000, created_at: now(), matched_to: "Ridge Roofing" },
];
const item = (e) => ({ email: { ...e, prospect_id: undefined }, prospect: prospects.find((p) => p.id === e.prospect_id), footer: FOOTER });

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  let raw = ""; for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  const p = u.pathname; const m = req.method;
  let r;
  if (m === "GET" && p === "/health") return send(res, 200, { ok: true, db: true, drafter: "stub", mailer: "stub", mailing_address_set: false, sent_today: emails.filter((e) => e.status === "sent").length, daily_cap: 20, paused, send_window: "Weekdays 9-11am Central", in_window: false });
  if (m === "GET" && p === "/clients") {
    const paying = clients.filter((c) => c.status === "active" || c.status === "past_due");
    return send(res, 200, { month: now().slice(0, 7), stripe: "test", items: clients, plans: PLANS, setup_cents: 29900, overage_cents_per_min: 25,
      summary: { active: clients.filter((c) => c.status === "active").length, past_due: clients.filter((c) => c.status === "past_due").length, pending: clients.filter((c) => c.status === "pending").length,
        mrr_cents: paying.reduce((a, c) => a + c.monthly_value_cents, 0), overage_cents: paying.reduce((a, c) => a + c.overage_cents, 0) } });
  }
  if (m === "POST" && p === "/clients") { const c = client(clients.length + 1, body.business_name || "New Shop", body.trade || "plumbing", body.plan || "front_desk", body.billing || "monthly", "pending", 0); clients.push(c); return send(res, 200, c); }
  if (m === "POST" && (r = p.match(/^\/clients\/(\d+)\/checkout$/))) { const c = clients.find((x) => x.id === +r[1]); c.checkout_url = `https://checkout.stripe.com/c/pay/cs_test_mock${c.id}`; return send(res, 200, { url: c.checkout_url, mode: "test", client: c }); }
  if (m === "GET" && p === "/leads") return send(res, 200, { display_only: true, note: "Display only until the Arkansas license question is checked.", items: leads, counts: {} });
  if (m === "GET" && p === "/stats") return send(res, 200, { prospects: {}, emails: {}, suppressions: suppressions.length });
  if (m === "GET" && p === "/queue") { const s = u.searchParams.get("status") || "draft"; return send(res, 200, { items: emails.filter((e) => e.status === s).map(item) }); }
  if (m === "POST" && p === "/outreach/draft") return send(res, 200, { created: [], skipped: [{ prospect_id: 9, name: "Dry Creek HVAC", reason: "no email address" }] });
  if (m === "POST" && p === "/outreach/prepare") return send(res, 200, { checked: [{ prospect_id: 9, name: "Dry Creek HVAC", flaw: null }], built: [], created: [], skipped: [{ prospect_id: 9, name: "Dry Creek HVAC", reason: "no clear flaw on their site" }] });
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
