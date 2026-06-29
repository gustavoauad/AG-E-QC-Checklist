-- Add days_before to milestone_items so each (item, milestone) pair
-- can independently specify how many days before that milestone the item is due.
ALTER TABLE milestone_items ADD COLUMN IF NOT EXISTS days_before integer;
