-- The training playbook simulation (moved out of lib/portal/sample.ts) and its one reader.
comment on table training.simulation is
  'Training simulation content (Agreement 3.2). Invented, non-live data. Read only by public.portal_training_playbook, and only for VAs in the training stage. No live function, report, metric, pay or GHL path reads this schema.';

alter table training.simulation enable row level security;
revoke all on training.simulation from public, anon, authenticated;

insert into training.simulation (key, kind, content) values ('playbook', 'playbook', jsonb_build_object(
  'placement_id', 'training',
  'available', true,
  'exists', true,
  'client_name', 'Sample Smile Studio (training simulation)',
  'business_name', 'Sample Smile Studio',
  'offer', 'Family and cosmetic dentistry. New-patient exam with X-rays and cleaning; teeth whitening; Invisalign consultations.',
  'locations', '100 Example Avenue, Springfield (simulated address, not real)',
  'hours', 'Monday to Friday 8:00 AM to 6:00 PM, Saturday 9:00 AM to 1:00 PM',
  'qualifies', 'A Confirmed Booking is a new patient with a date and time on the calendar, a valid phone number, and the reason for the visit noted.',
  'disqualifiers', 'Under 18 without a parent on the call. Asking only for a price over text with no intent to book. Out of area.',
  'handoff_method', 'calendar',
  'handoff_steps', E'1. Confirm name, phone and reason for visit.\n2. Offer the two soonest slots.\n3. Book it on the calendar and read back the time.\n4. Send the confirmation template.',
  'escalation_contacts', E'Clinical questions (pain, swelling, medication): escalate as Clinical; the office answers within 4 hours.\nPricing exceptions: escalate as Pricing exception.',
  'never_say', 'Never diagnose or suggest treatment. Never promise a price that is not listed below. Never say a procedure is painless.',
  'approved_pricing', 'New-patient special: $99 exam, X-rays and cleaning (simulated figure).',
  'holding_lines', jsonb_build_array(
    'Great question. Let me confirm that with the team and get right back to you.',
    'I want to make sure you get the right answer, so I am checking with the office now.'),
  'scripts', '[]'::jsonb,
  'has_override', false,
  'version', 1,
  'updated_at', null,
  'updated_by', null
)) on conflict (key) do nothing;

create or replace function public.portal_training_playbook()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
begin
  if app.operator_stage(v_op) <> 'training' then
    raise exception 'not_training: training simulations are for the training stage only' using errcode = '42501';
  end if;
  return (select content || jsonb_build_object('label', label) from training.simulation where key = 'playbook');
end;
$$;

revoke all on function public.portal_training_playbook() from public, anon;
grant execute on function public.portal_training_playbook() to authenticated;

