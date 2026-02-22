-- ============================================================
-- Add cpe_earned column to certifications table
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Tracks total CPE hours earned against a certification.
-- Populated later via CPE activity logging feature.
ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS cpe_earned integer NOT NULL DEFAULT 0;
