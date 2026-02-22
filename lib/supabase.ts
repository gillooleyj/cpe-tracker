import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type CpeActivity = {
  id: string;
  user_id: string;
  title: string;
  provider: string;
  activity_date: string;
  total_hours: number;
  category: string | null;
  description: string | null;
  attachment_urls: string[];
  created_at?: string;
  updated_at?: string;
};

// Junction record enriched with cert name/org (from Supabase nested select)
export type ActivityCertLink = {
  id: string;
  certification_id: number; // bigint in DB, returned as number by Supabase JS
  hours_applied: number;
  submitted_to_org: boolean;
  submitted_date: string | null;
  submission_notes: string | null;
  certifications: { name: string; organization: string; organization_url: string | null } | null;
};

// Full activity as returned by the activities page query
export type ActivityWithCerts = CpeActivity & {
  certification_activities: ActivityCertLink[];
};

// Minimal activity info attached to a cert's expanded card
export type LinkedActivity = {
  junction_id: string;
  activity_id: string;
  hours_applied: number;
  submitted_to_org: boolean;
  submitted_date: string | null;
  submission_notes: string | null;
  title: string;
  provider: string;
  activity_date: string;
  attachment_urls: string[];
};

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
