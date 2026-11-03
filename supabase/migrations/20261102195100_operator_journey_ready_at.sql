-- hire_refresh records when an operator first becomes Ready. The column was
-- referenced by that function and never added to operator_journey, so activating
-- a placement failed while moving the hire stage.

alter table public.operator_journey
  add column if not exists ready_at timestamptz;

comment on column public.operator_journey.ready_at is
  'When the operator first became Ready to place.';
