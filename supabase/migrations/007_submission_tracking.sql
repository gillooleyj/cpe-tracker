-- ============================================================
-- Migration 007: Submission Tracking
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Add submission tracking to junction table ───────────────────────────────
ALTER TABLE certification_activities
  ADD COLUMN IF NOT EXISTS submitted_to_org   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_date     DATE,
  ADD COLUMN IF NOT EXISTS submission_notes   TEXT;

-- ── 2. Add UPDATE policy (was missing — PATCH would silently fail without this)
CREATE POLICY "Users can update own cert-activity links"
  ON certification_activities FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM certifications c WHERE c.id = certification_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM certifications c WHERE c.id = certification_id AND c.user_id = auth.uid())
  );

-- ── 3. Add reminder preferences to user_profiles ──────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS remind_quarterly_submit   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remind_20hrs_unsubmitted  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS remind_90days_expiry      BOOLEAN NOT NULL DEFAULT true;
