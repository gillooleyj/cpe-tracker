-- ============================================================
-- Migration 008: Data minimization — drop how_heard column
-- The how_heard field is marketing attribution data that is not
-- necessary for the app to function and has no legal basis for
-- retention under GDPR / US state privacy laws.
--
-- Run AFTER deploying the code change that removes how_heard
-- from the account page and API payload.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

ALTER TABLE user_profiles DROP COLUMN IF EXISTS how_heard;
