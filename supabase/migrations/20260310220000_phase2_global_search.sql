-- Migration for Global Search (Fase 2.2)

-- Drop first to be safe
DROP FUNCTION IF EXISTS public.search_global(uuid, text);

CREATE OR REPLACE FUNCTION public.search_global(p_organization_id uuid, p_query text)
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  subtitle text,
  avatar text,
  link_id text
) AS $$
BEGIN
  -- Search in Contacts
  RETURN QUERY
  SELECT 
    c.id,
    'contact'::text AS type,
    c.name AS title,
    COALESCE(c.company, c.phone, '') AS subtitle,
    c.avatar,
    c.id::text AS link_id
  FROM public.contacts c
  WHERE c.organization_id = p_organization_id
    AND (
      c.name ILIKE '%' || p_query || '%'
      OR c.phone ILIKE '%' || p_query || '%'
      OR c.email ILIKE '%' || p_query || '%'
      OR c.company ILIKE '%' || p_query || '%'
    )
  ORDER BY c.name
  LIMIT 5;

  -- Search in Deals
  RETURN QUERY
  SELECT 
    d.id,
    'deal'::text AS type,
    d.title,
    b.name AS subtitle,
    NULL::text AS avatar,
    d.id::text AS link_id
  FROM public.deals d
  LEFT JOIN public.boards b ON d.board_id = b.id
  WHERE d.organization_id = p_organization_id
    AND d.title ILIKE '%' || p_query || '%'
  ORDER BY d.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
