-- "Is a monthly report overdue" belongs to the query, not to a render pass. The
-- view already knows when the last one went out, and deciding it here keeps the
-- page a pure function of its data.
drop view if exists public.v_document_attention;

create view public.v_document_attention
with (security_invoker = true)
as
select
  cf.id as case_file_id,
  cf.name as client_name,
  cf.slug as client_slug,
  cf.status,
  (select max(published_at) from public.document d
     where d.case_file_id = cf.id and d.type = 'monthly_performance' and d.state = 'published') as last_monthly_at,
  -- Overdue once the last published monthly is more than five weeks old, or was
  -- never produced at all. Only meaningful while an engagement is running.
  cf.status = 'active' and coalesce(
    (select max(published_at) from public.document d
       where d.case_file_id = cf.id and d.type = 'monthly_performance' and d.state = 'published')
      < now() - interval '5 weeks',
    true
  ) as monthly_overdue,
  (select count(*) from public.document d
     where d.case_file_id = cf.id and d.state = 'draft' and not d.is_case_study) as open_drafts,
  (select count(*) from public.document d
     where d.case_file_id = cf.id and d.state = 'in_review') as awaiting_review,
  (select count(*) from public.document d
     where d.case_file_id = cf.id and d.state = 'published' and not d.is_case_study
       and not exists (select 1 from public.document_open o where o.document_id = d.id)) as unopened_published,
  (select count(*) from public.document d
     where d.case_file_id = cf.id and d.is_case_study and d.anonymisation_confirmed_at is null) as unconfirmed_case_studies,
  exists (select 1 from public.snapshot s where s.case_file_id = cf.id and s.kind = 'baseline') as has_baseline
from public.client_case_file cf
where app.is_admin();

revoke all on public.v_document_attention from anon;
