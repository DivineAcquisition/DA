-- Public agreement / page / calendar tokens are served on the talent host.
update public.da_settings
   set public_base_url = 'https://talent.divineacquisition.io',
       updated_at = now()
 where id = 1
   and (
     nullif(btrim(public_base_url), '') is null
     or public_base_url in (
       'https://admin.divineacquisition.io',
       'https://admin.divineacquisition.io/'
     )
   );

comment on column public.da_settings.public_base_url is
  'Public host for tokenized /s, /p, /c links (talent.divineacquisition.io).';

-- Rewrite existing tokenized signing links that still point at admin.
update public.da_agreement
   set signing_url = replace(
         signing_url,
         'https://admin.divineacquisition.io',
         'https://talent.divineacquisition.io'
       )
 where signing_url like 'https://admin.divineacquisition.io/s/%';
