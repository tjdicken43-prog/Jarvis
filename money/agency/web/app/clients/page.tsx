import Link from "next/link";
import { api, errMsg } from "@/lib/api";
import { PLAN_NAME, usd } from "@/lib/format";
import type { Client, Clients, Costs } from "@/lib/types";
import { AddClientForm, CheckoutLink, ReceptionistSetup } from "@/components/ClientControls";

export const dynamic = "force-dynamic";

const STATUS: Record<Client["status"], string> = {
  active: "Active",
  past_due: "Past due",
  pending: "Waiting on payment",
  cancelled: "Cancelled",
};
const STRIPE: Record<Clients["stripe"], string> = {
  off: "off (no key)",
  test: "test mode",
  live: "live",
  blocked: "live key refused",
};

function Minutes({ c }: { c: Client }) {
  const pct = Math.min(100, Math.round((c.minutes_used / Math.max(1, c.included_minutes)) * 100));
  return (
    <div className="meter-cell">
      <span className="num">
        {c.minutes_used} / {c.included_minutes}
      </span>
      <span className={c.over_minutes ? "meter over" : "meter"} aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      {c.over_minutes > 0 && (
        <span className="warn small num">
          +{c.over_minutes} min, {usd(c.overage_cents)}
        </span>
      )}
    </div>
  );
}

function pct(n: number | null) {
  return n == null ? "" : `${n}%`;
}

