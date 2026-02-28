import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recalcCpeEarned } from "../route";

type CertLink = { id: string; hours_applied: number };

type ActivityBody = {
  title: string;
  provider: string;
  activity_date: string;
  total_hours: string | number;
  category?: string;
  description?: string;
  attachment_urls?: string[];
  certifications: CertLink[];
};

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

// ── PUT /api/cpe-activities/[id] ──────────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify ownership
    const { data: existing } = await supabase
      .from("cpe_activities")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
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

    // Get previous cert IDs so we can recalc them too
    const { data: oldLinks } = await supabase
      .from("certification_activities")
      .select("certification_id")
      .eq("activity_id", id);
    const oldCertIds = (oldLinks ?? []).map((r) => r.certification_id);

    // Update the activity
    const { data: activity, error: updateError } = await supabase
      .from("cpe_activities")
      .update({
        title:           body.title.trim(),
        provider:        body.provider.trim(),
        activity_date:   body.activity_date,
        total_hours:     Number(body.total_hours),
        category:        body.category?.trim()    || null,
        description:     body.description?.trim() || null,
        attachment_urls: body.attachment_urls ?? [],
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Activity update error:", updateError);
      return NextResponse.json({ error: "Failed to update activity." }, { status: 500 });
    }

    // Verify all certification IDs belong to the authenticated user
    const newCertIds = body.certifications.map((c) => c.id);
    const { data: ownedCerts, error: certCheckError } = await supabase
      .from("certifications")
      .select("id")
      .eq("user_id", user.id)
      .in("id", newCertIds);

    if (certCheckError) {
      return NextResponse.json({ error: "Failed to verify certifications." }, { status: 500 });
    }

    const ownedIds = new Set((ownedCerts ?? []).map((c: { id: unknown }) => String(c.id)));
    if (!newCertIds.every((cid) => ownedIds.has(String(cid)))) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Replace junction records
    await supabase
      .from("certification_activities")
      .delete()
      .eq("activity_id", id);

    const { error: junctionError } = await supabase
      .from("certification_activities")
      .insert(
        body.certifications.map((c) => ({
          certification_id: c.id,
          activity_id:      id,
          hours_applied:    Number(c.hours_applied),
        }))
      );
    if (junctionError) {
      console.error("Junction insert error:", junctionError);
    }

    // Recalc all affected certs (old + new)
    const allCertIds = Array.from(
      new Set([...oldCertIds, ...newCertIds])
    );
    await recalcCpeEarned(supabase, allCertIds, user.id);

    return NextResponse.json(activity);
  } catch (err) {
    console.error("Unexpected error in PUT /api/cpe-activities/[id]:", err);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

// ── DELETE /api/cpe-activities/[id] ──────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify ownership and get cert IDs + attachment paths before deleting
    const { data: existing } = await supabase
      .from("cpe_activities")
      .select("id, user_id, attachment_urls")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { data: links } = await supabase
      .from("certification_activities")
      .select("certification_id")
      .eq("activity_id", id);
    const certIds = (links ?? []).map((r) => r.certification_id);

    // Delete storage files (best-effort; client-side UI also does this,
    // but server-side cleanup handles direct API calls and edge cases)
    const attachmentPaths = (existing.attachment_urls as string[]) ?? [];
    if (attachmentPaths.length > 0) {
      await supabase.storage.from("cpe-attachments").remove(attachmentPaths);
    }

    // Delete activity (certification_activities cascade automatically)
    const { error: deleteError } = await supabase
      .from("cpe_activities")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Activity delete error:", deleteError);
      return NextResponse.json({ error: "Failed to delete activity." }, { status: 500 });
    }

    // Recalculate cpe_earned on previously linked certs
    await recalcCpeEarned(supabase, certIds, user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error in DELETE /api/cpe-activities/[id]:", err);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
