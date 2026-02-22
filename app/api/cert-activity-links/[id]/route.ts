import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type PatchBody = {
  submitted_to_org: boolean;
  submitted_date?: string | null;
  submission_notes?: string | null;
};

// ── PATCH /api/cert-activity-links/[id] ───────────────────────────────────────

export async function PATCH(
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

    // Parse body
    let body: PatchBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (typeof body.submitted_to_org !== "boolean") {
      return NextResponse.json({ error: "submitted_to_org must be a boolean." }, { status: 400 });
    }

    // Ownership check — single query: junction + cert ownership + activity date
    const { data: existing } = await supabase
      .from("certification_activities")
      .select("id, certifications!inner(user_id), cpe_activities!inner(activity_date)")
      .eq("id", id)
      .eq("certifications.user_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const activityDate = (existing as unknown as { cpe_activities: { activity_date: string } }).cpe_activities.activity_date;

    // Validate submitted_date
    if (body.submitted_to_org && body.submitted_date) {
      const subDate = new Date(body.submitted_date + "T00:00:00Z");
      const actDate = new Date(activityDate + "T00:00:00Z");
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      if (isNaN(subDate.getTime())) {
        return NextResponse.json({ error: "Invalid submission date." }, { status: 400 });
      }
      if (subDate < actDate) {
        return NextResponse.json({ error: "Submission date cannot be before the activity date." }, { status: 400 });
      }
      if (subDate > today) {
        return NextResponse.json({ error: "Submission date cannot be in the future." }, { status: 400 });
      }
    }

    // Validate submission_notes length
    if (body.submission_notes && body.submission_notes.length > 500) {
      return NextResponse.json({ error: "Submission notes must be 500 characters or fewer." }, { status: 400 });
    }

    // Update — clear date/notes when submitted_to_org = false
    const { data: updated, error: updateError } = await supabase
      .from("certification_activities")
      .update({
        submitted_to_org:  body.submitted_to_org,
        submitted_date:    body.submitted_to_org ? (body.submitted_date ?? null) : null,
        submission_notes:  body.submitted_to_org ? (body.submission_notes?.trim() ?? null) : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Cert-activity link update error:", updateError);
      return NextResponse.json({ error: "Failed to update submission status." }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Unexpected error in PATCH /api/cert-activity-links/[id]:", err);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
