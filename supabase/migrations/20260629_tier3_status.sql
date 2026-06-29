-- Allow 'in_progress' as a valid checklist status
-- Drop any existing CHECK constraint on checklists.status and replace it
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name
    INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
   WHERE tc.table_name = 'checklists'
     AND tc.constraint_type = 'CHECK'
     AND cc.check_clause ILIKE '%status%'
   LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE checklists DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

ALTER TABLE checklists
  ADD CONSTRAINT checklists_status_check
  CHECK (status IN ('pending', 'complete', 'na', 'in_progress'));
