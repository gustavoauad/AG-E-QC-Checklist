-- Backfill is_qaqc_flagged for comments made by users with the qaqc project role
UPDATE checklist_comments
SET is_qaqc_flagged = true
FROM checklists cl
JOIN project_members pm
  ON pm.project_id = cl.project_id
 AND pm.role       = 'qaqc'
WHERE checklist_comments.checklist_item_id = cl.id
  AND checklist_comments.user_id           = pm.user_id
  AND checklist_comments.is_qaqc_flagged   = false;
