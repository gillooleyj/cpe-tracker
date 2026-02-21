-- ============================================================
-- RLS for certifications table
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Enable Row Level Security on the table.
--    This alone blocks all access until policies are added.
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- 2. SELECT — users can only read their own rows.
CREATE POLICY "Users can view own certifications"
  ON certifications
  FOR SELECT
  USING (user_id = auth.uid());

-- 3. INSERT — the new row's user_id must equal the authenticated user.
--    WITH CHECK (not USING) is the right clause for INSERT.
CREATE POLICY "Users can insert own certifications"
  ON certifications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 4. UPDATE — must own the existing row AND the replacement user_id
--    must still match (prevents hijacking via a user_id change).
CREATE POLICY "Users can update own certifications"
  ON certifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. DELETE — users can only delete their own rows.
CREATE POLICY "Users can delete own certifications"
  ON certifications
  FOR DELETE
  USING (user_id = auth.uid());
