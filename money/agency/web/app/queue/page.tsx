import Link from "next/link";
import { api, errMsg } from "@/lib/api";
import type { Health, Item } from "@/lib/types";
import { CardActions, DraftButton, PauseToggle, SendButton, UndoButton } from "@/components/QueueControls";

export const dynamic = "force-dynamic";

const TABS = [
  ["draft", "Draft"],
  ["approved", "Approved"],
  ["sent", "Sent"],
  ["cancelled", "Skipped"],
] as const;

function when(s: string | null) {
  return s ? s.replace("T", " ").slice(0, 16) : "";
}

function safeUrl(u: string | null) {
  return u && /^https?:\/\//i.test(u) ? u : null;
}

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = TABS.some((t) => t[0] === sp.status) ? (sp.status as string) : "draft";
  let health: Health | null = null;
  let items: Item[] = [];
  let error = "";
  try {
    [health, { items }] = await Promise.all([
      api<Health>("/health").catch(() => null),
      api<{ items: Item[] }>(`/queue?status=${status}`),
    ]);
  } catch (e) {
    error = errMsg(e);
  }

  return (
    <>
      <section className="panel strip">
        {health ? (
          <dl className="health">
            <div><dt>Drafter</dt><dd>{health.drafter}</dd></div>
            <div><dt>Mailer</dt><dd>{health.mailer}</dd></div>
            <div><dt>Sent today</dt><dd className="num">{health.sent_today}/{health.daily_cap}</dd></div>
            <div><dt>Window</dt><dd>{health.send_window}{health.in_window ? " (open)" : " (closed)"}</dd></div>
            {!health.db && <div><dt>Database</dt><dd className="warn">down</dd></div>}
          </dl>
        ) : (
          <p className="warn">API health unavailable</p>
        )}
        {health && !health.mailing_address_set && <p className="warn">Mailing address missing. Set it before sending.</p>}
        <div className="row">
          {health && <PauseToggle paused={health.paused} />}
          <DraftButton />
        </div>
      </section>

      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/queue?status=${k}`} className={k === status ? "tab on" : "tab"} aria-current={k === status ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </div>

      {status === "approved" && items.length > 0 && (
        <section className="panel"><SendButton /></section>
      )}

      {error && <p className="err">{error}</p>}
      {!error && items.length === 0 && <p className="muted">Nothing here.</p>}

      {items.map(({ email, prospect: p, footer }) => {
        const site = safeUrl(p.website);
        const evid = safeUrl(p.flaw_evidence);
        const mock = safeUrl(p.mockup_url);
        return (
          <article key={String(email.id)} className="panel card">
            <header className="card-head">
              <h2>{p.name}</h2>
              <span className="muted">{[p.trade, p.city].filter(Boolean).join(" / ")}</span>
            </header>
            <ul className="facts">
              {p.rating != null && <li><span className="num">{p.rating}</span> stars, <span className="num">{p.review_count ?? 0}</span> reviews</li>}
              {p.phone && <li>{p.phone}</li>}
              {p.email && <li>{p.email}</li>}
              {p.website && <li>{site ? <a href={site} target="_blank" rel="noreferrer">{p.website}</a> : p.website}</li>}
              {p.site_state && <li>Site: {p.site_state}</li>}
            </ul>
            {(p.flaw || p.flaw_evidence || mock) && (
              <p className="flaw">
                {p.flaw && <span>Flaw: {p.flaw}. </span>}
                {p.flaw_evidence && (evid ? <a href={evid} target="_blank" rel="noreferrer">Evidence</a> : <span className="muted">{p.flaw_evidence}</span>)}
                {mock && <> <a href={mock} target="_blank" rel="noreferrer">Mockup</a></>}
              </p>
            )}
            {evid && /\/shots\/[^/]+\.png$/.test(evid) && (
              <a href={evid} target="_blank" rel="noreferrer" className="shot">
                <img src={evid} alt={`${p.name} site on a phone, first screen`} width={130} height={281} loading="lazy" />
              </a>
            )}
            <div className="mail">
              <p className="subj">{email.subject}{email.edited && <span className="tag">edited</span>}</p>
              <p className="body">{email.body}</p>
              <p className="footer">{footer}</p>
            </div>
            {status === "draft" ? (
              <CardActions id={email.id} />
            ) : status === "approved" ? (
              <div className="row">
                <UndoButton id={email.id} />
                <span className="muted small">queued {when(email.approved_at)}</span>
              </div>
            ) : (
              <p className="muted small">
                {status}{email.sent_at ? ` ${when(email.sent_at)}` : email.approved_at ? ` ${when(email.approved_at)}` : ""}
              </p>
            )}
          </article>
        );
      })}
    </>
  );
}
