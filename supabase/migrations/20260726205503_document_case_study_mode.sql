-- ---------------------------------------------------------------------------
-- Assisted anonymisation
--
-- Rule 9. The system flags what it believes to be identifying and requires the
-- admin to confirm each one. It deliberately over-flags, because an automatic
-- pass that misses a single reference is worse than none: it creates false
-- confidence.
-- ---------------------------------------------------------------------------

create or replace function app.flag_identifiers(p_document_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_doc public.document;
  v_case public.client_case_file;
  v_section record;
  v_needle text;
  v_match text[];
  v_count integer := 0;
  v_descriptor text;
begin
  select * into v_doc from public.document where id = p_document_id;
  select * into v_case from public.client_case_file where id = v_doc.case_file_id;
  v_descriptor := coalesce(v_doc.anonymised_descriptor, '');

  for v_section in
    select key, title, body from public.document_section
    where document_id = p_document_id
      and kind in ('narrative', 'fixed')
      and nullif(btrim(coalesce(body, '')), '') is not null
  loop
    -- The business name, whole, and then each distinctive word in it. A report
    -- that says "Lumen saw a lift" is still identifying.
    foreach v_needle in array (
      select array_agg(distinct w)
      from unnest(
        array[v_case.name]
        || string_to_array(regexp_replace(v_case.name, '[^A-Za-z0-9 ]', ' ', 'g'), ' ')
      ) as w
      where length(btrim(w)) > 3
    )
    loop
      if v_section.body ilike '%' || v_needle || '%' then
        insert into public.anonymisation_flag (document_id, section_key, kind, snippet, suggestion)
        values (p_document_id, v_section.key, 'client_name', v_needle, nullif(v_descriptor, ''));
        v_count := v_count + 1;
      end if;
    end loop;

    -- The named contact, and each part of their name.
    if v_case.contact_name is not null then
      foreach v_needle in array (
        select array_agg(distinct w)
        from unnest(
          array[v_case.contact_name] || string_to_array(v_case.contact_name, ' ')
        ) as w
        where length(btrim(w)) > 2
      )
      loop
        if v_section.body ilike '%' || v_needle || '%' then
          insert into public.anonymisation_flag (document_id, section_key, kind, snippet, suggestion)
          values (p_document_id, v_section.key, 'person', v_needle, 'the owner');
          v_count := v_count + 1;
        end if;
      end loop;
    end if;

    -- Anything else that reads like a proper noun: a person, a place, a competing
    -- brand, a tool named in passing. Flagged for a human to judge.
    for v_match in
      select m from regexp_matches(
        v_section.body,
        '(?<![.!?]\s)(?<!^)\y([A-Z][a-z]{2,}(?:\s+(?:of\s+|the\s+)?[A-Z][a-z]{2,})*)\y',
        'g'
      ) as m
    loop
      v_needle := btrim(v_match[1]);
      if v_needle is not null
         and length(v_needle) > 3
         and v_needle <> v_case.name
         and not exists (
           select 1 from public.anonymisation_flag
           where document_id = p_document_id and section_key = v_section.key
             and lower(snippet) = lower(v_needle)
         )
      then
        insert into public.anonymisation_flag (document_id, section_key, kind, snippet, suggestion)
        values (p_document_id, v_section.key, 'other', v_needle, null);
        v_count := v_count + 1;
      end if;
    end loop;

    -- Web addresses and email domains identify a business immediately.
    for v_match in
      select m from regexp_matches(v_section.body, '([A-Za-z0-9-]+\.(?:com|co|net|org|io|us)\y)', 'g') as m
    loop
      insert into public.anonymisation_flag (document_id, section_key, kind, snippet, suggestion)
      values (p_document_id, v_section.key, 'brand', btrim(v_match[1]), null);
      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- Any Monthly or Quarterly report can be regenerated as a case study draft. The
-- numbers, the growth arc and the selected evidence carry through intact.
create or replace function public.create_case_study_draft(
  p_document_id uuid,
  p_descriptor text
)
returns public.document
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.document;
  v_new public.document;
begin
  if not app.is_admin() then
    raise exception 'admin_only: case study drafts are internal documents' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_descriptor, '')), '') is null then
    raise exception 'descriptor_required: give the anonymised subject a descriptor, for example "a med spa in the Mid-Atlantic"'
      using errcode = '23514';
  end if;
  if position(chr(8212) in p_descriptor) > 0 then
    raise exception 'em_dash_not_permitted: DA prose uses commas, colons, parentheses or full stops instead of em dashes'
      using errcode = '23514';
  end if;

  select * into v_old from public.document where id = p_document_id;
  if v_old.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  if v_old.type not in ('monthly_performance', 'quarterly_review') then
    raise exception 'case_study_source: a case study is drawn from a monthly or quarterly report, not a % document', v_old.type
      using errcode = '23514';
  end if;
  if v_old.is_case_study then
    raise exception 'already_a_case_study: this document is already a case study draft' using errcode = '23514';
  end if;

  insert into public.document (
    case_file_id, type, template_id, template_version, title,
    period_start, period_end, include_effort,
    is_case_study, anonymised_descriptor, supersedes_id, generated_by
  ) values (
    v_old.case_file_id, v_old.type, v_old.template_id, v_old.template_version,
    v_old.title || ' (case study draft)',
    v_old.period_start, v_old.period_end, v_old.include_effort,
    true, btrim(p_descriptor), v_old.id, auth.uid()
  ) returning * into v_new;

  insert into public.document_section (document_id, key, title, kind, sort_order, body, bound_data, has_gap)
  select v_new.id, s.key, s.title, s.kind, s.sort_order, s.body, s.bound_data, s.has_gap
  from public.document_section s where s.document_id = v_old.id;

  perform app.flag_identifiers(v_new.id);

  return v_new;
