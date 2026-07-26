-- Rule 7 still holds: the payload and period are frozen at generation. Filing the
-- Drive reference and publishing to the client are the two things that can still
-- be written, each once, because neither changes what the report says.
create or replace function app.guard_growth_report_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - 'drive_file_id' - 'drive_url' - 'published_to_client_at' - 'published_by'
     <> to_jsonb(old) - 'drive_file_id' - 'drive_url' - 'published_to_client_at' - 'published_by' then
    raise exception 'growth_report_is_immutable: a generated report is archived exactly as it was sent. Generate a new one instead.' using errcode = '23514';
  end if;

  if old.drive_file_id is not null and new.drive_file_id is distinct from old.drive_file_id then
    raise exception 'growth_report_already_filed: report % is already filed in Drive as %', old.id, old.drive_file_id using errcode = '23514';
  end if;

  -- Publishing is one-way. Unpublishing a report a client has already seen would
  -- be rewriting what happened.
  if old.published_to_client_at is not null and new.published_to_client_at is null then
    raise exception 'report_already_published: report % was published on % and cannot be unpublished', old.id, old.published_to_client_at::date using errcode = '23514';
  end if;

  return new;
end;
$$;
