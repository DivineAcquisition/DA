-- A client may supply a logo, which sits alongside their name on the cover.
alter table public.client_case_file add column if not exists logo_url text;

-- ---------------------------------------------------------------------------
-- The payload: a document rendered to data, ready for the renderer or the freeze
-- ---------------------------------------------------------------------------

create or replace function app.document_payload(p_document_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'document', jsonb_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'version', d.version,
      'state', d.state,
      'period_start', d.period_start,
      'period_end', d.period_end,
      'generated_at', d.generated_at,
      'published_at', d.published_at,
      'correction_note', d.correction_note,
      'is_case_study', d.is_case_study,
      'include_effort', d.include_effort
    ),
    -- Rule 4 of branding: the client is the subject, DA is the firm that produced
    -- it. In case study mode the subject becomes a descriptor and the logo goes.
    'client', case when d.is_case_study then jsonb_build_object(
        'name', coalesce(d.anonymised_descriptor, 'A client'),
        'vertical', cf.vertical,
        'logo_url', null,
        'anonymised', true
      ) else jsonb_build_object(
        'name', cf.name,
        'vertical', cf.vertical,
        'contact_name', cf.contact_name,
        'logo_url', cf.logo_url,
        'anonymised', false
      ) end,
    -- Rule 5 and 6: this line goes on every page, and Vistrial is named quietly
    -- as the engine rather than as the brand.
    'producer_line', tpl.producer_line,
    'template', jsonb_build_object('name', tpl.name, 'version', d.template_version),
    'sections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', s.key,
          'title', s.title,
          'kind', s.kind,
          'sort_order', s.sort_order,
          'body', s.body,
          'bound_data', s.bound_data,
          'has_gap', s.has_gap
        ) order by s.sort_order
      )
      from public.document_section s where s.document_id = d.id
    ), '[]'::jsonb)
  )
  from public.document d
  join public.client_case_file cf on cf.id = d.case_file_id
  join public.document_template tpl on tpl.id = d.template_id
  where d.id = p_document_id;
$$;

-- ---------------------------------------------------------------------------
-- Generate
-- ---------------------------------------------------------------------------

create or replace function public.generate_document(
  p_case_file_id uuid,
  p_type public.document_type,
  p_period_start date default null,
  p_period_end date default null,
  p_include_effort boolean default false,
  p_title text default null
)
returns public.document
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template public.document_template;
  v_case public.client_case_file;
  v_doc public.document;
  v_blocks jsonb;
  v_section record;
  v_data jsonb;
  v_title text;
