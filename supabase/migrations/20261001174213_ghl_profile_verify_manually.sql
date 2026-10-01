-- Two VA rules the GHL Users API has no field for, flagged for manual checking.
update public.ghl_permission_profile
   set verify_manually = verify_manually || array[
     'Conversation delete is off (no API field: check the role in GHL)',
     'Contacts limited to assigned plus the shared queue: the API only has "assigned data only" (all or assigned), so it is left off and routing assigns owners; confirm visibility in GHL'
   ]
 where key = 'va' and not ('Conversation delete is off (no API field: check the role in GHL)' = any(verify_manually));

update public.ghl_permission_profile
   set verify_manually = verify_manually || array['Conversation delete is off (no API field: check the role in GHL)']
 where key = 'manager' and not ('Conversation delete is off (no API field: check the role in GHL)' = any(verify_manually));
