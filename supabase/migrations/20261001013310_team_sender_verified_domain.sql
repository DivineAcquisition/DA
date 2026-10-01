-- notify.divineacquisition.io could not be added to Resend (plan domain limit), so team email
-- sends from the already-verified updates.divineacquisition.io until notify. exists.
-- Admins can change the address later; the sender is data, not code.
update public.team_setting
   set from_address = 'team@updates.divineacquisition.io', updated_at = now()
 where id = 1 and from_address = 'team@notify.divineacquisition.io';
alter table public.team_setting alter column from_address set default 'team@updates.divineacquisition.io';
