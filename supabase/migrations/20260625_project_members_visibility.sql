-- Allow project members to see all other members of the same project
-- Uses a security definer function to avoid recursive RLS on project_members

CREATE OR REPLACE FUNCTION get_my_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT project_id FROM project_members WHERE user_id = auth.uid();
$$;

CREATE POLICY "members can view project members" ON project_members
  FOR SELECT USING (project_id IN (SELECT get_my_project_ids()));
