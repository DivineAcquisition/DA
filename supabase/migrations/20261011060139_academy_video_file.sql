-- Lesson videos can be a private file in academy-documents, or a Vimeo/Mux link.
-- The file path stays on the server. Trainees and admins receive a provider and a page URL only.

create or replace function app.academy_lesson_payload(p_enrollment_id uuid, p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson public.academy_lesson;
  v_module public.academy_module;
  v_video public.academy_asset;
  v_doc public.academy_asset;
  v_progress public.academy_progress;
  v_total integer;
  v_prev uuid;
  v_next uuid;
begin
  select * into v_lesson from public.academy_lesson where id = p_lesson_id;
  select * into v_module from public.academy_module where id = v_lesson.module_id;
  select * into v_video from public.academy_asset where id = v_lesson.video_asset_id;
  select * into v_doc from public.academy_asset where id = v_lesson.document_asset_id;
  select * into v_progress from public.academy_progress
  where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;
  select count(*) into v_total from public.academy_lesson
  where module_id = v_module.id and published and archived_at is null;
  select id into v_prev from public.academy_lesson
  where module_id = v_module.id and published and archived_at is null and sort_order < v_lesson.sort_order
  order by sort_order desc limit 1;
  select id into v_next from public.academy_lesson
  where module_id = v_module.id and published and archived_at is null and sort_order > v_lesson.sort_order
  order by sort_order limit 1;

  return jsonb_build_object(
    'id', v_lesson.id,
    'code', v_lesson.lesson_code,
    'title', v_lesson.title,
    'body', v_lesson.body,
    'position', 1 + (
      select count(*) from public.academy_lesson earlier
      where earlier.module_id = v_module.id
        and earlier.published
        and earlier.archived_at is null
        and earlier.sort_order < v_lesson.sort_order
    ),
    'total', v_total,
    'module_id', v_module.id,
    'module_title', v_module.title,
    'module_order', v_module.order_number,
    'watch_percent', v_lesson.required_watch_percent,
    'reading_seconds', app.academy_reading_seconds(v_lesson.body),
    'video', case when v_video.id is null then null else jsonb_build_object(
      'provider', v_video.provider,
      'provider_id', v_video.provider_id,
      'url', v_video.video_url,
      'duration', v_video.duration_seconds,
      'file', v_video.provider = 'file'
    ) end,
    'document', v_doc.id is not null,
    'document_name', v_doc.file_name,
    'position_seconds', coalesce(v_progress.playback_position_seconds, 0),
    'watched_seconds', coalesce(v_progress.watched_seconds, 0),
    'reading_done', coalesce(v_progress.reading_seconds, 0),
    'scrolled', coalesce(v_progress.scrolled_to_end, false),
    'document_opened', v_progress.document_opened_at is not null
      and v_progress.document_asset_id is not distinct from v_lesson.document_asset_id,
    'missing', to_jsonb(app.academy_completion_gaps(p_enrollment_id, p_lesson_id)),
    'complete', v_progress.status = 'completed' and v_progress.completed_version = v_lesson.content_version,
    'prev_id', v_prev,
    'next_id', v_next,
    'next_open', v_next is not null and app.academy_lesson_open(p_enrollment_id, v_next)
  );
end;
$$;

create or replace function public.academy_admin_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_lesson;
  v_video public.academy_asset;
  v_doc public.academy_asset;
  v_module public.academy_module;
  v_done integer;
begin
  perform app.academy_require_manage();
  select * into v from public.academy_lesson where id = p_lesson_id;
  if v.id is null then
    return jsonb_build_object('state', 'missing');
  end if;
  select * into v_module from public.academy_module where id = v.module_id;
  select * into v_video from public.academy_asset where id = v.video_asset_id;
  select * into v_doc from public.academy_asset where id = v.document_asset_id;
  select count(*) into v_done from public.academy_progress where lesson_id = v.id and status = 'completed';
  return jsonb_build_object(
    'state', 'ok',
    'id', v.id,
    'module_id', v.module_id,
    'module_title', v_module.title,
    'module_order', v_module.order_number,
    'code', v.lesson_code,
    'title', v.title,
    'body', v.body,
    'order', v.sort_order,
    'position', 1 + (
      select count(*) from public.academy_lesson earlier
      where earlier.module_id = v.module_id
        and earlier.archived_at is null
        and (earlier.published or earlier.id = v.id)
        and earlier.sort_order < v.sort_order
    ),
    'total', (
      select count(*) from public.academy_lesson earlier
      where earlier.module_id = v.module_id
        and earlier.archived_at is null
        and (earlier.published or earlier.id = v.id)
    ),
    'status', v.status,
    'version', v.content_version,
    'watch_percent', v.required_watch_percent,
    'archived', v.archived_at is not null,
    'completions', v_done,
    'reading_seconds', app.academy_reading_seconds(v.body),
    'video', case when v_video.id is null then null else jsonb_build_object(
      'provider', v_video.provider, 'provider_id', v_video.provider_id, 'url', v_video.video_url,
      'duration', v_video.duration_seconds, 'version', v_video.version,
      'file', v_video.provider = 'file', 'file_name', v_video.file_name
    ) end,
    'document', case when v_doc.id is null then null else jsonb_build_object(
      'file_name', v_doc.file_name, 'version', v_doc.version, 'storage_path', v_doc.storage_path
    ) end,
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'version', ver.version, 'title', ver.title, 'status', ver.status,
        'policy', ver.completion_policy, 'at', ver.created_at
      ) order by ver.version desc)
      from public.academy_lesson_version ver
      where ver.lesson_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_save_lesson(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_module uuid := (p_payload ->> 'module_id')::uuid;
  v_code text := upper(btrim(p_payload ->> 'lesson_code'));
  v_title text := btrim(p_payload ->> 'title');
  v_body text := coalesce(p_payload ->> 'body', '');
  v_order integer := coalesce((p_payload ->> 'sort_order')::integer, 1);
  v_watch_given boolean := nullif(p_payload ->> 'required_watch_percent', '') is not null;
  v_watch integer := coalesce(nullif(p_payload ->> 'required_watch_percent', '')::integer, (select default_watch_percent from public.academy_setting where id = 1));
  v_status text := lower(coalesce(p_payload ->> 'status', 'draft'));
  v_policy text := nullif(p_payload ->> 'completion_policy', '');
  v_old public.academy_lesson;
  v_video jsonb := p_payload -> 'video';
  v_doc jsonb := p_payload -> 'document';
  v_content_changed boolean := false;
  v_completed integer := 0;
  v_video_id uuid;
  v_doc_id uuid;
  v_asset uuid;
  v_version integer;
  v_is_new boolean := false;
  v_effective_title text;
begin
  perform app.academy_require_manage();
  if v_status not in ('draft', 'ready', 'live') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  if v_watch is null or v_watch < 1 or v_watch > 100 then
    raise exception 'bad_watch_percent' using errcode = '22023';
  end if;
  if not app.academy_code_matches(v_module, v_code) then
    raise exception 'bad_lesson_id: % does not match its module', v_code using errcode = '22023';
  end if;
  if exists (
    select 1 from public.academy_lesson
    where lesson_code = v_code and archived_at is null and id is distinct from v_id
  ) then
    raise exception 'duplicate_lesson_id: % is already used', v_code using errcode = '23505';
  end if;

  if v_id is null then
    insert into public.academy_lesson (module_id, lesson_code, sort_order, title, body, required_watch_percent, status, content_version)
    values (v_module, v_code, v_order, coalesce(nullif(v_title, ''), 'Untitled'), v_body, v_watch, 'draft', 1)
    returning id into v_id;
    v_is_new := true;
    perform app.audit('academy.lesson_created', 'academy_lesson', v_id::text, 'Created ' || v_code, null,
      jsonb_build_object('lesson_code', v_code, 'title', v_title));
  end if;

  select * into v_old from public.academy_lesson where id = v_id;
  if not v_watch_given then
    v_watch := v_old.required_watch_percent;
  end if;
  v_video_id := v_old.video_asset_id;
  v_doc_id := v_old.document_asset_id;

  if coalesce(p_payload ->> 'clear_video', '') = 'true'
     and v_old.video_asset_id is not null
     and (v_video is null or jsonb_typeof(v_video) is distinct from 'object') then
    v_content_changed := true;
    v_video_id := null;
  elsif v_video is not null and jsonb_typeof(v_video) = 'object' then
    if coalesce(v_video ->> 'provider', '') = 'file' then
      if coalesce(v_video ->> 'provider_id', '') !~ '^[A-Za-z0-9_-]{6,128}$'
         or coalesce(v_video ->> 'storage_path', '') !~ '^M[0-9]{2}-L[0-9]{2}/video/[0-9]{10,16}/[A-Za-z0-9._-]{1,120}$'
         or position('..' in coalesce(v_video ->> 'storage_path', '')) > 0
         or left(v_video ->> 'storage_path', length(v_code) + 7) is distinct from (v_code || '/video/') then
        raise exception 'bad_video: that video file path is not valid' using errcode = '22023';
      end if;
      if v_old.video_asset_id is null
         or (select storage_path from public.academy_asset where id = v_old.video_asset_id) is distinct from (v_video ->> 'storage_path')
         or (select duration_seconds from public.academy_asset where id = v_old.video_asset_id) is distinct from nullif(v_video ->> 'duration_seconds', '')::integer then
        v_content_changed := true;
        insert into public.academy_asset (
          lesson_id, asset_type, provider, provider_id, storage_path, file_name, duration_seconds, status, version, uploaded_by
        )
        values (
          v_id, 'video', 'file', v_video ->> 'provider_id', v_video ->> 'storage_path',
          nullif(v_video ->> 'file_name', ''),
          nullif(v_video ->> 'duration_seconds', '')::integer, 'live',
          coalesce((select version + 1 from public.academy_asset where id = v_old.video_asset_id), 1),
          auth.uid()
        )
        returning id into v_asset;
        if v_old.video_asset_id is not null then
          update public.academy_asset set superseded_by = v_asset where id = v_old.video_asset_id;
          perform app.audit('academy.video_replaced', 'academy_asset', v_asset::text, 'Replaced the video on ' || v_code, null,
            jsonb_build_object('file_name', v_video ->> 'file_name'));
        else
          perform app.audit('academy.video_uploaded', 'academy_asset', v_asset::text, 'Uploaded the video on ' || v_code, null,
            jsonb_build_object('file_name', v_video ->> 'file_name'));
        end if;
        v_video_id := v_asset;
      end if;
    else
      if coalesce(v_video ->> 'provider', '') not in ('vimeo', 'mux')
         or coalesce(v_video ->> 'provider_id', '') !~ '^[A-Za-z0-9_-]{6,128}$' then
        raise exception 'bad_video: use a Vimeo link, a Mux link, or an uploaded video file' using errcode = '22023';
      end if;
      if v_old.video_asset_id is null
         or (select provider_id from public.academy_asset where id = v_old.video_asset_id) is distinct from (v_video ->> 'provider_id')
         or (select duration_seconds from public.academy_asset where id = v_old.video_asset_id) is distinct from nullif(v_video ->> 'duration_seconds', '')::integer
         or (
           v_video ? 'url'
           and (select video_url from public.academy_asset where id = v_old.video_asset_id) is distinct from nullif(v_video ->> 'url', '')
         ) then
        v_content_changed := true;
        insert into public.academy_asset (lesson_id, asset_type, provider, provider_id, video_url, duration_seconds, status, version, uploaded_by)
        values (
          v_id, 'video', v_video ->> 'provider', v_video ->> 'provider_id', nullif(v_video ->> 'url', ''),
          nullif(v_video ->> 'duration_seconds', '')::integer, 'live',
          coalesce((select version + 1 from public.academy_asset where id = v_old.video_asset_id), 1),
          auth.uid()
        )
        returning id into v_asset;
        if v_old.video_asset_id is not null then
          update public.academy_asset set superseded_by = v_asset where id = v_old.video_asset_id;
          perform app.audit('academy.video_replaced', 'academy_asset', v_asset::text, 'Replaced the video on ' || v_code);
        end if;
        v_video_id := v_asset;
      end if;
    end if;
  end if;

  if v_doc is not null and jsonb_typeof(v_doc) = 'object' and nullif(v_doc ->> 'storage_path', '') is not null then
    if v_old.document_asset_id is null
       or (select storage_path from public.academy_asset where id = v_old.document_asset_id) is distinct from (v_doc ->> 'storage_path') then
      v_content_changed := true;
      insert into public.academy_asset (lesson_id, asset_type, provider, storage_path, file_name, status, version, uploaded_by)
      values (
        v_id, 'document', 'file', v_doc ->> 'storage_path', nullif(v_doc ->> 'file_name', ''), 'live',
        coalesce((select version + 1 from public.academy_asset where id = v_old.document_asset_id), 1),
        auth.uid()
      )
      returning id into v_asset;
      if v_old.document_asset_id is not null then
        update public.academy_asset set superseded_by = v_asset where id = v_old.document_asset_id;
        perform app.audit('academy.document_replaced', 'academy_asset', v_asset::text, 'Replaced the document on ' || v_code, null,
          jsonb_build_object('file_name', v_doc ->> 'file_name'));
      else
        perform app.audit('academy.document_uploaded', 'academy_asset', v_asset::text, 'Uploaded the document on ' || v_code, null,
          jsonb_build_object('file_name', v_doc ->> 'file_name'));
      end if;
      v_doc_id := v_asset;
    end if;
  end if;

  if v_body is distinct from v_old.body then
    v_content_changed := true;
  end if;

  v_effective_title := coalesce(nullif(v_title, ''), v_old.title, '');
  if v_status = 'live' then
    if nullif(btrim(v_title), '') is null or (btrim(v_body) = '' and v_video_id is null) then
      raise exception 'live_incomplete: a live lesson needs a title and a video or a written lesson' using errcode = '23514';
    end if;
    if v_video_id is not null and (select duration_seconds from public.academy_asset where id = v_video_id) is null then
      raise exception 'live_incomplete: enter the video duration before it goes live' using errcode = '23514';
    end if;
  end if;

  select count(*) into v_completed
  from public.academy_progress
  where lesson_id = v_id and status = 'completed';

  if v_content_changed and v_completed > 0 and (v_old.status = 'live' or v_status = 'live') and v_policy is null then
    raise exception 'review_choice_required: choose whether completed trainees keep this lesson or review it again' using errcode = 'P0001';
  end if;
  if v_policy is not null and v_policy not in ('keep', 'review') then
    raise exception 'bad_completion_policy' using errcode = '22023';
  end if;

  if v_content_changed and not v_is_new then
    perform app.academy_snapshot_lesson(v_id, null);
    v_version := v_old.content_version + 1;
  else
    v_version := v_old.content_version;
  end if;

  update public.academy_lesson
  set module_id = v_module,
      lesson_code = v_code,
      sort_order = v_order,
      title = v_effective_title,
      body = v_body,
      required_watch_percent = v_watch,
      status = v_status,
      video_asset_id = v_video_id,
      document_asset_id = v_doc_id,
      content_version = v_version
  where id = v_id;

  perform app.academy_snapshot_lesson(v_id, case when v_content_changed then v_policy else null end);

  if v_content_changed and v_policy = 'review' then
    update public.academy_progress
    set status = 'in_progress', completed_at = null, completed_version = null
    where lesson_id = v_id and status = 'completed';
  elsif v_content_changed and v_policy = 'keep' then
    update public.academy_progress
    set completed_version = v_version
    where lesson_id = v_id and status = 'completed';
  end if;

  if not v_is_new then
    perform app.audit(
      case
        when v_old.status is distinct from v_status and v_status = 'live' then 'academy.lesson_published'
        when v_old.status = 'live' and v_status is distinct from 'live' then 'academy.lesson_unpublished'
        else 'academy.lesson_edited'
      end,
      'academy_lesson', v_id::text,
      'Updated ' || v_code,
      jsonb_build_object('status', v_old.status, 'version', v_old.content_version),
      jsonb_build_object('status', v_status, 'version', v_version, 'completion_policy', v_policy)
    );
  end if;

  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;


create or replace function public.academy_lesson_video(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_video public.academy_asset;
  v_enrollment public.academy_enrollment;
begin
  select a.* into v_video
  from public.academy_lesson l
  join public.academy_asset a on a.id = l.video_asset_id
  where l.id = p_lesson_id;
  if not found or v_video.id is null then
    return null;
  end if;
  if not app.academy_manages() then
    v_enrollment := app.academy_primary_for_actor();
    if v_enrollment.id is null
       or not app.academy_content_open(v_enrollment.id)
       or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
      return null;
    end if;
  end if;
  return jsonb_build_object(
    'provider', v_video.provider,
    'provider_id', v_video.provider_id,
    'url', v_video.video_url,
    'duration', v_video.duration_seconds,
    'file', v_video.provider = 'file'
  );
end;
$$;

comment on function public.academy_lesson_video(uuid) is
  'Video metadata for an admin, or for a trainee who can open the lesson. Never includes the storage path.';

create or replace function public.academy_lesson_video_file(p_lesson_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_video public.academy_asset;
  v_enrollment public.academy_enrollment;
begin
  select a.* into v_video
  from public.academy_lesson l
  join public.academy_asset a on a.id = l.video_asset_id
  where l.id = p_lesson_id
    and a.provider = 'file'
    and a.storage_path is not null;
  if not found or v_video.id is null then
    return null;
  end if;
  if not app.academy_manages() then
    v_enrollment := app.academy_primary_for_actor();
    if v_enrollment.id is null
       or not app.academy_content_open(v_enrollment.id)
       or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
      return null;
    end if;
  end if;
  return v_video.storage_path;
end;
$$;

comment on function public.academy_lesson_video_file(uuid) is
  'Storage path for an uploaded lesson video. The app signs a short-lived URL from this. Draft and locked lessons return null.';

revoke all on function public.academy_lesson_video(uuid) from public, anon;
revoke all on function public.academy_lesson_video_file(uuid) from public, anon;
grant execute on function public.academy_lesson_video(uuid) to authenticated;
grant execute on function public.academy_lesson_video_file(uuid) to authenticated;

-- Uploaded lesson videos share the private document bucket. Raise its cap so a
-- 100 MB file is accepted when the project limit allows it.
do $bucket$
begin
  if to_regclass('storage.buckets') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit'
     ) then
    update storage.buckets
    set file_size_limit = 104857600
    where id = 'academy-documents'
      and (file_size_limit is null or file_size_limit < 104857600);
  end if;
end
$bucket$;
