-- Fix foreign key on ai_usage_log.prompt_answer_id to SET NULL on delete
-- This allows prompt_answers rows to be deleted (e.g. when deleting a prompt or topic)
-- without violating the FK constraint; the usage log keeps the record but nulls the reference.

ALTER TABLE ai_usage_log
  DROP CONSTRAINT ai_usage_log_prompt_answer_id_fkey;

ALTER TABLE ai_usage_log
  ADD CONSTRAINT ai_usage_log_prompt_answer_id_fkey
  FOREIGN KEY (prompt_answer_id)
  REFERENCES prompt_answers(id)
  ON DELETE SET NULL;
