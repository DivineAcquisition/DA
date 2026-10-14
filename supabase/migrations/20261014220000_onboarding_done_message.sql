-- After sales-operator onboarding, do not send them into training. Their
-- Divine Acquisition email is still being created, and the Academy invite
-- goes out separately.

update public.da_onboarding_protocol
   set next_steps = 'Your Divine Acquisition email is being created. An Academy invite will be sent to you shortly.'
 where recipient_type = 'operator';
