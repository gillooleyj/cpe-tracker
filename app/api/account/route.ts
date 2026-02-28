import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE(_request: Request) {
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

  // Admin client — required to call auth.admin.deleteUser()
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Collect all storage paths for this user before deleting DB records
  const { data: activities } = await supabase
    .from("cpe_activities")
    .select("attachment_urls")
    .eq("user_id", user.id);

  const allPaths = (activities ?? []).flatMap((a) => (a.attachment_urls as string[]) ?? []);

  // 2. Delete storage files (best-effort — continue even if this partially fails)
  if (allPaths.length > 0) {
    await adminSupabase.storage.from("cpe-attachments").remove(allPaths);
  }

  // 3. Delete the auth user — cascades to all DB rows via ON DELETE CASCADE:
  //    user_profiles, certifications, cpe_activities, certification_activities, backup_codes
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Failed to delete user account:", deleteError);
    return NextResponse.json({ error: "Failed to delete account. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
