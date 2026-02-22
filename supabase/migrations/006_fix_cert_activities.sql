-- ============================================================
-- Migration 006: Fix certification_activities (type mismatch)
-- certifications.id is BIGINT, not TEXT.
-- Migration 005 halted mid-way; this cleans up the partial state
-- and completes everything that did not run.
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Drop the failed table (and anything that depends on it) ────────────────
DROP TABLE IF EXISTS certification_activities CASCADE;

-- ── 2. Recreate with the correct BIGINT FK type ───────────────────────────────
CREATE TABLE certification_activities (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id BIGINT       NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  activity_id      UUID         NOT NULL REFERENCES cpe_activities(id)  ON DELETE CASCADE,
  hours_applied    DECIMAL(6,2) NOT NULL CHECK (hours_applied > 0),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_cert_activity UNIQUE(certification_id, activity_id)
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS cert_activities_cert_id_idx ON certification_activities(certification_id);
CREATE INDEX IF NOT EXISTS cert_activities_act_idx     ON certification_activities(activity_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE certification_activities ENABLE ROW LEVEL SECURITY;

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

-- ── 5. Storage bucket (did not run in 005 due to earlier error) ───────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cpe-attachments',
  'cpe-attachments',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Drop policies first in case this migration is re-run
DROP POLICY IF EXISTS "Users can upload own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own attachments"  ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;

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
