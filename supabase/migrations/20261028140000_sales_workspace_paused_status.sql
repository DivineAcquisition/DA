-- Sales Operator workspace, part 1 of 3: a placement can be paused.
--
-- Pending is the existing 'draft' value. A new enum value cannot be used in the
-- transaction that adds it, so this migration only adds it.
alter type public.placement_status add value if not exists 'paused' after 'active';
