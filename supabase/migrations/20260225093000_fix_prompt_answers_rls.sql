-- Fix RLS policy for prompt_answers to use get_auth_tenant_ids() 
-- This ensures that joins from prompt_answer_sources to prompt_answers work correctly
-- when executed by the authenticated user in the frontend.

DROP POLICY IF EXISTS prompt_answers_tenant_isolation ON prompt_answers;

CREATE POLICY "prompt_answers_select_own_tenant"
  ON prompt_answers FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT get_auth_tenant_ids())
  );
