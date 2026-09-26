-- NOT YET APPLIED. Apply after the branch that makes lib/workspace/signing.ts
-- call these with the service role is deployed, and SUPABASE_SERVICE_ROLE_KEY
-- (or DOCUSEAL_API_KEY) is set on the Vercel project. Then move this file into
-- supabase/migrations/ under the version apply_migration records.
--
-- Until it runs, anyone holding the public anon key (it is committed in
-- lib/workspace/resolve-signing.ts) can call da_get_docuseal_api_key() and
-- read the DocuSeal API key, and can call da_mark_agreement_signed() with a
-- signing token to mark an agreement completed without DocuSeal ever
-- executing it. Rotate the DocuSeal API key after this is applied: the current
-- one has been readable by the public.

revoke all on function public.da_get_docuseal_api_key() from public, anon, authenticated;
grant execute on function public.da_get_docuseal_api_key() to service_role;

revoke all on function public.da_mark_agreement_signed(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.da_mark_agreement_signed(text, jsonb, text) to service_role;
