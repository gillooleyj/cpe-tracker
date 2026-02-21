import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

    // ── Hash the provided code ───────────────────────────────────────────────
    const normalized = code.replace("-", "").toUpperCase();
    const codeHash = await sha256(normalized);

    // ── Look up the backup code ──────────────────────────────────────────────
    const { data: rows, error: lookupError } = await supabase
      .from("backup_codes")
      .select("id")
      .eq("user_id", user.id)
      .eq("factor_id", factorId)
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .limit(1);

    if (lookupError) {
      return NextResponse.json({ error: "Database error." }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or already-used backup code." },
        { status: 400 }
      );
    }

    // ── Mark as used ─────────────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("backup_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", rows[0].id);

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
