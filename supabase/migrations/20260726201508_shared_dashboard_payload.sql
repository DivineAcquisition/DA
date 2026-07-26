-- resolve_dashboard_link returned a case file id, but the follow-up reads ran as
-- anon with no policy, so a share link showed an empty dashboard. The token has
-- to be the authorization, which means one definer function that validates it and
-- returns the payload.
--
-- The boundary is enforced here, in one place: this function selects exactly the
-- fields A3 permits and nothing from A4. There is no effort log, no decisions, no
-- scope, no operator, no pay, no DA revenue and no unpublished report in the
-- shape it returns.
create or replace function public.shared_dashboard(
  p_token text,
  p_passphrase text default null,
  p_user_agent text default null,
  p_period_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.client_dashboard_link;
  v_case public.client_case_file;
  v_start date;
  v_end date := current_date;
begin
  select * into v_link from public.client_dashboard_link where token = p_token;

  if v_link.id is null then
    raise exception 'link_invalid: this link does not exist' using errcode = '42501';
  end if;
  if v_link.revoked_at is not null then
    raise exception 'link_revoked: this link was revoked on %', v_link.revoked_at::date using errcode = '42501';
  end if;
  if v_link.expires_at < now() then
    raise exception 'link_expired: this link expired on %', v_link.expires_at::date using errcode = '42501';
  end if;
  if v_link.password_hash is not null then
    if p_passphrase is null or extensions.crypt(p_passphrase, v_link.password_hash) <> v_link.password_hash then
      raise exception 'link_passphrase_required: this link is passphrase protected' using errcode = '42501';
    end if;
  end if;

  -- A6: every view is logged with a timestamp.
  insert into public.client_dashboard_link_view (link_id, user_agent) values (v_link.id, p_user_agent);
  update public.client_dashboard_link
     set view_count = view_count + 1, last_viewed_at = now()
   where id = v_link.id;

  select * into v_case from public.client_case_file where id = v_link.case_file_id;
  v_start := v_end - greatest(coalesce(p_period_days, 30), 1);

  return jsonb_build_object(
    'client', jsonb_build_object('name', v_case.name, 'vertical', v_case.vertical, 'status', v_case.status),
    'link', jsonb_build_object('label', v_link.label, 'expires_at', v_link.expires_at),
    'funnel', public.client_funnel(v_link.case_file_id, v_start, v_end),
    'growth', (
      select coalesce(jsonb_agg(to_jsonb(g) order by g.sort_order), '[]'::jsonb)
      from public.growth_for_case_file(v_link.case_file_id) g
    ),
    'milestones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'description', m.description, 'occurred_on', m.occurred_on
      ) order by m.occurred_on desc), '[]'::jsonb)
      from public.milestone m where m.case_file_id = v_link.case_file_id
    )
  );
end;
$$;

comment on function public.shared_dashboard is
  'A6. Deliberately anon-executable: the caller is an unauthenticated viewer holding a tokenized link, and the token is the authorization. Validates existence, revocation, expiry and passphrase, logs every view, and returns only the fields A3 permits.';

-- resolve_dashboard_link is superseded by the above.
drop function if exists public.resolve_dashboard_link(text, text, text);
