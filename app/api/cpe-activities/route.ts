import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

type CertLink = { id: string; hours_applied: number };

type ActivityBody = {
  id?: string; // frontend-generated UUID so file paths match the DB record
  title: string;
  provider: string;
  activity_date: string;
  total_hours: string | number;
  category?: string;
  description?: string;
  attachment_urls?: string[];
  certifications: CertLink[];
};

// ── Validation ────────────────────────────────────────────────────────────────

function validateActivity(body: ActivityBody): Record<string, string> {
  const errors: Record<string, string> = {};

  const title = (body.title ?? "").trim();
  if (!title) errors.title = "Activity title is required.";
  else if (title.length > 200) errors.title = "Title must be 200 characters or fewer.";

  const provider = (body.provider ?? "").trim();
  if (!provider) errors.provider = "Provider is required.";
  else if (provider.length > 200) errors.provider = "Provider must be 200 characters or fewer.";

  if (!body.activity_date) {
    errors.activity_date = "Date is required.";
  } else {
    const d = new Date(body.activity_date + "T00:00:00Z");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (isNaN(d.getTime())) errors.activity_date = "Enter a valid date.";
    else if (d > today) errors.activity_date = "Date cannot be in the future.";
  }

  const hours = Number(body.total_hours);
  if (!body.total_hours && body.total_hours !== 0) {
    errors.total_hours = "Total hours is required.";
  } else if (isNaN(hours) || hours <= 0) {
    errors.total_hours = "Hours must be greater than 0.";
  } else if (hours > 500) {
    errors.total_hours = "Hours cannot exceed 500.";
  }

  if (!body.certifications?.length) {
    errors.certifications = "At least one certification must be selected.";
  } else {
    for (const c of body.certifications) {
      const h = Number(c.hours_applied);
      if (isNaN(h) || h <= 0) {
        errors.certifications = "Hours applied must be greater than 0 for each certification.";
        break;
      } else if (h > 500) {
        errors.certifications = "Hours applied cannot exceed 500 for each certification.";
        break;
      }
    }
  }

  return errors;
}

// ── Shared: recalculate cpe_earned for a list of certification IDs ─────────────
// Note: this is a read-then-write recalc. Concurrent requests on the same cert
// could produce a stale total; a proper fix requires a DB-level trigger or RPC.
// In practice this is safe for single-user low-concurrency access.

export async function recalcCpeEarned(
  supabase: SupabaseClient,
  certIds: string[],
  userId: string
) {
  for (const certId of certIds) {
    const { data } = await supabase
      .from("certification_activities")
      .select("hours_applied")
      .eq("certification_id", certId);
    const total = (data ?? []).reduce(
      (sum, r) => sum + Number(r.hours_applied),
      0
    );
    await supabase
      .from("certifications")
      .update({ cpe_earned: total })
      .eq("id", certId)
      .eq("user_id", userId);
  }
}

// ── POST /api/cpe-activities ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    let body: ActivityBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const errors = validateActivity(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Build insert payload — id is optional (frontend may provide for file path alignment)
    const payload: Record<string, unknown> = {
      user_id:         user.id,
      title:           body.title.trim(),
      provider:        body.provider.trim(),
      activity_date:   body.activity_date,
      total_hours:     Number(body.total_hours),
      category:        body.category?.trim()    || null,
      description:     body.description?.trim() || null,
      attachment_urls: body.attachment_urls ?? [],
    };
    if (body.id) payload.id = body.id;

    const { data: activity, error: insertError } = await supabase
      .from("cpe_activities")
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      console.error("Activity insert error:", insertError);
      return NextResponse.json({ error: "Failed to save activity." }, { status: 500 });
    }

    // Verify all certification IDs belong to the authenticated user
    const certIds = body.certifications.map((c) => c.id);
    const { data: ownedCerts, error: certCheckError } = await supabase
      .from("certifications")
      .select("id")
      .eq("user_id", user.id)
      .in("id", certIds);

    if (certCheckError) {
      return NextResponse.json({ error: "Failed to verify certifications." }, { status: 500 });
    }

    const ownedIds = new Set((ownedCerts ?? []).map((c: { id: string }) => c.id));
    if (!certIds.every((id) => ownedIds.has(id))) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Insert junction records
    const { error: junctionError } = await supabase
      .from("certification_activities")
      .insert(
        body.certifications.map((c) => ({
          certification_id: c.id,
          activity_id:      activity.id,
          hours_applied:    Number(c.hours_applied),
        }))
      );
    if (junctionError) {
      console.error("Junction insert error:", junctionError);
    }

    // Recalculate cpe_earned for affected certs
    await recalcCpeEarned(supabase, body.certifications.map((c) => c.id), user.id);

    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in POST /api/cpe-activities:", err);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
