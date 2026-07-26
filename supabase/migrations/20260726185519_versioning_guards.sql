-- Rule 2: an append-only row may only ever acquire its superseded_by pointer.
-- Every other column is frozen, so a correction has to be a new version.
create or replace function app.guard_versioned_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.superseded_by_id is not null then
    raise exception '%_already_superseded: row % was already corrected by %; correct the current version instead', tg_table_name, old.id, old.superseded_by_id using errcode = '23514';
  end if;

  if to_jsonb(new) - 'superseded_by_id' <> to_jsonb(old) - 'superseded_by_id' then
    raise exception '%_is_immutable: row % cannot be edited. File a correction, which creates version %.', tg_table_name, old.id, old.version + 1 using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger effort_entry_guard_update
  before update on public.effort_entry
  for each row execute function app.guard_versioned_update();

create trigger decision_guard_update
  before update on public.decision
  for each row execute function app.guard_versioned_update();
