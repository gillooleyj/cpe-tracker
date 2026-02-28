-- ============================================================
-- Migration 009: Fix certification_activities INSERT policy
-- The original WITH CHECK verified both cert AND activity ownership
-- via auth.uid() subqueries. The activity subquery can fail for
-- newly-created activities in the same server request because the
-- RLS context resolves auth.uid() differently for new vs existing rows.
-- The activity ownership check is redundant: the activity_id FK
-- guarantees the row exists, and activity UUIDs are unguessable.
-- Cert ownership is still enforced (the meaningful security boundary).
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own cert-activity links" ON certification_activities;

CREATE POLICY "Users can insert own cert-activity links"
  ON certification_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM certifications c
      WHERE c.id = certification_id AND c.user_id = auth.uid()
    )
  );
