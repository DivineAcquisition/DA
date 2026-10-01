-- Team email: DivineACQ Team <updates@divineacquisition.io>, replies to support@divineacquisition.io.
update public.team_setting
   set from_name = 'DivineACQ Team',
       from_address = 'updates@divineacquisition.io',
       reply_to = 'support@divineacquisition.io',
       updated_at = now()
 where id = 1;
alter table public.team_setting alter column from_name set default 'DivineACQ Team';
alter table public.team_setting alter column from_address set default 'updates@divineacquisition.io';
