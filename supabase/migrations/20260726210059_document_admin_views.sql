-- What was sent, when, and whether anyone read it. A client who has not opened
-- three monthly reports is telling you something before they cancel, so the
-- unopened count is a first class column rather than something to go looking for.
create or replace view public.v_document_index
with (security_invoker = true)
as
select
  d.id,
  d.case_file_id,
  cf.name as client_name,
  cf.slug as client_slug,
  d.type,
  d.title,
  d.state,
  d.version,
  d.period_start,
  d.period_end,
  d.generated_at,
  d.published_at,
  d.is_case_study,
  d.anonymisation_confirmed_at,
  d.correction_note,
  d.supersedes_id,
  d.superseded_by_id,
  d.drive_url,
  d.share_link_id,
  (select count(*) from public.document_section s where s.document_id = d.id and s.has_gap) as sections_with_gaps,
  (select count(*) from public.document_open o where o.document_id = d.id) as open_count,
  (select max(o.opened_at) from public.document_open o where o.document_id = d.id) as last_opened_at,
  (select count(*) from public.anonymisation_flag f where f.document_id = d.id and f.confirmed_at is null) as open_flags,
  (select string_agg(distinct x.channel, ', ' order by x.channel) from public.document_delivery x where x.document_id = d.id) as channels
from public.document d
join public.client_case_file cf on cf.id = d.case_file_id
where app.is_admin();

-- Where do I need to look today, on the documents side.
create or replace view public.v_document_attention
with (security_invoker = true)
as
with latest_monthly as (
  select distinct on (d.case_file_id)
    d.case_file_id, d.id, d.published_at,
    (select count(*) from public.document_open o where o.document_id = d.id) as open_count
  from public.document d
  where d.state = 'published' and d.type = 'monthly_performance' and not d.is_case_study
  order by d.case_file_id, d.published_at desc
)
select
  cf.id as case_file_id,
  cf.name as client_name,
  cf.slug as client_slug,
  cf.status,
  -- A monthly report is overdue once the last published one is more than five
  -- weeks old, or was never produced at all.
  (select max(published_at) from public.document d
     where d.case_file_id = cf.id and d.type = 'monthly_performance' and d.state = 'published') as last_monthly_at,
  (select count(*) from public.document d
     where d.case_file_id = cf.id and d.state = 'draft' and not d.is_case_study) as open_drafts,
  (select count(*) from public.document d
     where d.case_file_id = cf.id and d.state = 'in_review') as awaiting_review,
  (select count(*) from public.document d
     where d.case_file_id = cf.id and d.state = 'published' and not d.is_case_study
       and not exists (select 1 from public.document_open o where o.document_id = d.id)) as unopened_published,
  (select count(*) from public.document d
     where d.case_file_id = cf.id and d.is_case_study and d.anonymisation_confirmed_at is null) as unconfirmed_case_studies,
  exists (select 1 from public.snapshot s where s.case_file_id = cf.id and s.kind = 'baseline') as has_baseline,
  lm.open_count as latest_monthly_opens
from public.client_case_file cf
left join latest_monthly lm on lm.case_file_id = cf.id
where app.is_admin();

revoke all on public.v_document_index from anon;
revoke all on public.v_document_attention from anon;