end;
$$;

-- Rewriting a flagged reference, or accepting it as not identifying. Either way
-- a human made the call, which is the point.
create or replace function public.resolve_anonymisation_flag(
  p_flag_id uuid,
  p_replacement text default null
)
returns public.anonymisation_flag
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_flag public.anonymisation_flag;
  v_state public.document_state;
  v_body text;
begin
  select * into v_flag from public.anonymisation_flag where id = p_flag_id;
  if v_flag.id is null then
    raise exception 'flag_not_found' using errcode = 'P0002';
  end if;

  select state into v_state from public.document where id = v_flag.document_id;
  if v_state <> 'draft' then
    raise exception 'anonymisation_requires_draft: this draft is % and its narrative is closed', v_state
      using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_replacement, '')), '') is not null then
    if position(chr(8212) in p_replacement) > 0 then
      raise exception 'em_dash_not_permitted: DA prose uses commas, colons, parentheses or full stops instead of em dashes'
        using errcode = '23514';
    end if;

    select body into v_body from public.document_section
    where document_id = v_flag.document_id and key = v_flag.section_key;

    update public.document_section
      set body = regexp_replace(v_body, '\y' || regexp_replace(v_flag.snippet, '([^A-Za-z0-9])', '\\\1', 'g') || '\y', btrim(p_replacement), 'gi')
    where document_id = v_flag.document_id and key = v_flag.section_key;
  end if;

  update public.anonymisation_flag
    set confirmed_at = now(), confirmed_by = auth.uid()
  where id = p_flag_id
  returning * into v_flag;

  if not found then
    raise exception 'resolve_failed: you do not have permission to resolve this flag' using errcode = '42501';
  end if;

  -- A rewrite can introduce a fresh identifier, so the section is rescanned.
  if nullif(btrim(coalesce(p_replacement, '')), '') is not null then
    perform app.flag_identifiers(v_flag.document_id);
  end if;

  return v_flag;
end;
$$;

-- Rule 9: the draft is not usable until every flag has been looked at.
create or replace function public.mark_case_study_ready(p_document_id uuid)
returns public.document
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.document;
  v_open integer;
begin
  select * into v_doc from public.document where id = p_document_id;
  if v_doc.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  if not v_doc.is_case_study then
    raise exception 'not_a_case_study: this is not a case study draft' using errcode = '23514';
  end if;

  select count(*) into v_open
  from public.anonymisation_flag
  where document_id = p_document_id and confirmed_at is null;

  if v_open > 0 then
    raise exception 'anonymisation_unconfirmed: % identifying reference(s) still need a decision. Anonymisation is assisted, not automatic.', v_open
      using errcode = '23514';
  end if;

  update public.document
    set anonymisation_confirmed_at = now(),
        anonymisation_confirmed_by = auth.uid()
  where id = p_document_id
  returning * into v_doc;

  if not found then
    raise exception 'confirm_failed: you do not have permission to confirm this draft' using errcode = '42501';
  end if;

  return v_doc;
end;
$$;

-- A case study draft cannot reach review until its anonymisation is confirmed.
create or replace function public.submit_document_for_review(p_document_id uuid)
returns public.document
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.document;
  v_missing text;
begin
  select * into v_doc from public.document where id = p_document_id;
  if v_doc.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  if v_doc.state <> 'draft' then
    raise exception 'review_requires_draft: this document is already %', v_doc.state using errcode = '23514';
  end if;

  select string_agg(s.title, ', ' order by s.sort_order) into v_missing
  from public.document_section s
  join public.document_template_section ts
    on ts.template_id = v_doc.template_id and ts.key = s.key
  where s.document_id = v_doc.id
    and s.kind = 'narrative'
    and ts.required
    and nullif(btrim(coalesce(s.body, '')), '') is null;

  if v_missing is not null then
    raise exception 'narrative_incomplete: these sections still need writing: %', v_missing using errcode = '23514';
  end if;

  if v_doc.is_case_study and v_doc.anonymisation_confirmed_at is null then
    raise exception 'anonymisation_unconfirmed: confirm every flagged identifier before this draft is usable'
      using errcode = '23514';
  end if;

  update public.document set state = 'in_review' where id = v_doc.id returning * into v_doc;
  return v_doc;
end;
$$;
