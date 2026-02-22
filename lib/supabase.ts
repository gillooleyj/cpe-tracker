import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type Certification = {
  id: string;
  name: string;
  organization: string;
  organization_url: string | null;
  issue_date: string;
  expiration_date: string | null;
  cpe_required: number | null;
  cpe_cycle_length: number | null;
  annual_minimum_cpe: number | null;
  cpe_earned: number;
  digital_certificate_url: string | null;
  user_id: string;
  created_at?: string;
};
