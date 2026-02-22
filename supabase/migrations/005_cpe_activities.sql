-- ============================================================
-- Migration 005: CPE Activities & Certification-Activity Links
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Allow fractional hours on certifications (e.g. 2.5 hrs from a webinar)
ALTER TABLE certifications
  ALTER COLUMN cpe_earned TYPE DECIMAL(6,2);

-- ── 1. CPE Activities table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cpe_activities (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT         NOT NULL,
  provider        TEXT         NOT NULL,
  activity_date   DATE         NOT NULL,
  total_hours     DECIMAL(6,2) NOT NULL CHECK (total_hours > 0),
  category        TEXT,
  description     TEXT,
  attachment_urls TEXT[]       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. Certification ↔ Activity junction table ────────────────────────────────
CREATE TABLE IF NOT EXISTS certification_activities (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id BIGINT       NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  activity_id      UUID         NOT NULL REFERENCES cpe_activities(id)  ON DELETE CASCADE,
  hours_applied    DECIMAL(6,2) NOT NULL CHECK (hours_applied > 0),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_cert_activity UNIQUE(certification_id, activity_id)
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS cpe_activities_user_id_idx   ON cpe_activities(user_id);
CREATE INDEX IF NOT EXISTS cpe_activities_date_idx      ON cpe_activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS cert_activities_cert_id_idx  ON certification_activities(certification_id);
CREATE INDEX IF NOT EXISTS cert_activities_act_idx      ON certification_activities(activity_id);

-- ── 4. Auto-update updated_at ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER cpe_activities_set_updated_at
  BEFORE UPDATE ON cpe_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 5. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE cpe_activities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_activities ENABLE ROW LEVEL SECURITY;

-- cpe_activities policies
CREATE POLICY "Users can view own activities"
  ON cpe_activities FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activities"
  ON cpe_activities FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own activities"
  ON cpe_activities FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own activities"
  ON cpe_activities FOR DELETE USING (user_id = auth.uid());

-- certification_activities policies (access controlled via cert ownership)
CREATE POLICY "Users can view own cert-activity links"
  ON certification_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM certifications c
      WHERE c.id = certification_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own cert-activity links"
  ON certification_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM certifications c
      WHERE c.id = certification_id AND c.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM cpe_activities a
      WHERE a.id = activity_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own cert-activity links"
  ON certification_activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM certifications c
      WHERE c.id = certification_id AND c.user_id = auth.uid()
    )
  );

-- ── 6. Supabase Storage bucket ────────────────────────────────────────────────
-- Private bucket; files accessed via short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cpe-attachments',
  'cpe-attachments',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — file path must start with the authenticated user's UUID
CREATE POLICY "Users can upload own attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cpe-attachments'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "Users can view own attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cpe-attachments'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cpe-attachments'
    AND auth.uid()::text = split_part(name, '/', 1)
  );
