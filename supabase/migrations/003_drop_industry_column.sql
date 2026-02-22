-- ============================================================
-- Remove the industry column from user_profiles.
-- Organization type now covers this information.
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

ALTER TABLE user_profiles DROP COLUMN IF EXISTS industry;