function CostTable({ costs }: { costs: Costs }) {
  const t = costs.totals;
  return (
    <section className="panel tablewrap">
      <table className="stack">
        <thead>
          <tr><th>Business</th><th>Brings in</th><th>Receptionist</th><th>Hosting</th><th>Claude</th><th>Stripe</th><th>Margin</th></tr>
        </thead>
        <tbody>
          {costs.lines.map((l) => (
            <tr key={l.client_id}>
              <td>{l.business_name}<div className="muted small num">{l.minutes} min{l.estimated ? ", some estimated" : ""}</div></td>
              <td data-label="Brings in" className="num">{usd(l.revenue_cents)}</td>
              <td data-label="Receptionist" className="num">{usd(l.receptionist_cents)}</td>
              <td data-label="Hosting" className="num">{usd(l.hosting_cents)}</td>
              <td data-label="Claude" className="num">{usd(l.claude_cents)}</td>
              <td data-label="Stripe" className="num">{usd(l.stripe_cents)}</td>
              <td data-label="Margin" className={l.margin_cents < 0 ? "num warn" : "num"}>
                {usd(l.margin_cents)} <span className="muted">{pct(l.margin_pct)}</span>
              </td>
            </tr>
          ))}
          <tr className="total">
            <td>All clients</td>
            <td data-label="Brings in" className="num">{usd(t.revenue_cents)}</td>
            <td colSpan={4} data-label="Costs" className="num">{usd(t.cost_cents)} in costs</td>
            <td data-label="Margin" className={t.margin_cents < 0 ? "num warn" : "num"}>
              {usd(t.margin_cents)} <span className="muted">{pct(t.margin_pct)}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export default async function ClientsPage() {
  let data: Clients | null = null;
  let error = "";
  try {
    data = await api<Clients>("/clients");
  } catch (e) {
    error = errMsg(e);
  }
  const paying = data?.items.filter((c) => c.status !== "pending") ?? [];
  const pending = data?.items.filter((c) => c.status === "pending") ?? [];

  return (
    <>
      <h1>Clients</h1>
      {error && <p className="err">{error}</p>}
      {data && (
        <>
          <section className="panel">
            <dl className="health">
              <div><dt>Active</dt><dd className="num">{data.summary.active}</dd></div>
              <div><dt>Monthly revenue</dt><dd className="num">{usd(data.summary.mrr_cents)}</dd></div>
              <div><dt>Overage so far</dt><dd className="num">{usd(data.summary.overage_cents)}</dd></div>
              <div><dt>Margin this month</dt><dd className={data.costs.totals.margin_cents < 0 ? "num warn" : "num"}>{data.costs.lines.length ? `${usd(data.costs.totals.margin_cents)} (${pct(data.costs.totals.margin_pct)})` : "None yet"}</dd></div>
              <div><dt>Founding spots left</dt><dd className="num">{data.summary.founding_left} of {data.summary.founding_slots}</dd></div>
              <div><dt>Past due</dt><dd className={data.summary.past_due ? "num warn" : "num"}>{data.summary.past_due}</dd></div>
              <div><dt>Waiting on payment</dt><dd className="num">{data.summary.pending}</dd></div>
              <div><dt>Stripe</dt><dd className={data.stripe === "test" ? "" : "warn"}>{STRIPE[data.stripe]}</dd></div>
            </dl>
          </section>

          <h2 className="section">Active clients <span className="muted small">minutes for {data.month}</span></h2>
          {paying.length === 0 ? (
            <p className="muted">No paying clients yet.</p>
          ) : (
            <section className="panel tablewrap">
              <table className="stack">
                <thead>
                  <tr><th>Business</th><th>Plan</th><th>Pays</th><th>Minutes used</th><th>Calls</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {paying.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/clients/${c.id}`}>{c.business_name}</Link>
                        {c.founding_no && <span className="tag" title="Price locked for as long as they stay">Founding #{c.founding_no}</span>}
                        <div className="muted small">{c.trade}{c.started_at ? `, since ${c.started_at.slice(0, 10)}` : ""}</div>
                      </td>
                      <td data-label="Plan">{PLAN_NAME[c.plan]}</td>
                      <td data-label="Pays" className="num">
                        {usd(c.price_cents)}/{c.billing === "annual" ? "yr" : "mo"}
                      </td>
                      <td data-label="Minutes"><Minutes c={c} /></td>
                      <td data-label="Calls" className="small">
                        <span className="num">{c.calls}</span> ({c.after_hours_calls} after hours, {c.missed_calls} missed)
                        <div className={c.has_receptionist ? "muted" : "warn"}>
                          {c.has_receptionist ? c.receptionist_number || "No number yet" : "Receptionist not set up"}
                        </div>
                      </td>
                      <td data-label="Status" className={c.status === "past_due" ? "warn" : c.status === "cancelled" ? "muted" : ""}>{STATUS[c.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <h2 className="section">What each client costs <span className="muted small">{data.costs.month}, so far</span></h2>
          {data.costs.lines.length === 0 ? (
            <p className="muted">Costs show here once a client is paying. Render alone is {usd(data.costs.hosting_cents_month)} a month.</p>
          ) : (
            <CostTable costs={data.costs} />
          )}
          <p className="muted small note">
            Cold-email drafts this month: {data.costs.outreach.claude_calls} Claude calls, {usd(Math.round(data.costs.outreach.claude_cents))}
            {data.costs.outreach.per_call_cents != null && ` (${data.costs.outreach.per_call_cents.toFixed(2)}¢ each)`}.
            Receptionist uses Vapi&apos;s own cost per call, or an estimate when it sent none. Hosting is the Render bill split across paying clients.
          </p>

          {paying.some((c) => c.status !== "cancelled") && (
            <>
              <h2 className="section">Receptionist <span className="muted small">hours in Central; Front Desk answers outside them, Plus 24/7</span></h2>
              {paying.filter((c) => c.status !== "cancelled").map((c) => (
                <article key={c.id} className="panel">
                  <header className="card-head"><h2>{c.business_name}</h2><Link className="small" href={`/clients/${c.id}`}>Calls, bookings, site</Link></header>
                  <ReceptionistSetup c={c} />
                </article>
              ))}
            </>
          )}

          <h2 className="section">Waiting on payment</h2>
          {pending.length === 0 && <p className="muted">None.</p>}
          {pending.map((c) => (
            <article key={c.id} className="panel">
              <header className="card-head">
                <h2>{c.business_name}</h2>
                <span className="muted">{[c.trade, c.email].join(" / ")}</span>
              </header>
              <CheckoutLink id={c.id} plan={c.plan} billing={c.billing} url={c.checkout_url} stripe={data!.stripe} />
            </article>
          ))}

          <h2 className="section">Add a client</h2>
          <section className="panel">
            <AddClientForm />
            <p className="muted small note">
              Setup {usd(data.setup_cents)}.{" "}
              {Object.values(data.plans).map((p) => `${p.name} ${usd(p.monthly_cents)}/mo (${p.minutes} min)`).join(", ")},{" "}
              {usd(data.overage_cents_per_min)}/min over. Annual pays 10 months for 12. Founding offer: the first{" "}
              {data.summary.founding_slots} to pay keep these prices for as long as they stay ({data.summary.founding_left} left).
            </p>
          </section>
        </>
      )}
    </>
  );
}
