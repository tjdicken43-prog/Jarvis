import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) {
    // Local dev runs open; a deployed dashboard with no password stays locked.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Set DASHBOARD_PASSWORD to open the dashboard.", { status: 503 });
  }
  const h = req.headers.get("authorization") || "";
  if (h.startsWith("Basic ")) {
    try {
      const decoded = atob(h.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === pw) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Operator", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|healthz).*)"] };
