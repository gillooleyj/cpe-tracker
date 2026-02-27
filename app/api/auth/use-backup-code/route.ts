import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// ── Rate limiter: 5 attempts per 15 minutes per user ─────────────────────────
const rateMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, factorId } = body as { code?: string; factorId?: string };

    if (!code || !factorId) {
      return NextResponse.json({ error: "Missing code or factorId." }, { status: 400 });
    }

    // ── Get authenticated user from session cookies ──────────────────────────
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only in route handlers — session refresh handled by middleware
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // ── Rate limit ───────────────────────────────────────────────────────────
    const now = Date.now();
    const entry = rateMap.get(user.id);
    if (entry && now - entry.windowStart < WINDOW_MS) {
      if (entry.count >= RATE_LIMIT) {
        return NextResponse.json(
          { error: "Too many attempts. Please try again later." },
          { status: 429 }
        );
      }
      entry.count++;
    } else {
      rateMap.set(user.id, { count: 1, windowStart: now });
    }

    // ── Normalize and compare against all unused codes via bcrypt ────────────
    const normalized = code.replace("-", "").toUpperCase();

    const { data: rows, error: lookupError } = await supabase
      .from("backup_codes")
      .select("id, code_hash")
      .eq("user_id", user.id)
      .eq("factor_id", factorId)
      .is("used_at", null);

    if (lookupError) {
      return NextResponse.json({ error: "Database error." }, { status: 500 });
    }

    let matchedRow: { id: string } | null = null;
    for (const row of rows ?? []) {
      if (await bcrypt.compare(normalized, row.code_hash)) {
        matchedRow = row;
        break;
      }
    }

    if (!matchedRow) {
      return NextResponse.json(
        { error: "Invalid or already-used backup code." },
        { status: 400 }
      );
    }

    // ── Mark as used ─────────────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("backup_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", matchedRow.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to mark code as used." }, { status: 500 });
    }

    // ── Delete the TOTP factor via admin API ─────────────────────────────────
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: service role key not set." },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: deleteError } = await adminClient.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: factorId,
    });

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to remove authenticator factor." },
        { status: 500 }
      );
    }

    // ── Clean up all backup codes for this factor ────────────────────────────
    await supabase
      .from("backup_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("factor_id", factorId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
