import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];
const MFA_VERIFY_ROUTE = "/mfa";
const MFA_SETUP_ROUTE = "/mfa/setup";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  // Refresh session on every request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Unauthenticated ──────────────────────────────────────────────────────────
  if (!user) {
    if (AUTH_ROUTES.includes(pathname)) return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Authenticated — check MFA assurance level ────────────────────────────────
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = aal?.currentLevel;
  const nextLevel = aal?.nextLevel;

  // No MFA factor enrolled yet → must set up
  if (currentLevel === "aal1" && nextLevel === "aal1") {
    if (pathname.startsWith(MFA_SETUP_ROUTE)) return response;
    return NextResponse.redirect(new URL(MFA_SETUP_ROUTE, request.url));
  }

  // MFA enrolled but not yet verified this session → must verify
  if (currentLevel === "aal1" && nextLevel === "aal2") {
    if (pathname === MFA_VERIFY_ROUTE) return response;
    return NextResponse.redirect(new URL(MFA_VERIFY_ROUTE, request.url));
  }

  // Fully authenticated (aal2) → block auth/MFA pages, allow everything else
  const blockedWhenAuthed = [...AUTH_ROUTES, MFA_VERIFY_ROUTE, MFA_SETUP_ROUTE];
  if (blockedWhenAuthed.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/certifications", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/certifications", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
