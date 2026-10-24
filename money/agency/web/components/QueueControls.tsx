"use client";

import { useState, useTransition } from "react";
import { approve, draftNew, markBounced, markReplied, saveEmail, sendApproved, setPaused, unapprove } from "@/lib/actions";
import { ConfirmButton, RedraftButton, SkipPicker } from "./QualityControls";
import type { DraftResult, SendResult } from "@/lib/types";
import Link from "next/link";

export function DraftButton() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<DraftResult | null>(null);
  const [err, setErr] = useState("");
  return (
    <div>
      <button
        className="btn primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await draftNew();
            if (r.ok) setRes(r.data);
            else setErr(r.error);
          })
        }
      >
        {pending ? "Checking sites and building previews..." : "Find flaws and draft"}
      </button>
      {err && <p className="err">{err}</p>}
      {res && (
        <div className="note">
          <p>
            Checked <b className="num">{res.checked?.length ?? 0}</b>, previews <b className="num">{res.built?.length ?? 0}</b>,
            drafted <b className="num">{res.created.length}</b>, held <b className="num">{res.skipped.length}</b>
          </p>
          {res.skipped.length > 0 && (
            <ul>
              {res.skipped.map((s) => (
                <li key={String(s.prospect_id)}>
                  {s.name}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function SendButton() {
  const [res, setRes] = useState<SendResult | null>(null);
  const [err, setErr] = useState("");
  return (
    <div>
      <ConfirmButton
        primary
        label="Send approved"
        confirm="Send everything approved and due, right now?"
        onConfirm={async () => {
          setErr("");
          const r = await sendApproved();
          if (r.ok) setRes(r.data);
          return r.ok ? { ok: true } : r;
        }}
      />
      {err && <p className="err">{err}</p>}
      {res && (
        <div className="note">
          <p>
            {res.detail ? res.detail + " " : res.dry_run ? "Dry run, nothing sent. " : ""}Sent <b className="num">{res.sent}</b>, held{" "}
            <b className="num">{res.held.length}</b>
          </p>
          {res.held.length > 0 && (
            <ul>
              {res.held.map((h) => (
                <li key={String(h.email_id)}>
                  #{h.email_id}: {h.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CardActions({ id }: { id: string | number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [skipping, setSkipping] = useState(false);
  if (done) return <p className="note" role="status">{msg}</p>;
  return (
    <div>
      <div className="row">
        <button
          className="btn primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr("");
              const r = await approve(id);
              if (r.ok) {
                setMsg(r.data.detail || (r.data.queued ? "Queued for the send window" : "Approved"));
                setDone(true);
              }
              else setErr(r.error);
            })
          }
        >
          Approve &amp; send
        </button>
        <Link className="btn" href={`/queue/${id}`}>Edit</Link>
        <RedraftButton id={id} />
        <button className="btn" disabled={pending} onClick={() => setSkipping(true)}>
          Skip
        </button>
      </div>
      {skipping && <SkipPicker id={id} onClose={() => setSkipping(false)} />}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export function EditForm({ id, subject, body, editable }: { id: string | number; subject: string; body: string; editable: boolean }) {
  const [s, setS] = useState(subject);
  const [b, setB] = useState(body);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setErr("");
          setMsg("");
          const r = await saveEmail(id, s, b);
          if (r.ok) setMsg("Saved");
          else setErr(r.error);
        });
      }}
    >
      <label htmlFor="subject">Subject</label>
      <input id="subject" value={s} onChange={(e) => setS(e.target.value)} disabled={!editable} />
      <label htmlFor="body">Body</label>
      <textarea id="body" rows={10} value={b} onChange={(e) => setB(e.target.value)} disabled={!editable} />
      <div className="row">
        <button className="btn primary" type="submit" disabled={pending || !editable}>Save</button>
        <Link className="btn" href="/queue">Back</Link>
      </div>
      {!editable && <p className="muted">Only drafts can be edited.</p>}
      {msg && <p className="note" role="status">{msg}</p>}
      {err && <p className="err">{err}</p>}
    </form>
  );
}

export function PauseToggle({ paused }: { paused: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  if (paused)  // resuming is the last tap before real mail goes out, so it asks once
    return (
      <div>
        <ConfirmButton
          primary
          label="Sending paused. Resume"
          confirm="Resume sending? Approved emails go out in the next window."
          onConfirm={async () => {
            const r = await setPaused(false);
            return r.ok ? { ok: true } : r;
          }}
        />
      </div>
    );
  return (
    <div>
      <button
        className="btn"
        disabled={pending}
        aria-pressed={false}
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await setPaused(true);
            if (!r.ok) setErr(r.error);
          })
        }
      >
        Pause all sending
      </button>
      {err && <span className="err"> {err}</span>}
    </div>
  );
}

export function UndoButton({ id }: { id: string | number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="row">
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await unapprove(id);
            if (!r.ok) setErr(r.error);
          })
        }
      >
        Undo
      </button>
      {err && <span className="err">{err}</span>}
    </div>
  );
}

export function SentActions({ prospectId }: { prospectId: string | number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const act = (fn: typeof markReplied) =>
    start(async () => {
      setErr("");
      const r = await fn(prospectId);
      if (!r.ok) setErr(r.error);
    });
  return (
    <div className="row">
      <button className="btn" disabled={pending} onClick={() => act(markReplied)}>They replied</button>
      <ConfirmButton
        label="Bounced"
        confirm="Never email this address again?"
        onConfirm={async () => {
          const r = await markBounced(prospectId);
          return r.ok ? { ok: true } : r;
        }}
      />
      {err && <span className="err">{err}</span>}
    </div>
  );
}
