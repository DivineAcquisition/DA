#!/usr/bin/env bash
#
# Exercises the machine doors over real HTTP: the Next.js route handler, through
# supabase-js, through PostgREST, into Postgres. Asserts on what actually landed.
#
# Usage:  supabase/verify/http.sh
#
# It needs three things running, and starts none of them for you:
#
#   1. Postgres on 5433 with the chain applied and seeded:
#        supabase/verify/run.sh --keep      (then rename, or see local/seed_http.sql)
#   2. PostgREST on 3002 against that database, plus local/supabase-shim.mjs on
#      3001 to translate the Supabase gateway path and strip the non-JWT bearer.
#   3. The app on 3000 pointed at the shim:
#        NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3001 \
#        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=anything npm run dev
#
# See README.md in this directory for the full sequence.
set -uo pipefail

BASE=${BASE:-http://127.0.0.1:3000}
DB=${DB:-vistrial_verify}
PORT=${PORT:-5433}

Q() { sudo -u postgres psql -p "$PORT" -d "$DB" -tAc "$1" | tr -d ' '; }

GHL_KEY=$(Q "select key from door where name='ghl'")
GHL_SECRET=$(Q "select secret from door where name='ghl'")
PAY_KEY=$(Q "select key from door where name='pay'")
PAY_SECRET=$(Q "select secret from door where name='pay'")

if [[ -z "$GHL_KEY" ]]; then
  echo "No doors in $DB. Apply local/seed_http.sql first." >&2
  exit 1
fi

# The checks below count rows, so they only mean anything against a database that
# has taken no deliveries yet. Deduplication makes a second run over the same one
# fail in a way that looks like a regression and is not.
if [[ "$(Q 'select count(*) from ingest_event')" != "0" ]]; then
  echo "$DB has already taken deliveries. Rebuild and reseed before running again:" >&2
  echo "  supabase/verify/run.sh --schema-only" >&2
  echo "  sudo -u postgres psql -p $PORT -d $DB -f supabase/verify/local/seed_http.sql" >&2
  exit 1
fi

# PostgREST caches the schema and reconnects its pool after the database is
# rebuilt, so wait for it to catch up. Without this the first few checks come back
# as 503s, which looks like a regression and is not.
#
# The probe knocks with an unknown key rather than a wrong secret: the refusal it
# records is 'unknown_endpoint', which is not a reason any check below counts, and
# ingest_auth_failure is append only so it could not be tidied up afterwards.
for _ in $(seq 30); do
  probe=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    "$BASE/api/webhooks/ghl/0000000000000000000000000000000000000000" \
    -H 'Content-Type: application/json' -H 'x-vistrial-secret: readiness-probe' -d '{}')
  [[ "$probe" == "401" ]] && break
  sleep 1
done

if [[ "${probe:-}" != "401" ]]; then
  echo "The stack never became ready (last response: ${probe:-none})." >&2
  echo "Check PostgREST on 3002, the shim on 3001, and the app on 3000." >&2
  exit 1
fi

fails=0
check() {
  if [[ "$2" == "$3" ]]; then
    printf '  ok    %s\n' "$1"
  else
    printf '  FAIL  %s (expected %s, got %s)\n' "$1" "$2" "$3"
    fails=$((fails + 1))
  fi
}

post() {
  curl -s -o /tmp/vistrial-http.body -w '%{http_code}' -X POST "$1" \
    -H 'Content-Type: application/json' -H "x-vistrial-secret: $2" --data-binary "$3"
}

json() { python3 -c "import json;print(str(json.load(open('/tmp/vistrial-http.body'))['$1']).lower())"; }

echo "== the door has to exist and has to be authenticated =="
check "an unknown provider slug is 404" 404 "$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/api/webhooks/stripe/$GHL_KEY" -H 'Content-Type: application/json' \
  -H "x-vistrial-secret: $GHL_SECRET" -d '{}')"
