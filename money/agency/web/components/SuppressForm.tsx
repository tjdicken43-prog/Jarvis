"use client";

import { useState, useTransition } from "react";
import { addSuppression } from "@/lib/actions";

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "live.com", "msn.com", "att.net", "sbcglobal.net", "cox.net"]);

export function SuppressForm() {
  const [kind, setKind] = useState<"email" | "domain">("domain");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [asked, setAsked] = useState(false);
  return (
    <form
      className="row wrapx"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim().toLowerCase();
        if (kind === "domain" && FREE_MAIL.has(v.replace(/^@/, ""))) {
          setErr(`${v} is shared by thousands of shops. Block the one address instead.`);
          return;
        }
        if (!asked) {  // permanent and has no undo, so one look before it lands
          setAsked(true);
          return;
        }
        start(async () => {
          setErr("");
          setAsked(false);
          const r = await addSuppression(kind, value, reason);
          if (r.ok) {
            setValue("");
            setReason("");
          } else setErr(r.error);
        });
      }}
    >
      <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as "email" | "domain")}>
        <option value="domain">Domain</option>
        <option value="email">Email</option>
      </select>
      <input aria-label="Value" placeholder={kind === "domain" ? "example.com" : "name@example.com"} value={value} onChange={(e) => { setValue(e.target.value); setAsked(false); }} />
      <input aria-label="Reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn primary" type="submit" disabled={pending || !value.trim()}>
        {kind === "domain" ? "Block domain" : "Block address"}
      </button>
      {asked && <p className="warn grow">This is permanent: {value.trim()} will never get email from us. Tap again to confirm.</p>}
      {err && <p className="err grow">{err}</p>}
    </form>
  );
}
