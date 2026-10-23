import Link from "next/link";
import { api, ApiError, errMsg } from "@/lib/api";
import type { Item } from "@/lib/types";
import { EditForm } from "@/components/QueueControls";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item: Item | null = null;
  let error = "";
  try {
    item = await api<Item>(`/emails/${encodeURIComponent(id)}`);
  } catch (e) {
    error = e instanceof ApiError && e.status === 404 ? "Email not found" : errMsg(e);
  }
  if (!item) {
    return (
      <>
        <p className="err">{error}</p>
        <Link className="btn" href="/queue">Back</Link>
      </>
    );
  }
  const { email, prospect: p, footer } = item;
  return (
    <section className="panel">
      <h1>{p.name} <span className="muted">{[p.trade, p.city].filter(Boolean).join(" / ")}</span></h1>
      <EditForm id={email.id} subject={email.subject} body={email.body} editable={email.status === "draft"} />
      <p className="footer">{footer}</p>
    </section>
  );
}
