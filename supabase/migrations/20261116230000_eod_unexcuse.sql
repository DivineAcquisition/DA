-- Undo an excused day: the EOD for that day is due again. Staff can excuse a
-- day (so_excuse_days); until now nothing could take that back.

create or replace function public.so_unexcuse_day(p_placement uuid, p_date date, p_reason text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_eod public.sales_eod;
  v_removed integer;
begin
  perform app.so_require_staff();
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'required: say why this day is no longer excused' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = p_placement and placement_type is not null;
  if v_pl.id is null then
    raise exception 'not_found: that is not a workspace placement' using errcode = 'P0002';
  end if;

  delete from public.sales_excused_day where placement_id = v_pl.id and work_date = p_date;
  get diagnostics v_removed = row_count;
  if v_removed = 0 then
    return false;
  end if;

  select * into v_eod from public.sales_eod where placement_id = v_pl.id and work_date = p_date;
  if v_eod.id is not null and v_eod.status = 'excused' then
    update public.sales_eod
       set status = coalesce(prior_status, 'not_started'), prior_status = null
     where id = v_eod.id;
    insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
    values (v_eod.id, 'excused', coalesce(v_eod.prior_status, 'not_started'), 'unexcused', btrim(p_reason));
  end if;
  if v_eod.id is null or v_eod.submitted_at is null then
    update public.operator_task
       set completed_on = null, completed_at = null
     where placement_id = v_pl.id
       and system_key = 'eod:' || p_date::text;
  end if;

  perform app.audit('workspace.eod.unexcused', 'sales_excused_day', v_pl.id::text,
    format('Removed the excuse for %s', p_date), null,
    jsonb_build_object('work_date', p_date, 'reason', btrim(p_reason)), v_pl.case_file_id);
  return true;
end;
$$;

revoke all on function public.so_unexcuse_day(uuid, date, text) from public, anon;
grant execute on function public.so_unexcuse_day(uuid, date, text) to authenticated;
