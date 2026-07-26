-- The EXECUTE grant on rls_auto_enable was to PUBLIC, not to anon and
-- authenticated directly, so the earlier revoke did not clear it. Event
-- triggers do not check EXECUTE when they fire -- verified by creating a table
-- and confirming RLS was still auto-enabled -- so this is safe.
revoke all on function public.rls_auto_enable() from public;
