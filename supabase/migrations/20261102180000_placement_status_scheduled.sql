-- Scheduled is a committed placement whose shift has not started.
-- The value is added in its own migration so later statements can use it.
alter type public.placement_status add value if not exists 'scheduled' after 'draft';
