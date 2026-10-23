// Render's health check: open (no password), says only that the dashboard is up.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
