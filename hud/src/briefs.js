/* ---------- Briefs: the factory's outreach drafts waiting on TJ, under the factory feed ----------
   Read through TJ's Render connector, straight from the agency database (read-only: query_render_postgres).
   Approve queues a job: Jarvis backend calls the agency API, which re-checks the do-not-email list and the
   pre-flight rules, then queues the email for the next send window. Later hides a brief here for a day. */
const AGENCY = { db: "dpg-dbe1gmfavr4c739ovh6g-a", workspace: "tea-dadt7tgn74is73bgksi0", api: "https://agency-api-kmkw.onrender.com", dash: "https://agency-dashboard-iejj.onrender.com" };
const BRIEF_SQL = `SELECT e.id, e.kind, e.subject, e.body, p.name, p.trade, p.city, p.flaw, p.mockup_url
FROM emails e JOIN prospects p ON p.id = e.prospect_id WHERE e.status = 'draft' ORDER BY e.created_at, e.id LIMIT 12`;
const TRADE = { plumbing: "Plumbing", hvac: "Heating and air", roofing: "Roofing" };
const briefLater = () => { try { return JSON.parse(store.get("briefLater", "{}")); } catch { return {}; } };

function briefRows(res) { // the connector's result shape isn't documented: accept rows, {rows}, or JSON text
  let p = res?.payload ?? res;
  if (typeof p === "string") try { p = JSON.parse(p); } catch { return []; }
  const text = res?.result?.content?.find?.((c) => c.type === "text")?.text;
  if (!p && text) try { p = JSON.parse(text); } catch {}
  const rows = Array.isArray(p) ? p : p?.rows || p?.results || p?.data || [];
  return Array.isArray(rows) ? rows.filter((r) => r && r.id != null) : [];
}
function briefState(html, count = "") {
  $("briefs").innerHTML = html; $("briefCount").textContent = count;
  $("briefBox").classList.toggle("has", !!count);
}
async function loadBriefs() {
  const mcp = await mcpPromise;
  if (!mcp) { briefState(`<p class="empty">Briefs show in the claude.ai copy of Jarvis.</p>`); return; }
  let rows;
  try {
    rows = briefRows(await mcp.callTool("Render", "query_render_postgres", { postgresId: AGENCY.db, workspaceId: AGENCY.workspace, sql: BRIEF_SQL }));
  } catch (e) {
    const why = {
      server_not_connected: "Connect Render in claude.ai to see briefs here.",
      needs_reauth: "Render needs signing in again in claude.ai.",
      approval_required: "Allow Render for this page to see briefs.",
      not_in_manifest: "This page needs republishing with Render allowed.",
    }[e?.code] || (/suspend|not available|could not connect|timeout/i.test(e?.message || "") ? "The agency database is paused on Render. Briefs show here when it's back on." : "Couldn't read the queue just now.");
    briefState(`<p class="empty">${why}</p>`); return;
  }
  const db = await dbPromise, done = {};
  if (db) try { (await db.collection("approvals").get()).forEach((d) => (done[d.id] = d.data())); } catch {}
  const later = briefLater(), now = Date.now();
  rows = rows.filter((r) => !(later[r.id] > now));
  if (!rows.length) { briefState(`<p class="empty">Nothing waiting. New briefs land here after each factory run.</p>`); return; }
  const open = rows.filter((r) => !done[String(r.id)]).length;
  briefState("", open ? `${open} waiting` : "all approved");
  $("briefs").replaceChildren(...rows.map((r) => briefCard(r, done[String(r.id)])));
}
function briefCard(r, done) {
  const el = document.createElement("article"); el.className = "brief" + (done ? " done" : "");
  const where = [TRADE[r.trade] || r.trade, r.city].filter(Boolean).join(" · ") + (r.kind && r.kind !== "first" ? " · follow-up" : "");
  el.innerHTML = `<div class="bh"><b></b><span></span></div><p class="flaw"></p>
    <details><summary>Read the email</summary><div class="mail"><b></b><span class="body"></span></div></details>
    <div class="ba"></div>`;
  el.querySelector(".bh b").textContent = r.name;
  el.querySelector(".bh span").textContent = where;
  el.querySelector(".flaw").textContent = r.flaw ? `Their site: ${r.flaw}` : "";
  el.querySelector(".mail b").textContent = r.subject;
  el.querySelector(".mail .body").textContent = r.body;
  if (/^https:\/\//.test(r.mockup_url || "")) {
    const a = Object.assign(document.createElement("a"), { href: r.mockup_url, target: "_blank", rel: "noopener", textContent: "See our preview of their site" });
    el.querySelector("details").append(a);
  }
  const acts = el.querySelector(".ba");
  if (done) { acts.innerHTML = `<span class="ok">Approved. Jarvis backend queues it for the next send window.</span>`; return el; }
  const yes = Object.assign(document.createElement("button"), { type: "button", className: "gear primary", textContent: "Approve" });
  const no = Object.assign(document.createElement("button"), { type: "button", className: "gear ghost", textContent: "Later" });
  yes.addEventListener("click", () => approveBrief(r, el));
  no.addEventListener("click", () => { const l = briefLater(); l[r.id] = Date.now() + 864e5; store.set("briefLater", JSON.stringify(l)); el.remove(); });
  acts.append(yes, no);
  return el;
}
async function approveBrief(r, el) {
  const db = await dbPromise;
  if (!db) { say("note", "Approvals only work in the claude.ai copy of Jarvis."); return; }
  el.querySelectorAll("button").forEach((b) => (b.disabled = true));
  const at = new Date().toISOString();
  try {
    await db.doc("approvals/" + r.id).set({ email_id: r.id, shop: r.name, subject: r.subject, decision: "approve", at, filed: false });
    await db.collection("jobs").add({ status: "queued", created: at, updated: at, note: "Sites by TJ",
      ask: `Approve agency draft #${r.id} (${r.name}, "${r.subject}"): POST ${AGENCY.api}/emails/${r.id}/approve with header "Authorization: Bearer $OPERATOR_TOKEN" (cloud environment secret). Report the API's answer (it re-checks the do-not-email list and pre-flight, then gives the send window). Then set approvals/${r.id} filed: true with the result. If OPERATOR_TOKEN isn't set, mark this needs-tj: "Approve it in the agency dashboard (${AGENCY.dash})."` });
  } catch { el.querySelectorAll("button").forEach((b) => (b.disabled = false)); say("note", "Couldn't save that approval. Try again."); return; }
  el.classList.add("done");
  el.querySelector(".ba").innerHTML = `<span class="ok">Approved. Jarvis backend queues it for the next send window.</span>`;
  const left = $("briefs").querySelectorAll(".brief:not(.done)").length;
  $("briefCount").textContent = left ? `${left} waiting` : "all approved";
  const mcp = await mcpPromise; if (mcp) wakeRunner(db, mcp);
}
loaded.then(() => setTimeout(loadBriefs, 1500));
setInterval(() => { if (!document.hidden) loadBriefs(); }, 10 * 60000);
