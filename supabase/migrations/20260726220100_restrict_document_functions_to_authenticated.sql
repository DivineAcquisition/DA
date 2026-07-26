-- Revoking from `anon` does not remove a function's default `PUBLIC` grant, which
-- `anon` inherits, so the document functions were still reachable without a
-- session. The admin gate inside each one refused them, but a refusal is not a
-- reason to leave the door open.
--
-- `accept_client_invite` and `shared_dashboard` stay reachable by `anon` on
-- purpose: one is how a client redeems an invitation before they have an account,
-- the other is how a tokenised share link is read.

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.generate_document(uuid, public.document_type, date, date, boolean, text)',
    'public.refresh_document_bindings(uuid)',
    'public.set_document_narrative(uuid, text, text)',
    'public.submit_document_for_review(uuid)',
    'public.publish_document(uuid)',
    'public.correct_document(uuid, text)',
    'public.archive_document(uuid)',
    'public.attach_document_to_drive(uuid, text, text)',
    'public.create_case_study_draft(uuid, text)',
    'public.resolve_anonymisation_flag(uuid, text)',
    'public.mark_case_study_ready(uuid)',
    'public.record_document_open(uuid, text, text)'
  ]
  loop
    execute format('revoke all on function %s from public', v_signature);
    execute format('revoke all on function %s from anon', v_signature);
    execute format('grant execute on function %s to authenticated', v_signature);
  end loop;
end $$;
