-- A user can belong to several organizations, but only one membership may be
-- selected as the server-side default organization at a time.
WITH ranked_memberships AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY is_default DESC, created_at ASC, organization_id ASC, role_id ASC
    ) AS rank
  FROM public.organization_members
)
UPDATE public.organization_members members
SET is_default = (ranked_memberships.rank = 1)
FROM ranked_memberships
WHERE members.ctid = ranked_memberships.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_one_default_per_user
  ON public.organization_members (user_id)
  WHERE is_default;
