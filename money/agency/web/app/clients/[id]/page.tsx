import Link from "next/link";
import { api, ApiError, errMsg } from "@/lib/api";
import { PLAN_NAME } from "@/lib/format";
import type { Booking, Call, Client, Notice, ReviewCall, ReviewRequest, SiteRequest } from "@/lib/types";
import { BookingActions, BookingSetup, OwnerSettings, ReviewAskForm, SitePublish } from "@/components/FrontDeskControls";
import { ReceptionistSetup } from "@/components/ClientControls";
import { CallReviewList, GoLiveChecklist } from "@/components/QualityControls";

export const dynamic = "force-dynamic";

const central = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", ...opts });
const phone = (d: string | null) => (d && d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d || "");
const OUTCOME: Record<string, string> = { booked: "Booked", message: "Message", spam: "Spam", hung_up: "Hung up" };
const SENT: Record<string, string> = { stub: "saved (not sent)", sent: "sent", failed: "failed", queued: "queued", skipped: "skipped" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = encodeURIComponent(id);
  let error = "";
  let c: Client | undefined;
  let calls: Call[] = [], bookings: Booking[] = [], notices: Notice[] = [], reviews: ReviewRequest[] = [], forms: SiteRequest[] = [];
  let mode = "stub";
  let toReview: ReviewCall[] = [];
  try {
    const [all, cl, bk, nt, rv, fr] = await Promise.all([
      api<{ items: Client[] }>("/clients"),
      api<{ items: Call[] }>(`/clients/${cid}/calls`),
      api<{ items: Booking[] }>(`/clients/${cid}/bookings`),
      api<{ items: Notice[]; mode: string }>(`/clients/${cid}/notices`),
      api<{ items: ReviewRequest[] }>(`/clients/${cid}/review-requests`),
      api<{ items: SiteRequest[] }>(`/clients/${cid}/requests`),
    ]);
    toReview = (await api<{ items: ReviewCall[] }>("/calls/to-review").catch(() => ({ items: [] as ReviewCall[] }))).items
      .filter((r) => String(r.client_id) === id);
    c = all.items.find((x) => String(x.id) === id);
    [calls, bookings, notices, reviews, forms, mode] = [cl.items, bk.items, nt.items, rv.items, fr.items, nt.mode];
  } catch (e) {
    error = e instanceof ApiError && e.status === 404 ? "Client not found" : errMsg(e);
  }
  if (!c) {
    return (
      <>
        <p className="err">{error || "Client not found"}</p>
        <Link className="btn" href="/clients">Back</Link>
      </>
    );
  }
  const plus = c.plan === "front_desk_plus";
  const upcoming = bookings.filter((b) => b.status === "booked").reverse();
  return (
    <>
      <h1>{c.business_name} <span className="muted">{PLAN_NAME[c.plan]} / {c.trade}</span></h1>
      <p className="muted small">
        <Link href="/clients">All clients</Link>. Owner emails {mode === "smtp" ? "are on" : "are saved here and not sent yet"}. Texts stay off until a texting provider is registered.
      </p>

      <h2 className="section">Receptionist</h2>
      <section className="panel"><ReceptionistSetup c={c} /></section>

      <h2 className="section">Go live <span className="muted small">every box ticked before the shop counts on it</span></h2>
      <section className="panel"><GoLiveChecklist c={c} /></section>

      {c.live_at && (
        <>
          <h2 className="section">Listen to these <span className="muted small">up to 3 calls a week, first month live</span></h2>
          <section className="panel"><CallReviewList calls={toReview} /></section>
        </>
      )}

      <h2 className="section">Owner emails <span className="muted small">urgent calls at once, website requests at once, a summary every morning</span></h2>
      <section className="panel"><OwnerSettings c={c} /></section>

      <h2 className="section">Calls <span className="muted small">newest first, what the caller told the assistant</span></h2>
      {calls.length === 0 ? <p className="muted">No calls yet.</p> : (
        <section className="panel tablewrap">
          <table className="stack">
            <thead><tr><th>When</th><th>Caller</th><th>What&apos;s wrong</th><th>Outcome</th></tr></thead>
            <tbody>
              {calls.map((r) => (
                <tr key={r.id}>
                  <td className="small">{central(r.started_at)}<div className="muted">{Math.max(1, Math.round(r.seconds / 60))} min{r.after_hours ? ", after hours" : ""}</div></td>
                  <td data-label="Caller"><div>{r.caller_name || <span className="muted">No name</span>}{r.town ? `, ${r.town}` : ""}<div className="small num">{phone(r.callback_number || r.caller_number)}</div></div></td>
                  <td data-label="Problem" className="small">{r.problem || r.summary || <span className="muted">None given</span>}</td>
                  <td data-label="Outcome" className={r.emergency ? "warn" : ""}>
                    {r.emergency ? "Urgent" : OUTCOME[r.outcome ?? ""] ?? ""}
                    {r.textback && <div className="muted small">text-back {SENT[r.textback] ?? r.textback}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <h2 className="section">Booking <span className="muted small">visit windows the receptionist can book</span></h2>
      <section className="panel"><BookingSetup c={c} /></section>
      {plus && bookings.length > 0 && (
        <section className="panel tablewrap">
          <table className="stack">
            <thead><tr><th>Window</th><th>Customer</th><th>Job</th><th></th></tr></thead>
            <tbody>
              {[...upcoming, ...bookings.filter((b) => b.status !== "booked")].map((b) => (
                <tr key={b.id}>
                  <td className="small">{central(b.window_start)} to {central(b.window_end, { hour: "numeric" })}</td>
                  <td data-label="Customer"><div>{b.customer_name}<div className="small num">{phone(b.callback_number)}{b.ok_to_text ? ", texts OK" : ""}</div>{b.address && <div className="muted small">{b.address}</div>}</div></td>
                  <td data-label="Job" className="small">{b.problem}</td>
                  <td><BookingActions b={b} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {plus && (
        <>
          <h2 className="section">Review asks <span className="muted small">one per customer, everyone asked the same way</span></h2>
          <section className="panel">
            <ReviewAskForm id={c.id} />
            {reviews.length > 0 && (
              <ul className="small note">
                {reviews.map((r) => (
                  <li key={r.id}>{r.customer_name} by {r.channel}: {SENT[r.status] ?? r.status}{r.detail && (r.status === "skipped" || r.status === "failed") ? ` (${r.detail})` : ""}, {central(r.sent_at || r.send_after)}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <h2 className="section">Website <span className="muted small">live site and its call-back requests</span></h2>
      <section className="panel">
        <SitePublish c={c} />
        {forms.length > 0 && (
          <ul className="small note">
            {forms.map((f) => (
              <li key={f.id}>{central(f.created_at)}: {f.name}{f.town ? `, ${f.town}` : ""}, {phone(f.phone)}. {f.job}{f.photos ? `, ${f.photos} photo${f.photos > 1 ? "s" : ""}` : ""}</li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="section">Emails to the owner</h2>
      {notices.length === 0 ? <p className="muted">None yet.</p> : notices.slice(0, 10).map((n) => (
        <details key={n.id} className="panel">
          <summary>{n.subject} <span className="muted small">{central(n.created_at)}, {SENT[n.status] ?? n.status}{n.error ? `: ${n.error}` : ""}</span></summary>
          <pre className="body small">{n.body}</pre>
        </details>
      ))}
    </>
  );
}
