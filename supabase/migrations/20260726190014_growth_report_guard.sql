drop trigger if exists growth_report_immutable on public.growth_report;

-- Rule 7: the payload and the period are frozen at generation. The Drive
-- reference is the one thing that can still be written, once, because the file
-- is uploaded immediately after the row is created.
create or replace function app.guard_growth_report_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - 'drive_file_id' - 'drive_url' <> to_jsonb(old) - 'drive_file_id' - 'drive_url' then
    raise exception 'growth_report_is_immutable: a generated report is archived exactly as it was sent. Generate a new one instead.' using errcode = '23514';
  end if;

  if old.drive_file_id is not null and new.drive_file_id is distinct from old.drive_file_id then
    raise exception 'growth_report_already_filed: report % is already filed in Drive as %', old.id, old.drive_file_id using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger growth_report_guard_update
  before update on public.growth_report
  for each row execute function app.guard_growth_report_update();

create trigger growth_report_guard_delete
  before delete on public.growth_report
  for each row execute function app.forbid_mutation();
