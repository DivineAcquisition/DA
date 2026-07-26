-- A rewrite rescans the draft, because replacing one reference can introduce
-- another. Without a uniqueness guard that rescan re-flagged references the admin
-- had already decided on, so the outstanding count climbed as the admin worked
-- through the list. One flag per snippet per section is enough.

delete from public.anonymisation_flag
where id in (
  select id from (
    select id, row_number() over (
      partition by document_id, section_key, lower(snippet)
      order by confirmed_at nulls last, created_at
    ) as rn
    from public.anonymisation_flag
  ) ranked
  where rn > 1
);

create unique index anonymisation_flag_unique_snippet
  on public.anonymisation_flag (document_id, section_key, lower(snippet));

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
        values (p_document_id, v_section.key, 'client_name', v_needle, nullif(v_descriptor, ''))
        on conflict do nothing;
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
          values (p_document_id, v_section.key, 'person', v_needle, 'the owner')
          on conflict do nothing;
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
      if v_needle is not null and length(v_needle) > 3 and v_needle <> v_case.name then
        insert into public.anonymisation_flag (document_id, section_key, kind, snippet, suggestion)
        values (p_document_id, v_section.key, 'other', v_needle, null)
        on conflict do nothing;
        v_count := v_count + 1;
      end if;
    end loop;

    -- Web addresses and email domains identify a business immediately.
    for v_match in
      select m from regexp_matches(v_section.body, '([A-Za-z0-9-]+\.(?:com|co|net|org|io|us)\y)', 'g') as m
    loop
      insert into public.anonymisation_flag (document_id, section_key, kind, snippet, suggestion)
      values (p_document_id, v_section.key, 'brand', btrim(v_match[1]), null)
      on conflict do nothing;
      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;
