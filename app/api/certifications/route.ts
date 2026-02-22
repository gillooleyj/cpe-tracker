import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  type CertFormFields,
  validateCertForm,
  sanitizeCertForm,
} from "@/lib/certValidation";

// ── In-memory rate limiter ────────────────────────────────────────────────────
// Tracks submission counts per user within a rolling 60-second window.
// For multi-instance deployments, replace with a Redis-backed solution.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── POST /api/certifications ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* read-only in route handlers */ },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // ── 2. Rate limit ────────────────────────────────────────────────────────
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: CertFormFields;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // ── 4. Server-side validation (mirrors client-side exactly) ──────────────
    const { valid, errors } = validateCertForm(body);
    if (!valid) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // ── 5. Sanitize and insert ───────────────────────────────────────────────
    // user_id is always sourced from the authenticated session — never from
    // the request body — so the client cannot forge a different owner.
    const payload = {
      ...sanitizeCertForm(body),
      user_id: user.id,
    };

    const { data, error: insertError } = await supabase
      .from("certifications")
      .insert([payload])
      .select()
      .single();

    if (insertError) {
      console.error("Certification insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save certification. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in POST /api/certifications:", err);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
