import Link from "next/link";
import { api, errMsg } from "@/lib/api";
import type { Correction, LogEvent, Stats } from "@/lib/types";
import { StoppedSteps } from "@/components/QualityControls";
import { SKIP_REASONS } from "@/lib/reasons";

export const dynamic = "force-dynamic";

const STEP: Record<string, string> = {
  flaw: "Site check", mockup: "Preview", draft: "Draft", approve: "Approve", skip: "Skip", edit: "Edit", send: "Send",
  inbox: "Inbox", stripe: "Payment", overage: "Overage", receptionist: "Receptionist", golive: "Go-live",
  call_review: "Call check", client: "Client", breaker: "Stop switch",
};
const REASON = Object.fromEntries(SKIP_REASONS);
const central = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function LogPage({ searchParams }: { searchParams: Promise<{ failed?: string; step?: string }> }) {
  const sp = await searchParams;
  const failed = sp.failed === "1";
  const step = sp.step && STEP[sp.step] ? sp.step : "";
  let error = "";
  let items: LogEvent[] = [], fixes: Correction[] = [], stopped: string[] = [];
  let day: Record<string, { ok: number; failed: number }> = {};
  let stats: Stats | null = null;
  try {
    const q = new URLSearchParams({ limit: "150", ...(failed ? { failed: "true" } : {}), ...(step ? { step } : {}) });
    const [ev, cs, st] = await Promise.all([
      api<{ items: LogEvent[]; last_24h: typeof day; stopped_steps: string[] }>(`/events?${q}`),
      api<{ items: Correction[] }>("/corrections"),
      api<Stats>("/stats"),
    ]);
    [items, day, stopped, fixes, stats] = [ev.items, ev.last_24h, ev.stopped_steps, cs.items, st];
  } catch (e) {
    error = errMsg(e);
  }
  const steps = Object.entries(day);
  const asDrafted = stats?.approved_as_drafted_pct;
  return (
    <>
      <h1>Log <span className="muted">every step, every shop, why it passed or stopped</span></h1>
      {error && <p className="err">{error}</p>}
      <StoppedSteps steps={stopped} />

      <section className="panel">
        <dl className="health">
          <div>
            <dt>Approved as drafted</dt>
            <dd className="num">{asDrafted == null ? "No approvals yet" : `${asDrafted}%`}</dd>
          </div>
          {steps.map(([k, v]) => (
            <div key={k}>
              <dt>{STEP[k] ?? k}, 24h</dt>
              <dd className="num">
                {v.ok} ok{v.failed > 0 && <span className="bad">, {v.failed} failed</span>}
              </dd>
            </div>
          ))}
        </dl>
        {stats?.skip_reasons && Object.keys(stats.skip_reasons).length > 0 && (
          <p className="muted small">
            Skips: {Object.entries(stats.skip_reasons).map(([k, n]) => `${REASON[k] ?? k} ${n}`).join(", ")}
          </p>
        )}
      </section>

      <div className="tabs" role="tablist">
        <Link href="/log" className={!failed && !step ? "tab on" : "tab"}>Everything</Link>
        <Link href="/log?failed=1" className={failed ? "tab on" : "tab"}>Failures</Link>
        {["send", "draft", "approve", "inbox"].map((k) => (
          <Link key={k} href={`/log?step=${k}`} className={step === k ? "tab on" : "tab"}>{STEP[k]}</Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <section className="panel tablewrap">
          <table className="stack">
            <thead><tr><th>When</th><th>Step</th><th>What happened</th><th>Shop</th></tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className={e.ok ? "" : "failrow"}>
                  <td className="small num">{central(e.at)}</td>
                  <td data-label="Step">{STEP[e.step] ?? e.step}</td>
                  <td data-label="What happened" className="small">{e.reason || (e.ok ? "ok" : "failed")}</td>
                  <td data-label="Shop" className="small muted">
                    {e.email_id ? <Link href={`/queue/${e.email_id}`}>{e.prospect_id}</Link> : e.client_id ? <Link href={`/clients/${e.client_id}`}>Client {e.client_id}</Link> : e.prospect_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <h2 className="section">Your corrections <span className="muted small">each one becomes a test the factory has to pass</span></h2>
      {fixes.length === 0 ? (
        <p className="muted">None yet. Skips and edits on the Queue show up here.</p>
      ) : (
        fixes.slice(0, 30).map((f) => (
          <details key={f.id} className="panel">
            <summary>
              {f.kind === "skip" ? `Skipped: ${REASON[f.reason] ?? f.reason}` : "Edited"}
              <span className="muted small"> {f.prospect_id}, {central(f.created_at)}{f.frozen ? ", in the test set" : ""}</span>
            </summary>
            {f.note && <p className="small">{f.note}</p>}
            {f.flaw && <p className="muted small">Flaw at the time: {f.flaw}</p>}
            {f.after_body ? (
              <div className="diff">
                <div><p className="muted small">Before</p><p className="body small">{f.before_body}</p></div>
                <div><p className="muted small">After</p><p className="body small">{f.after_body}</p></div>
              </div>
            ) : (
              f.before_body && <p className="body small">{f.before_body}</p>
            )}
          </details>
        ))
      )}
    </>
  );
}
