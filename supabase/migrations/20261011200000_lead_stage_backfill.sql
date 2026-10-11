-- Scored applications land on their stage (lib/acq/stages.ts stageForQualification).
-- Leads captured before that stayed on Step 1 Captured whatever their score.
update public.da_leads
   set stage = case qualification_result
                 when 'Qualified' then 'Qualified - Not Booked'
                 when 'Manual Review' then 'Manual Review'
                 when 'Disqualified' then 'Disqualified'
               end
 where stage = 'Step 1 Captured'
   and scheduled_for is null
   and qualification_result in ('Qualified', 'Manual Review', 'Disqualified');