check "no credential is 401, with no database round trip" 401 "$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "$BASE/api/webhooks/ghl/$GHL_KEY" -H 'Content-Type: application/json' -d '{"type":"ContactCreate"}')"
check "a wrong secret is 401" 401 "$(post "$BASE/api/webhooks/ghl/$GHL_KEY" 'wrong-secret' '{"type":"ContactCreate"}')"
check "the refusal is on record" 1 "$(Q "select count(*) from ingest_auth_failure where reason='bad_secret'")"
check "and nothing refused reached the event log" 0 "$(Q "select count(*) from ingest_event")"

echo "== a lead arrives =="
LEAD='{"type":"ContactCreate","webhookId":"wh-http-1","locationId":"loc-northside","contact":{"id":"contact-http-1","firstName":"Ruth","lastName":"Ellis","email":"Ruth@Example.com","phone":"+1 (312) 555-0101","dateAdded":"2026-07-29T09:00:00Z","attributionSource":{"utmSource":"google","campaign":"brand-search"}}}'
check "acknowledged with 202" 202 "$(post "$BASE/api/webhooks/ghl/$GHL_KEY" "$GHL_SECRET" "$LEAD")"
check "the response says received" true "$(json received)"
sleep 2
check "the delivery is logged" 1 "$(Q "select count(*) from ingest_event where external_event_id='wh-http-1'")"
check "and processed after the response" processed "$(Q "select status from ingest_event where external_event_id='wh-http-1'")"
check "the email is normalised" 'ruth@example.com' "$(Q "select email from lead where external_id='contact-http-1'")"
check "the UTMs were captured" google "$(Q "select utm_source from lead where external_id='contact-http-1'")"
check "lead-in is the provider timestamp" '2026-07-2909:00:00+00' "$(Q "select lead_in_at from lead where external_id='contact-http-1'")"
check "response time is a gap, not a zero" '' "$(Q "select coalesce(response_minutes::text,'') from lead where external_id='contact-http-1'")"

echo "== the provider retries the identical delivery =="
check "the retry is still acknowledged" 202 "$(post "$BASE/api/webhooks/ghl/$GHL_KEY" "$GHL_SECRET" "$LEAD")"
check "and reported as a duplicate" true "$(json duplicate)"
check "one delivery, one record" 1 "$(Q "select count(*) from ingest_event where external_event_id='wh-http-1'")"
check "one lead" 1 "$(Q "select count(*) from lead where external_id='contact-http-1'")"

echo "== a reply, then a follow-up eight hours later =="
post "$BASE/api/webhooks/ghl/$GHL_KEY" "$GHL_SECRET" \
  '{"type":"OutboundMessage","webhookId":"wh-http-2","locationId":"loc-northside","contactId":"contact-http-1","messageType":"SMS","dateAdded":"2026-07-29T09:04:30Z"}' >/dev/null
sleep 2
check "first touch stamped" '2026-07-2909:04:30+00' "$(Q "select first_touch_at from lead where external_id='contact-http-1'")"
check "response time computed" '4.50' "$(Q "select response_minutes from lead where external_id='contact-http-1'")"

post "$BASE/api/webhooks/ghl/$GHL_KEY" "$GHL_SECRET" \
  '{"type":"OutboundMessage","webhookId":"wh-http-3","locationId":"loc-northside","contactId":"contact-http-1","messageType":"SMS","dateAdded":"2026-07-29T17:00:00Z"}' >/dev/null
sleep 2
check "the later touch did not move it" '2026-07-2909:04:30+00' "$(Q "select first_touch_at from lead where external_id='contact-http-1'")"
check "so response time stays truthful" '4.50' "$(Q "select response_minutes from lead where external_id='contact-http-1'")"
check "both touches are on record" 2 "$(Q "select count(*) from lead_touch where direction='outbound'")"

echo "== a body that is not JSON is logged, not dropped =="
check "still acknowledged, because it was accepted" 202 \
  "$(post "$BASE/api/webhooks/ghl/$GHL_KEY" "$GHL_SECRET" '{"type":"ContactCreate", not json')"
sleep 1
check "recorded as failed" failed "$(Q "select status from ingest_event where payload is null")"
check "with the body kept verbatim" '{"type":"ContactCreate",notjson' "$(Q "select raw_body from ingest_event where payload is null")"

