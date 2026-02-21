import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  digital_certificate_url: string | null;
  created_at?: string;
};
