import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appDomain, isLocalHost, redirectDomains } from "@/lib/catalog/domain";

export function proxy(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? "";
  const host = hostHeader.split(":")[0]?.toLowerCase();
  const originSecret = process.env.ORIGIN_VERIFY_SECRET;

  if (
    originSecret &&
    host &&
    !isLocalHost(host) &&
    request.headers.get("x-origin-verify") !== originSecret
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const canonical = appDomain().toLowerCase();
  const aliases = redirectDomains();

  if (
    host &&
    !isLocalHost(host) &&
    host !== canonical &&
    aliases.includes(host)
  ) {
    const url = new URL(request.url);
    const location = `https://${canonical}${url.pathname}${url.search}`;
    return NextResponse.redirect(location, 301);
  }

  const response = NextResponse.next();
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
