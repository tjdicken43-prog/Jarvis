"use client";

import { useState, useTransition } from "react";
import { askForReview, publishSite, saveBooking, saveOwner, setBooking } from "@/lib/actions";
import type { Booking, Client } from "@/lib/types";

const hourName = (h: number) => (h === 0 || h === 24 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`);

function Status({ msg, err }: { msg: string; err: string }) {
  return (
    <>
      {msg && <p className="muted small grow">{msg}</p>}
      {err && <p className="err grow">{err}</p>}
    </>
  );
}

export function OwnerSettings({ c }: { c: Client }) {
  const [email, setEmail] = useState(c.notify_email ?? "");
  const [hour, setHour] = useState(c.summary_hour);
  const [review, setReview] = useState(c.review_url ?? "");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="row wrapx">
      <input aria-label="Owner email" type="email" placeholder={`Summaries to ${c.email}`} value={email} onChange={(e) => setEmail(e.target.value)} />
      <select aria-label="Morning summary" value={hour} onChange={(e) => setHour(+e.target.value)}>
        {[4, 5, 6, 7, 8, 9, 10, 11].map((h) => <option key={h} value={h}>Summary at {hourName(h)}</option>)}
      </select>
      {c.plan === "front_desk_plus" && (
        <input aria-label="Google review link" placeholder="Google review link (https://g.page/r/...)" value={review} onChange={(e) => setReview(e.target.value)} />
      )}
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            setMsg("");
            const r = await saveOwner(c.id, { notify_email: email, summary_hour: hour, review_url: review });
            if (r.ok) setMsg("Saved.");
            else setErr(r.error);
          })
        }
      >
        {pending ? "Saving..." : "Save"}
      </button>
      <Status msg={msg} err={err} />
    </div>
  );
}

const WINDOW_STARTS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

export function BookingSetup({ c }: { c: Client }) {
  const b = c.booking;
  const [on, setOn] = useState(!!b);
  const [windows, setWindows] = useState<number[]>(b?.windows ?? [8, 10, 13, 15]);
  const [length, setLength] = useState(b?.length ?? 2);
  const [per, setPer] = useState(b?.per_window ?? 1);
  const [lead, setLead] = useState(b?.lead_hours ?? 3);
  const [cal, setCal] = useState(c.calendar_url);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  if (c.plan !== "front_desk_plus") return <p className="muted small">Calendar booking and review asks come with Front Desk Plus.</p>;
  const toggle = (h: number) => setWindows(windows.includes(h) ? windows.filter((x) => x !== h) : [...windows, h].sort((a, z) => a - z));
  return (
    <>
      <div className="row wrapx">
        <label className="small"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Book visits on calls</label>
        {on && (
          <>
            <select aria-label="Window length" value={length} onChange={(e) => setLength(+e.target.value)}>
              {[1, 2, 3, 4].map((h) => <option key={h} value={h}>{h} hour windows</option>)}
            </select>
            <select aria-label="Jobs per window" value={per} onChange={(e) => setPer(+e.target.value)}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} job{n > 1 ? "s" : ""} per window</option>)}
            </select>
            <select aria-label="Soonest" value={lead} onChange={(e) => setLead(+e.target.value)}>
              {[1, 2, 3, 6, 12, 24].map((n) => <option key={n} value={n}>Soonest: {n}h out</option>)}
            </select>
          </>
        )}
        <button
          className="btn"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr("");
              setMsg("");
              const r = await saveBooking(c.id, on ? { enabled: true, windows, length, per_window: per, lead_hours: lead } : { enabled: false });
              if (r.ok) {
                setCal(r.data.calendar_url);
                setMsg(r.data.mode === "vapi" ? "Saved, and the receptionist was updated." : "Saved. Dry run until VAPI_API_KEY is on Render.");
              } else setErr(r.error);
            })
          }
        >
          {pending ? "Saving..." : "Save booking"}
        </button>
        <Status msg={msg} err={err} />
      </div>
      {on && (
        <div className="row wrapx" style={{ marginTop: 8 }} role="group" aria-label="Window start times">
          <span className="muted small">Windows start at</span>
          {WINDOW_STARTS.filter((h) => h >= c.open_hour && h + length <= c.close_hour).map((h) => (
            <label key={h} className="small"><input type="checkbox" checked={windows.includes(h)} onChange={() => toggle(h)} /> {hourName(h)}</label>
          ))}
        </div>
      )}
      {cal && (
        <p className="small note">
          Owner&apos;s calendar feed (Google Calendar: Other calendars, From URL. iPhone: Settings, Calendar, Add subscribed calendar):{" "}
          <code>{cal}</code>
        </p>
      )}
    </>
  );
}

export function SitePublish({ c }: { c: Client }) {
  const [domain, setDomain] = useState("");
  const [url, setUrl] = useState(c.site_url);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const live = !!url && !url.includes("/m/");
  return (
    <div className="row wrapx">
      {url && <a className="small" href={url} target="_blank" rel="noreferrer">{live ? "Live site" : "Preview"}: {url}</a>}
      <input aria-label="Their domain" placeholder="theirshop.com (optional)" value={domain} onChange={(e) => setDomain(e.target.value)} />
      <button
        className="btn"
        disabled={pending || !c.prospect_id}
        title={c.prospect_id ? undefined : "Add the client from a prospect to build their site"}
        onClick={() =>
          start(async () => {
            setErr("");
            setMsg("");
            const r = await publishSite(c.id, domain);
            if (r.ok) {
              setUrl(r.data.url);
              setMsg(domain ? "Published. Add the domain to agency-api on Render, then the shop points a CNAME at it." : "Published.");
            } else setErr(r.error);
          })
        }
      >
        {pending ? "Publishing..." : live ? "Rebuild live site" : "Publish live site"}
      </button>
      <Status msg={msg} err={err} />
    </div>
  );
}

export function BookingActions({ b }: { b: Booking }) {
  const [email, setEmail] = useState(b.customer_email ?? "");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const act = (status: string) =>
    start(async () => {
      setErr("");
      setMsg("");
      const r = await setBooking(b.id, status, email);
      if (!r.ok) return setErr(r.error);
      const rv = r.data.review;
      setMsg(rv ? (rv.queued ? `Review ask queued (${rv.channel}).` : `No review ask: ${rv.reason}.`) : "Saved.");
    });
  const review: Record<string, string> = { queued: "review ask queued", stub: "review ask saved (not sent)", sent: "review ask sent", skipped: "no review ask", failed: "review ask failed" };
  if (b.status !== "booked") return <span className="muted small">{b.status === "done" ? `Done${b.review ? `, ${review[b.review] ?? b.review}` : ""}` : "Cancelled"}</span>;
  return (
    <div className="row wrapx">
      <input aria-label="Customer email" type="email" placeholder="Their email, for the review ask" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn primary" disabled={pending} onClick={() => act("done")}>Job done</button>
      <button className="btn" disabled={pending} onClick={() => act("cancelled")}>Cancel</button>
      <Status msg={msg} err={err} />
    </div>
  );
}

export function ReviewAskForm({ id }: { id: number }) {
  const [f, setF] = useState({ customer_name: "", email: "", phone: "" });
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="row wrapx"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setErr("");
          setMsg("");
          const r = await askForReview(id, { customer_name: f.customer_name, email: f.email.trim() || undefined, phone: f.phone.trim() || undefined, ok_to_text: ok });
          if (r.ok) {
            setF({ customer_name: "", email: "", phone: "" });
            setMsg("Queued. It goes out 2 hours from now, between 10am and 7pm.");
          } else setErr(r.error);
        });
      }}
    >
      <input aria-label="Customer name" placeholder="Customer name" value={f.customer_name} onChange={set("customer_name")} required />
      <input aria-label="Customer email" type="email" placeholder="Email" value={f.email} onChange={set("email")} />
      <input aria-label="Customer phone" placeholder="Phone" value={f.phone} onChange={set("phone")} />
      <label className="small"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> They said yes to texts</label>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Queueing..." : "Ask for a review"}</button>
      <Status msg={msg} err={err} />
    </form>
  );
}
