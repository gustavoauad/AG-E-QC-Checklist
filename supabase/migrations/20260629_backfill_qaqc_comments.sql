-- Backfill is_qaqc_flagged for comments made by users with the qaqc project role
UPDATE checklist_comments cc
SET is_qaqc_flagged = true
FROM checklists cl
JOIN project_members pm
  ON pm.project_id = cl.project_id
 AND pm.user_id    = cc.user_id
 AND pm.role       = 'qaqc'
WHERE cc.checklist_item_id = cl.id
  AND cc.is_qaqc_flagged   = false;
