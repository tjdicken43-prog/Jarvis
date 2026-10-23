export type Email = {
  id: number | string;
  kind: string;
  subject: string;
  body: string;
  status: string;
  edited: boolean;
  created_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
  send_after: string | null;
};
export type Prospect = {
  id: number | string;
  name: string;
  trade: string;
  city: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  site_state: string | null;
  flaw: string | null;
  flaw_evidence: string | null;
  mockup_url: string | null;
};
export type Item = { email: Email; prospect: Prospect; footer: string };
export type Health = {
  ok: boolean;
  db: boolean;
  drafter: string;
  mailer: string;
  mailing_address_set: boolean;
  sent_today: number;
  daily_cap: number;
  paused: boolean;
  send_window: string;
  in_window: boolean;
};
export type Stats = {
  prospects: Record<string, number>;
  emails: Record<string, number>;
  suppressions: number;
};
export type DraftResult = {
  created: { email_id: number | string; prospect_id: number | string; name: string }[];
  skipped: { prospect_id: number | string; name: string; reason: string }[];
};
export type ApproveResult = { item: Item; queued: boolean; sent?: boolean; dry_run?: boolean; detail: string };
export type SendResult = { sent: number; dry_run: boolean; held: { email_id: number | string; reason: string }[]; detail?: string };
export type Suppression = { id: number | string; email: string | null; domain: string | null; reason: string; created_at: string };
