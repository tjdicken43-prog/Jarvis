import { api, errMsg } from "@/lib/api";
import { usd } from "@/lib/format";
import type { Leads } from "@/lib/types";

export const dynamic = "force-dynamic";

const URGENCY: Record<string, string> = { emergency: "Emergency", this_week: "This week", flexible: "Flexible" };

export default async function LeadsPage() {
  let data: Leads | null = null;
  let error = "";
  try {
    data = await api<Leads>("/leads");
  } catch (e) {
    error = errMsg(e);
  }
  return (
    <>
      <h1>Matchmaking leads</h1>
      <p className="flaw">
        Display only. Nothing gets matched or charged until the Arkansas license question is checked.
      </p>
      {error && <p className="err">{error}</p>}
      {data && data.items.length === 0 && <p className="muted">No leads yet.</p>}
      {data && data.items.length > 0 && (
        <section className="panel tablewrap">
          <table className="stack">
            <thead>
              <tr><th>Job</th><th>Date</th><th>Zip</th><th>When</th><th>Status</th><th>Matched to</th><th>Job value</th><th>15%</th></tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.job_description}
                    <div className="muted small">{l.trade}, {l.customer_name}</div>
                  </td>
                  <td data-label="Date" className="num">{l.created_at.slice(0, 10)}</td>
                  <td data-label="Zip" className="num">{l.zip}</td>
                  <td data-label="When" className={l.urgency === "emergency" ? "warn" : ""}>{l.urgency ? URGENCY[l.urgency] : ""}</td>
                  <td data-label="Status">{l.status}</td>
                  <td data-label="Matched to">{l.matched_to ?? <span className="muted">none</span>}</td>
                  <td data-label="Job value" className="num">{usd(l.job_value_cents)}</td>
                  <td data-label="15%" className="num">{usd(l.commission_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
