-- Applied 2026-09-27, once the /s/<token> page stopped calling these (it now
-- embeds DocuSeal and waits for the webhook) and that page was live.
--
-- Until this ran, anyone holding the public anon key (committed in
-- lib/workspace/resolve-signing.ts) could call da_get_docuseal_api_key() and
-- read the DocuSeal API key, and could call da_mark_agreement_signed() with a
-- signing token to mark an agreement completed without DocuSeal executing it.
-- The DocuSeal API key should be rotated: the old one was publicly readable.

revoke all on function public.da_get_docuseal_api_key() from public, anon, authenticated;
grant execute on function public.da_get_docuseal_api_key() to service_role;

revoke all on function public.da_mark_agreement_signed(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.da_mark_agreement_signed(text, jsonb, text) to service_role;
