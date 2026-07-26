-- Rule 7: nothing from the client never-see list can appear in a generated
-- document, and operator names are on that list.
--
-- The milestone and effort logs are internal records where naming the operator is
-- correct and useful, so the scrub belongs at the point the text crosses into a
-- document rather than at the point it is written. Found by rendering a real
-- quarterly review: a seeded milestone read "Amara Ochieng placed full-time".
create or replace function app.scrub_operator_names(p_text text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out text := p_text;
  v_name text;
begin
  if p_text is null then return null; end if;

  -- Longest first, so "Amara Ochieng" is replaced whole before either part of it
  -- can match on its own. Every operator is considered, not only the ones placed
  -- on this client, because a note can name someone who never worked the account.
  for v_name in
    select n from (
      select distinct unnest(array[o.name] || string_to_array(o.name, ' ')) as n
      from public.operator o
      where o.name is not null
    ) names
    where length(btrim(n)) > 2
    order by length(n) desc
  loop
    v_out := regexp_replace(
      v_out,
      '\y' || regexp_replace(v_name, '([^A-Za-z0-9 ])', '\\\1', 'g') || '\y',
      'your operator',
      'gi'
    );
  end loop;

  -- First and last name both matching leaves the phrase doubled.
  v_out := regexp_replace(v_out, 'your operator( your operator)+', 'your operator', 'gi');
  -- And it reads badly lowercase at the start of a sentence.
  v_out := regexp_replace(v_out, '^your operator', 'Your operator');
  v_out := regexp_replace(v_out, '([.!?]\s+)your operator', '\1Your operator', 'g');

  return v_out;
end;
$$;

revoke all on function app.scrub_operator_names(text) from public;

create or replace function app.block_milestones(p_case_file_id uuid, p_start date, p_end date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'occurred_on', m.occurred_on,
          'type', m.type,
          'title', app.scrub_operator_names(m.title),
          'description', app.scrub_operator_names(m.description),
          'automatic', m.auto_generated
        ) order by m.occurred_on
      )
      from public.milestone m
      where m.case_file_id = p_case_file_id
        and (p_start is null or m.occurred_on >= p_start)
        and (p_end is null or m.occurred_on <= p_end)
    ), '[]'::jsonb)
  );
$$;

create or replace function app.block_effort(p_case_file_id uuid, p_start date, p_end date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'performed_on', e.performed_on,
          'phase', e.phase,
          'description', app.scrub_operator_names(e.description)
        ) order by e.performed_on
      )
      from public.effort_entry e
      where e.case_file_id = p_case_file_id
        and e.superseded_by_id is null
        and (p_start is null or e.performed_on >= p_start)
        and (p_end is null or e.performed_on <= p_end)
    ), '[]'::jsonb)
  );
$$;

create or replace function app.block_install(p_case_file_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rows', jsonb_build_array(
      app.bind_text('Engagement started', to_char(cf.engagement_start, 'FMDDth FMMonth YYYY'), 'Case file'),
      app.bind_text('Install began', to_char(cf.install_started_at, 'FMDDth FMMonth YYYY'), 'Case file'),
      app.bind_text('Install completed', (
        select to_char(m.occurred_on, 'FMDDth FMMonth YYYY')
        from public.milestone m
        where m.case_file_id = cf.id and m.type = 'install_complete'
        order by m.occurred_on limit 1
      ), 'Milestone log'),
      app.bind('Monthly revenue goal', cf.revenue_goal_monthly, 'currency', 'Engagement terms')
    ),
    'folders', coalesce((
      select jsonb_agg(jsonb_build_object('category', f.category, 'url', f.folder_url) order by f.category)
      from public.case_file_drive_folder f where f.case_file_id = cf.id
    ), '[]'::jsonb),
    'components', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'title', app.scrub_operator_names(m.title),
          'description', app.scrub_operator_names(m.description),
          'occurred_on', m.occurred_on
        )
        order by m.occurred_on
      )
      from public.milestone m
      where m.case_file_id = cf.id
        and m.type in ('install_complete', 'operator_placed', 'campaign_launched', 'first_lead', 'first_booking')
    ), '[]'::jsonb)
  )
  from public.client_case_file cf where cf.id = p_case_file_id;
$$;
