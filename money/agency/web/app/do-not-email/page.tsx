import { api, errMsg } from "@/lib/api";
import type { Suppression } from "@/lib/types";
import { SuppressForm } from "@/components/SuppressForm";

export const dynamic = "force-dynamic";

export default async function DoNotEmail() {
  let items: Suppression[] = [];
  let error = "";
  try {
    ({ items } = await api<{ items: Suppression[] }>("/suppressions"));
  } catch (e) {
    error = errMsg(e);
  }
  return (
    <>
      <h1>Do not email</h1>
      <section className="panel"><SuppressForm /></section>
      {error && <p className="err">{error}</p>}
      {!error && items.length === 0 && <p className="muted">Empty.</p>}
      {items.length > 0 && (
        <section className="panel tablewrap">
          <table>
            <thead><tr><th>Email / domain</th><th>Reason</th><th>Added</th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={String(s.id)}>
                  <td>{s.email || s.domain}</td>
                  <td>{s.reason}</td>
                  <td className="num">{(s.created_at || "").slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
