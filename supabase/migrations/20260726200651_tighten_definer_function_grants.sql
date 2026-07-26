-- accept_client_invite needs auth.uid(), so anon can never succeed at it. Taking
-- the grant away makes that explicit rather than relying on the function raising.
revoke all on function public.accept_client_invite(text) from anon;

-- resolve_dashboard_link stays callable by anon on purpose: A6 exists precisely
-- so a client who will not create an account can open a tokenized link, and an
-- unauthenticated viewer is the only caller it will ever have. The security
-- property is the token, which is 24 random bytes, plus the checks inside: it
-- verifies the link exists, is not revoked, has not expired, and matches the
-- passphrase, logs the view, and returns a case file id and nothing else. The
-- security advisor will keep flagging this; the flag is expected.
comment on function public.resolve_dashboard_link is
  'A6. Deliberately anon-executable: the caller is an unauthenticated viewer holding a tokenized link. Validates existence, revocation, expiry and passphrase, logs every view, and returns only a case file id -- never client data.';
