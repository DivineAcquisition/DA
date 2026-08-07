-- Company countersign identity for VA / operator DocuSeal agreements.
-- Used the same way NovaraCleaningui fills Authorized Rep / Company Signature.

alter table public.da_settings
  add column if not exists company_name text not null default '',
  add column if not exists company_rep text not null default '',
  add column if not exists company_email text not null default '',
  add column if not exists company_title text not null default '';

update public.da_settings
   set company_name = coalesce(nullif(btrim(company_name), ''), 'Divine Acquisition'),
       company_rep = coalesce(nullif(btrim(company_rep), ''), 'Malik Sannie'),
       company_email = coalesce(nullif(btrim(company_email), ''), 'malik@divineacquisition.io'),
       company_title = coalesce(nullif(btrim(company_title), ''), 'Owner')
 where id = 1;
