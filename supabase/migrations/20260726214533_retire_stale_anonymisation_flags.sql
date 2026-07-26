-- Found by working a real case study draft through the interface. The scanner
-- flags "Lumen Aesthetics" and also "Lumen" and "Aesthetics" on their own, which
-- is right, because either part alone still identifies the client. But resolving a
-- part before the whole rewrote a fragment and left the prose reading "The
-- practice the practice went from answering...".
--
-- Two things fix it together: the panel now offers the longest snippet first, and
-- a rewrite retires any outstanding flag whose text is no longer in the section. A
-- flag for words that are not there is not a decision anyone needs to make.
create or replace function public.resolve_anonymisation_flag(
  p_flag_id uuid,
  p_replacement text default null
)
returns public.anonymisation_flag
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_flag public.anonymisation_flag;
  v_state public.document_state;
  v_body text;
begin
  perform app.require_admin('resolving an anonymisation flag');

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
      set body = replace(v_body, v_flag.snippet, btrim(p_replacement))
    where document_id = v_flag.document_id and key = v_flag.section_key;
  end if;

  update public.anonymisation_flag
    set confirmed_at = now(), confirmed_by = auth.uid()
  where id = p_flag_id
  returning * into v_flag;

  if nullif(btrim(coalesce(p_replacement, '')), '') is not null then
    -- A rewrite can introduce a fresh identifier, so the section is rescanned.
    perform app.flag_identifiers(v_flag.document_id);

    -- And it can remove several at once: rewriting the business name in full also
    -- removes every part of it.
    delete from public.anonymisation_flag f
    using public.document_section s
    where f.document_id = v_flag.document_id
      and f.section_key = v_flag.section_key
      and f.confirmed_at is null
      and s.document_id = f.document_id
      and s.key = f.section_key
      and coalesce(s.body, '') not ilike '%' || f.snippet || '%';
  end if;

  return v_flag;
end;
$$;

revoke all on function public.resolve_anonymisation_flag(uuid, text) from anon;
