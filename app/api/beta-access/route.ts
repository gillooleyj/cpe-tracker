import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const SITE_PASSWORD = process.env.SITE_PASSWORD;

  // Gate is disabled — nothing to do.
  if (!SITE_PASSWORD) {
    return NextResponse.json({ error: "Gate is not active." }, { status: 404 });
  }

  const { password, redirect } = await request.json();
  const safeRedirect = typeof redirect === "string" && redirect.startsWith("/") ? redirect : "/";

  if (password !== SITE_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true, redirect: safeRedirect });
  response.cookies.set("site_access", SITE_PASSWORD, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return response;
}
