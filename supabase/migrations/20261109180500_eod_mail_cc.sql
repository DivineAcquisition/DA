-- Copy the placement's extra CC on every end-of-day letter.
-- The manager review link opens the review desk.

create or replace function app.so_eod_queue_mail(p_eod public.sales_eod, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_op public.operator;
  v_client text;
  v_contact text;
  v_manager text;
  v_recipients text[];
  v_plan text;
  v_due text;
  v_shift text;
  v_payload jsonb;
  v_cc text[];
begin
  if p_kind not in ('operator.eod_reminder', 'client.eod_submitted', 'manager.eod_submitted') then
    return;
  end if;
  select * into v_pl from public.placement where id = p_eod.placement_id;
  select * into v_op from public.operator where id = p_eod.operator_id;
  if v_pl.id is null or v_op.id is null then
    return;
  end if;
  select cf.name, nullif(btrim(cf.contact_email), '')
    into v_client, v_contact
  from public.client_case_file cf
  where cf.id = v_pl.case_file_id;
  select nullif(btrim(p.email), '') into v_manager
  from public.profile p
  where p.id = v_pl.manager_profile_id;

  select coalesce(array_agg(distinct lower(btrim(email))), '{}')
    into v_recipients
  from (
    select unnest(coalesce(c.recipient_emails, '{}') || coalesce(c.extra_emails, '{}')) as email
    from public.sales_report_config c
    where c.placement_id = v_pl.id
    union all
    select v_contact
  ) emails
  where email is not null and btrim(email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';

  select coalesce(string_agg(btrim(item ->> 'text'), E'\n' order by ord), '')
    into v_plan
  from jsonb_array_elements(coalesce(p_eod.plan_items, '[]'::jsonb)) with ordinality as t(item, ord)
  where length(btrim(coalesce(item ->> 'text', ''))) > 0;

  v_due := to_char(p_eod.deadline_at at time zone v_pl.time_zone, 'FMHH12:MI AM');
  v_shift := to_char(nullif(v_pl.shift_end, '')::time, 'FMHH12:MI AM');

  v_payload := jsonb_build_object(
    'operator_id', v_op.id,
    'placement_id', v_pl.id,
    'case_file_id', v_pl.case_file_id,
    'name', v_op.name,
    'client', coalesce(v_client, 'the client'),
    'work_date', p_eod.work_date,
    'due_label', v_due,
    'shift_label', v_shift,
    'time_zone', v_pl.time_zone,
    'wins', coalesce(p_eod.wins, ''),
    'blockers', coalesce(p_eod.blockers, ''),
    'plan', coalesce(v_plan, ''),
    'needs_help', coalesce(p_eod.needs_help, false),
    'was_late', coalesce(p_eod.was_late, false)
  );

  if p_kind = 'operator.eod_reminder' then
    if nullif(btrim(coalesce(v_op.email, '')), '') is null then
      return;
    end if;
    v_payload := v_payload || jsonb_build_object(
      'to', jsonb_build_array(lower(btrim(v_op.email))),
      'link_path', case
        when nullif(btrim(coalesce(p_eod.link_token, '')), '') is null then '/workspace/operator/workspace/eod?day=' || p_eod.work_date::text
        else '/eod/' || p_eod.link_token
      end
    );
  elsif p_kind = 'client.eod_submitted' then
    if coalesce(cardinality(v_recipients), 0) = 0 then
      return;
    end if;
    v_payload := v_payload || jsonb_build_object('to', to_jsonb(v_recipients));
  else
    if v_manager is null then
      return;
    end if;
    v_payload := v_payload || jsonb_build_object(
      'to', jsonb_build_array(lower(v_manager)),
      'review_path', '/workspace/review/eods/' || p_eod.id::text
    );
  end if;

  select coalesce(array_agg(distinct lower(btrim(email))), '{}')
    into v_cc
  from (
    select unnest(coalesce(c.extra_cc, '{}')) as email
    from public.sales_report_config c
    where c.placement_id = v_pl.id
  ) emails
  where email is not null and btrim(email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';

  v_payload := v_payload || jsonb_build_object(
    'cc', coalesce((
      select jsonb_agg(addr)
      from unnest(v_cc) as addr
      where not (addr = any (select jsonb_array_elements_text(coalesce(v_payload -> 'to', '[]'::jsonb))))
    ), '[]'::jsonb)
  );

  insert into public.sales_eod_mail (eod_id, kind, payload)
  values (p_eod.id, p_kind, v_payload)
  on conflict (eod_id, kind) do nothing;
end;
$$;

revoke all on function app.so_eod_queue_mail(public.sales_eod, text) from public, anon, authenticated;
