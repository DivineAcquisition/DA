create or replace trigger ld_proposal_amount before insert on public.ld_proposal
  for each row execute function app.ld_amount_from_settings();
