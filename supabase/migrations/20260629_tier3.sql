-- Tier 3: in-progress status, help text, days-before-milestone, QAQC role & comment flagging

-- ── 1. In-progress status tracking ──────────────────────────────────────────
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS in_progress_by  uuid REFERENCES auth.users(id);
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS in_progress_at  timestamptz;

-- ── 2. Help text (org defaults, inheritable/overridable at project level) ────
ALTER TABLE org_checklist_items ADD COLUMN IF NOT EXISTS help_text text;
ALTER TABLE checklists          ADD COLUMN IF NOT EXISTS help_text text;

-- ── 3. Days of antecedence before milestone ──────────────────────────────────
-- Org template stores the default; project item can override it.
-- due_date is computed in the UI: milestone.date − days_before_milestone
ALTER TABLE org_checklist_items ADD COLUMN IF NOT EXISTS days_before_milestone int;
ALTER TABLE checklists          ADD COLUMN IF NOT EXISTS days_before_milestone int;

-- ── 4. QAQC comment flagging ─────────────────────────────────────────────────
-- Comments from QAQC role are auto-flagged and surface on the project dashboard.
ALTER TABLE checklist_comments ADD COLUMN IF NOT EXISTS is_qaqc_flagged boolean NOT NULL DEFAULT false;

-- ── 5. Update push_checklist_to_projects to carry new fields ─────────────────
CREATE OR REPLACE FUNCTION push_checklist_to_projects(
  p_project_ids  uuid[],
  p_category     text,
  p_label        text,
  p_items        jsonb,   -- [{item_id, item_text, section, help_text, days_before_milestone}]
  p_action       text     -- 'overwrite_keep' | 'overwrite_reset'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  p_project_id  uuid;
  item          jsonb;
  saved_status  text;
  saved_by      uuid;
  saved_at      timestamptz;
  item_idx      int;
BEGIN
  FOREACH p_project_id IN ARRAY p_project_ids
  LOOP
    item_idx := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      saved_status := 'pending'; saved_by := NULL; saved_at := NULL;

      IF p_action = 'overwrite_keep' THEN
        SELECT status, completed_by, completed_at
          INTO saved_status, saved_by, saved_at
          FROM checklists
         WHERE project_id = p_project_id
           AND item_id    = (item->>'item_id')
         LIMIT 1;
        IF NOT FOUND THEN
          saved_status := 'pending'; saved_by := NULL; saved_at := NULL;
        END IF;
      END IF;

      DELETE FROM checklists
       WHERE project_id = p_project_id
         AND item_id    = (item->>'item_id');

      INSERT INTO checklists
        (project_id, item_id, category, item_text, status,
         completed_by, completed_at, sub_section, sort_order,
         help_text, days_before_milestone)
      VALUES
        (p_project_id,
         item->>'item_id',
         p_category,
         item->>'item_text',
         saved_status,
         saved_by,
         saved_at,
         NULLIF(item->>'section', ''),
         item_idx,
         NULLIF(item->>'help_text', ''),
         (item->>'days_before_milestone')::int);

      item_idx := item_idx + 1;
    END LOOP;

    -- Remove items in this category no longer in the org list
    DELETE FROM checklists
     WHERE project_id = p_project_id
       AND category   = p_category
       AND item_id NOT IN (
         SELECT value->>'item_id' FROM jsonb_array_elements(p_items)
       );

    INSERT INTO project_checklist_config (project_id, category, enabled, label)
    VALUES (p_project_id, p_category, true, p_label)
    ON CONFLICT (project_id, category)
    DO UPDATE SET enabled = true, label = p_label;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION push_checklist_to_projects(uuid[], text, text, jsonb, text) TO authenticated;