begin
  if not app.is_admin() then
    raise exception 'admin_only: document generation is an admin action' using errcode = '42501';
  end if;

  select * into v_case from public.client_case_file where id = p_case_file_id;
  if v_case.id is null then
    raise exception 'case_file_not_found' using errcode = 'P0002';
  end if;

  select * into v_template
  from public.document_template
  where type = p_type and is_current
  order by version desc limit 1;

  if v_template.id is null then
    raise exception 'no_current_template: no published template exists for a % document', p_type using errcode = 'P0002';
  end if;

  -- Nothing in this system works without a baseline, so a growth document
  -- refuses to generate rather than showing meaningless numbers.
  if p_type in ('monthly_performance', 'quarterly_review')
     and not exists (select 1 from public.snapshot where case_file_id = p_case_file_id and kind = 'baseline') then
    raise exception 'baseline_missing: % has no baseline snapshot, so growth cannot be reported. Capture the baseline first.', v_case.name
      using errcode = '23514';
  end if;

  if p_type in ('monthly_performance', 'quarterly_review') and (p_period_start is null or p_period_end is null) then
    raise exception 'period_required: a % document must state the period it covers', p_type using errcode = '23514';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), v_template.name);

  insert into public.document (
    case_file_id, type, template_id, template_version, title,
    period_start, period_end, include_effort, generated_by
  ) values (
    p_case_file_id, p_type, v_template.id, v_template.version, v_title,
    p_period_start, p_period_end, p_include_effort, auth.uid()
  ) returning * into v_doc;

  v_blocks := app.resolve_bindings(p_case_file_id, p_type, p_period_start, p_period_end, p_include_effort);

  for v_section in
    select * from public.document_template_section
    where template_id = v_template.id
      and (vertical is null or vertical = v_case.vertical)
    order by sort_order
  loop
    -- A bound source may address into a block, as in `install_summary.folders`.
    v_data := case
      when v_section.bound_source is null then null
      when position('.' in v_section.bound_source) > 0 then
        jsonb_build_object(
          'rows',
          coalesce(v_blocks #> string_to_array(v_section.bound_source, '.'), '[]'::jsonb)
        )
      else v_blocks -> v_section.bound_source
    end;

    insert into public.document_section (
      document_id, key, title, kind, sort_order, body, bound_data, has_gap
    ) values (
      v_doc.id,
      v_section.key,
      v_section.title,
      v_section.kind,
      v_section.sort_order,
      -- Fixed copy carries over. A narrative section starts empty: the prompt
      -- stays on the template so it never leaks into the document.
      case when v_section.kind = 'fixed' then v_section.body else null end,
      v_data,
      coalesce(app.has_gap(v_data), false)
    );
  end loop;

  return v_doc;
end;
$$;

-- Bound numbers can be refreshed but never overwritten, and only while the
-- document is still a draft.
create or replace function public.refresh_document_bindings(p_document_id uuid)
returns public.document
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.document;
  v_blocks jsonb;
  v_section record;
  v_data jsonb;
begin
  select * into v_doc from public.document where id = p_document_id;
  if v_doc.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  if v_doc.state <> 'draft' then
    raise exception 'refresh_requires_draft: this document is % and its numbers can no longer move', v_doc.state
      using errcode = '23514';
  end if;

  v_blocks := app.resolve_bindings(
    v_doc.case_file_id, v_doc.type, v_doc.period_start, v_doc.period_end, v_doc.include_effort
  );

  for v_section in
    select ts.key, ts.bound_source
    from public.document_template_section ts
    where ts.template_id = v_doc.template_id and ts.bound_source is not null
  loop
    v_data := case
      when position('.' in v_section.bound_source) > 0 then
        jsonb_build_object('rows', coalesce(v_blocks #> string_to_array(v_section.bound_source, '.'), '[]'::jsonb))
      else v_blocks -> v_section.bound_source
    end;

    update public.document_section
      set bound_data = v_data, has_gap = coalesce(app.has_gap(v_data), false)
    where document_id = v_doc.id and key = v_section.key;
  end loop;

  update public.document set generated_at = now() where id = v_doc.id returning * into v_doc;
  return v_doc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Narrative
-- ---------------------------------------------------------------------------

-- Rule 1, from the other direction: this is the only write path into a section
-- body, and it refuses anything that is not a narrative section. There is no way
-- to type over a bound number.
create or replace function public.set_document_narrative(
  p_document_id uuid,
  p_section_key text,
  p_body text
)
returns public.document_section
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state public.document_state;
  v_kind public.section_kind;
  v_row public.document_section;
begin
  select d.state, s.kind into v_state, v_kind
  from public.document_section s join public.document d on d.id = s.document_id
  where s.document_id = p_document_id and s.key = p_section_key;

  if v_kind is null then
    raise exception 'section_not_found: no "%" section on this document', p_section_key using errcode = 'P0002';
  end if;
  if v_kind <> 'narrative' then
    raise exception 'section_not_writable: "%" is a % section. Its content comes from the tracked record and cannot be typed.', p_section_key, v_kind
      using errcode = '23514';
  end if;
  if v_state <> 'draft' then
    raise exception 'narrative_requires_draft: this document is % and its narrative is closed', v_state
      using errcode = '23514';
  end if;

  update public.document_section
    set body = nullif(btrim(p_body), '')
  where document_id = p_document_id and key = p_section_key
  returning * into v_row;

  if not found then
    raise exception 'section_not_writable: you do not have permission to edit this document' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review, publish, correct, archive
-- ---------------------------------------------------------------------------

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

  -- The interpretation of the numbers is DA's judgment, so a required narrative
  -- section cannot be left empty.
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

  update public.document set state = 'in_review' where id = v_doc.id returning * into v_doc;
  return v_doc;
end;
$$;

-- Rule 3. At the moment of publication the document freezes, numbers included,
-- even though the underlying data keeps moving.
create or replace function public.publish_document(p_document_id uuid)
returns public.document
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.document;
  v_payload jsonb;
  v_accounts integer;
  v_link public.client_dashboard_link;
  v_notified integer;
begin
  select * into v_doc from public.document where id = p_document_id;
  if v_doc.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  if v_doc.state <> 'in_review' then
    raise exception 'publish_requires_review: a document is read in review before it is released. This one is %.', v_doc.state
      using errcode = '23514';
  end if;
  -- Case study drafts are internal and never publish to a client account.
  if v_doc.is_case_study then
    raise exception 'case_study_is_internal: a case study draft is an internal document and never publishes to a client'
      using errcode = '23514';
  end if;

  v_payload := app.document_payload(v_doc.id);

  update public.document
    set state = 'published',
        published_at = now(),
        published_by = auth.uid(),
        frozen_payload = v_payload
  where id = v_doc.id
  returning * into v_doc;

  if not found then
    raise exception 'publish_failed: you do not have permission to publish this document' using errcode = '42501';
  end if;

  select count(*) into v_accounts
  from public.client_account
  where case_file_id = v_doc.case_file_id and state = 'active';

  if v_accounts > 0 then
    insert into public.document_delivery (document_id, channel, status, detail)
    values (v_doc.id, 'account', 'delivered', 'Available at acct.vistrial.io');

    select count(*) into v_notified
    from public.client_account ca
    left join public.client_notification_pref p on p.profile_id = ca.profile_id
    where ca.case_file_id = v_doc.case_file_id
      and ca.state = 'active'
      and coalesce(p.report_published, true);

    if v_notified > 0 then
      insert into public.document_delivery (document_id, channel, status, detail)
      values (v_doc.id, 'email', 'queued', v_notified || ' recipient(s) with report notifications on');
    end if;
  else
    -- No account, so publication generates a time limited, revocable share link
    -- instead. Same document, same branding, same record of what was sent.
    v_link := public.create_dashboard_link(v_doc.case_file_id, v_doc.title, 30, null);

    update public.document set share_link_id = v_link.id where id = v_doc.id returning * into v_doc;

    insert into public.document_delivery (document_id, channel, status, detail)
    values (v_doc.id, 'share_link', 'delivered', 'Time limited link, expires ' || to_char(v_link.expires_at, 'FMDD Mon YYYY'));
  end if;

  return v_doc;
end;
$$;

-- Rule 4. A published document that turns out to be wrong is corrected by
-- publishing a new version with a visible note, never by editing the original.
-- Both versions stay in the record.
create or replace function public.correct_document(
  p_document_id uuid,
  p_correction_note text
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
  if nullif(btrim(coalesce(p_correction_note, '')), '') is null then
    raise exception 'correction_note_required: a corrected version carries a note saying what changed and why'
      using errcode = '23514';
  end if;
  if position(chr(8212) in p_correction_note) > 0 then
    raise exception 'em_dash_not_permitted: DA prose uses commas, colons, parentheses or full stops instead of em dashes'
      using errcode = '23514';
  end if;

  select * into v_old from public.document where id = p_document_id;
  if v_old.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  if v_old.state <> 'published' then
    raise exception 'correction_requires_published: only a published document needs correcting. This one is %.', v_old.state
      using errcode = '23514';
  end if;
  if v_old.superseded_by_id is not null then
    raise exception 'already_corrected: a corrected version of this document already exists' using errcode = '23514';
  end if;

  insert into public.document (
    case_file_id, type, template_id, template_version, title,
    period_start, period_end, include_effort, is_case_study, anonymised_descriptor,
    version, supersedes_id, correction_note, generated_by
  ) values (
    v_old.case_file_id, v_old.type, v_old.template_id, v_old.template_version, v_old.title,
    v_old.period_start, v_old.period_end, v_old.include_effort, v_old.is_case_study, v_old.anonymised_descriptor,
    v_old.version + 1, v_old.id, btrim(p_correction_note), auth.uid()
  ) returning * into v_new;

  -- The new draft starts from what was published, so the admin corrects rather
  -- than rewrites. Bound numbers can then be refreshed.
  insert into public.document_section (document_id, key, title, kind, sort_order, body, bound_data, has_gap)
  select v_new.id, s.key, s.title, s.kind, s.sort_order, s.body, s.bound_data, s.has_gap
  from public.document_section s where s.document_id = v_old.id;

  update public.document set superseded_by_id = v_new.id where id = v_old.id;

  return v_new;
end;
$$;

create or replace function public.archive_document(p_document_id uuid)
returns public.document
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.document;
begin
  update public.document
    set state = 'archived', archived_at = now()
  where id = p_document_id and state <> 'archived'
  returning * into v_doc;

  if not found then
    raise exception 'archive_failed: this document is already archived, or you do not have permission to archive it'
      using errcode = '42501';
  end if;

  return v_doc;
end;
$$;

create or replace function public.attach_document_to_drive(
  p_document_id uuid,
  p_drive_file_id text,
  p_drive_url text
)
returns public.document
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.document;
begin
  update public.document
    set drive_file_id = p_drive_file_id, drive_url = p_drive_url
  where id = p_document_id
  returning * into v_doc;

  if not found then
    raise exception 'attach_failed: you do not have permission to update this document' using errcode = '42501';
  end if;

  insert into public.document_delivery (document_id, channel, status, detail)
  values (p_document_id, 'drive', 'delivered', 'Saved to the client Reports folder');

  return v_doc;
end;
$$;

-- A client who has not opened three monthly reports is telling you something
-- before they cancel, so opens are recorded rather than inferred.
create or replace function public.record_document_open(
  p_document_id uuid,
  p_via text default 'account',
  p_user_agent text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.document_open (document_id, opened_by, via, user_agent)
  values (p_document_id, auth.uid(), coalesce(p_via, 'account'), p_user_agent);
end;
$$;
