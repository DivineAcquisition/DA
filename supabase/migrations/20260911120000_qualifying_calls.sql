-- ---------------------------------------------------------------------------
-- 15-minute qualifying call workspace (admin.divineacquisition.io).
-- Two tables. Administrator-only, matching the existing da_* RLS pattern.
-- ---------------------------------------------------------------------------

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 200),
  practice_name text not null check (length(btrim(practice_name)) between 1 and 200),
  practice_type text not null check (practice_type in ('dental', 'med_spa', 'both')),
  role text not null check (role in ('owner', 'practice_manager', 'other')),
  front_desk_size text not null check (front_desk_size in ('one', 'two', 'three_plus')),
  stated_pain text check (stated_pain is null or length(stated_pain) <= 5000),
  phone text check (phone is null or length(btrim(phone)) between 1 and 40),
  email text check (email is null or (position('@' in email) > 1 and length(email) <= 320)),
  source text check (source is null or length(btrim(source)) between 1 and 200),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'booked', 'not_booked', 'no_show')),
  outcome_note text check (outcome_note is null or length(outcome_note) <= 20000),
  audit_booked_at timestamptz,
  calendar_token text unique check (calendar_token is null or length(calendar_token) >= 32),
  calendar_sent_at timestamptz
);

comment on table public.calls is
  'Live 15-minute qualifying calls. The only goal is booking the 30-minute practice audit.';

create index calls_created_at_idx on public.calls (created_at desc);
create index calls_status_idx on public.calls (status, created_at desc);

create trigger calls_touch_updated_at before update on public.calls
  for each row execute function app.touch_updated_at();

create table public.call_answers (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  question_key text not null check (length(btrim(question_key)) between 1 and 80),
  answer_text text check (answer_text is null or length(answer_text) <= 20000),
  flagged boolean not null default false,
  unique (call_id, question_key)
);

comment on table public.call_answers is
  'Captured answers and flags for a qualifying call. Unique per call and question_key so autosave can upsert.';

create index call_answers_call_idx on public.call_answers (call_id);

alter table public.calls enable row level security;
alter table public.call_answers enable row level security;

create policy calls_admin_all on public.calls
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create policy call_answers_admin_all on public.call_answers
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

revoke all on public.calls from anon, authenticated;
revoke all on public.call_answers from anon, authenticated;

grant select, insert, update, delete on public.calls to authenticated;
grant select, insert, update, delete on public.call_answers to authenticated;

-- Reuse the existing public /c/[token] resolver. Call tokens are not a second
-- system: same createToken() length, same RPC, same redirect. Destination is
-- da_settings.default_booking_url — the brief does not name a booking URL.
create or replace function public.da_resolve_calendar_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_calendar_link%rowtype;
  v_dest text;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v_row from public.da_calendar_link where token = v_token;
  if found then
    if v_row.revoked or (v_row.expires_at is not null and v_row.expires_at <= now()) then
      return null;
    end if;

    update public.da_calendar_link
       set click_count = click_count + 1,
           first_clicked_at = coalesce(first_clicked_at, now()),
           last_clicked_at = now()
     where id = v_row.id;

    return jsonb_build_object(
      'destination_url', v_row.destination_url
    );
  end if;

  if exists (select 1 from public.calls where calendar_token = v_token) then
    select nullif(btrim(default_booking_url), '') into v_dest
      from public.da_settings
     where id = 1;
    if v_dest is null then
      return null;
    end if;
    return jsonb_build_object('destination_url', v_dest);
  end if;

  return null;
end;
$$;
