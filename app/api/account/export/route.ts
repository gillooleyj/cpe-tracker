import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(_request: Request) {
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

  const [
    { data: profile },
    { data: certifications },
    { data: activities },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("first_name, last_name, job_title, organization_type, city, state_province, postal_code, country, certification_focus, remind_quarterly_submit, remind_20hrs_unsubmitted, remind_90days_expiry, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("certifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at"),
    supabase
      .from("cpe_activities")
      .select("*, certification_activities(certification_id, hours_applied, submitted_to_org, submitted_date, submission_notes)")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false }),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    account: {
      email: user.email,
      created_at: user.created_at,
    },
    profile: profile ?? null,
    certifications: certifications ?? [],
    cpe_activities: activities ?? [],
  };

  const filename = `argus-data-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