echo "== an unhandled type is stored and surfaced =="
post "$BASE/api/webhooks/ghl/$GHL_KEY" "$GHL_SECRET" \
  '{"type":"SomeNewWorkflow","webhookId":"wh-http-unknown","locationId":"loc-northside"}' >/dev/null
sleep 2
check "recorded as unknown_type" unknown_type "$(Q "select status from ingest_event where external_event_id='wh-http-unknown'")"
check "and raised to the admin" 1 "$(Q "select count(*) from owner_alert where kind='ingest.unknown_type'")"

echo "== GoHighLevel was down, the operator logged manually, ingestion resumes =="
sudo -u postgres psql -p "$PORT" -d "$DB" -q -c \
  "select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
   select claim_booking('22222222-3333-0000-0000-000000000001','Marcus Boateng','2026-08-03T16:00:00Z',null,'marcus@example.com','Phone booking while GHL was down')" >/dev/null
check "the claim counts toward nothing" f "$(Q "select booking_is_creditable(state,source,matched_booking_id) from booking where source='manual'")"

post "$BASE/api/webhooks/ghl/$GHL_KEY" "$GHL_SECRET" \
  '{"type":"AppointmentCreate","webhookId":"wh-http-appt","locationId":"loc-northside","contactId":"contact-http-2","contact":{"id":"contact-http-2","name":"Marcus Boateng","email":"Marcus@example.com"},"appointment":{"id":"appt-http-1","startTime":"2026-08-03T16:45:00Z"}}' >/dev/null
sleep 2
check "the ingested booking landed" 1 "$(Q "select count(*) from booking where external_ref='appt-http-1'")"
check "the claim auto-confirmed on resume" confirmed "$(Q "select state from booking where source='manual'")"
check "one appointment, one credit" 1 \
  "$(Q "select count(*) from booking b where b.scheduled_for::date='2026-08-03' and booking_is_creditable(b.state,b.source,b.matched_booking_id)")"

echo "== a signed payments door =="
BODY='{"id":"evt_http_pay","type":"payment_intent.succeeded","data":{"object":{"id":"pi_http","amount_received":250000,"metadata":{"vistrial_invoice_id":"dddddddd-0000-0000-0000-000000000001"}}}}'
TS=$(date +%s)
SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$PAY_SECRET" -hex | sed 's/^.*= //')
STALE=$((TS - 4000))
STALE_SIG=$(printf '%s' "$STALE.$BODY" | openssl dgst -sha256 -hmac "$PAY_SECRET" -hex | sed 's/^.*= //')

check "a bad signature is 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/api/webhooks/payments/$PAY_KEY" -H 'Content-Type: application/json' \
  -H "stripe-signature: t=$TS,v1=deadbeef" --data-binary "$BODY")"
check "a correctly signed but stale request is 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/api/webhooks/payments/$PAY_KEY" -H 'Content-Type: application/json' \
  -H "stripe-signature: t=$STALE,v1=$STALE_SIG" --data-binary "$BODY")"
check "a valid signature is accepted" 202 "$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/api/webhooks/payments/$PAY_KEY" -H 'Content-Type: application/json' \
  -H "stripe-signature: t=$TS,v1=$SIG" --data-binary "$BODY")"
sleep 2
check "the payment processed" processed "$(Q "select status from ingest_event where external_event_id='evt_http_pay'")"
check "the tenant came from the invoice it referenced" 'cccccccc-0000-0000-0000-000000000001' \
  "$(Q "select case_file_id from ingest_event where external_event_id='evt_http_pay'")"
check "the invoice is paid" paid "$(Q "select status from invoice where number='DA-1001'")"
check "revenue recorded once" 1 "$(Q "select count(*) from revenue_record")"
check "at the right amount" '2500.00' "$(Q "select amount from revenue_record")"

echo "== a GET says only that something is listening =="
check "GET is 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/webhooks/ghl/$GHL_KEY")"

echo
if [[ $fails -eq 0 ]]; then
  echo "ALL HTTP END-TO-END CHECKS PASSED"
else
  echo "$fails CHECK(S) FAILED"
  exit 1
fi
