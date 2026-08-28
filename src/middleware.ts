import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAgentRequest } from "./lib/content-negotiation";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Intercept /meet/:eventId for Content Negotiation
  const meetMatch = pathname.match(/^\/meet\/([^/]+)$/);
  if (meetMatch) {
    const eventId = meetMatch[1];

    if (isAgentRequest(request)) {
      // Rewrite to backend agent API endpoint while preserving the clean URL
      const url = request.nextUrl.clone();
      url.pathname = `/api/v1/meet/${eventId}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/meet/:path*"],
};
