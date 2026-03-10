import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // allow login route + next internals
  if (p.startsWith("/login") || p.startsWith("/_next") || p.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // simple client-cookie gate (set after admin check)
  const ok = req.cookies.get("admin_ok")?.value === "1";
  if (!ok) return NextResponse.redirect(new URL("/login", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api).*)"],
};
