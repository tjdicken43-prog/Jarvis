import { api, errMsg } from "@/lib/api";
import { PLAN_NAME, usd } from "@/lib/format";
import type { Client, Clients } from "@/lib/types";
import { AddClientForm, CheckoutLink } from "@/components/ClientControls";

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
                  <tr><th>Business</th><th>Plan</th><th>Pays</th><th>Minutes used</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {paying.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.business_name}
                        <div className="muted small">{c.trade}{c.started_at ? `, since ${c.started_at.slice(0, 10)}` : ""}</div>
                      </td>
                      <td data-label="Plan">{PLAN_NAME[c.plan]}</td>
                      <td data-label="Pays" className="num">
                        {usd(c.price_cents)}/{c.billing === "annual" ? "yr" : "mo"}
                      </td>
                      <td data-label="Minutes"><Minutes c={c} /></td>
                      <td data-label="Status" className={c.status === "past_due" ? "warn" : c.status === "cancelled" ? "muted" : ""}>{STATUS[c.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
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
              {usd(data.overage_cents_per_min)}/min over. Annual pays 10 months for 12.
            </p>
          </section>
        </>
      )}
    </>
  );
}
