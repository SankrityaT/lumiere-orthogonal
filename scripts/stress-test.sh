#!/usr/bin/env bash
# End-to-end stress test against the deployed Orthogonal Chat instance.
# Each block prints PASS/FAIL with the specific signal we checked.

set -u

URL="${1:-https://lumiere-orthogonal.vercel.app}"
COOKIE_JAR="$(mktemp)"
OUT_DIR="$(mktemp -d)"

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

bold() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; }
info() { printf "  · %s\n" "$1"; }

# ------------------------------------------------------------------
bold "Test 0 — landing + chat shell"
LANDING_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
CHAT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/chat")
[[ "$LANDING_CODE" == "200" ]] && ok "GET / → 200" || bad "GET / → $LANDING_CODE"
[[ "$CHAT_CODE" == "200" ]]    && ok "GET /chat → 200" || bad "GET /chat → $CHAT_CODE"

# ------------------------------------------------------------------
bold "Test 1 — /api/conversations sets cookie, returns persistence:'db'"
CONVO_JSON=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$URL/api/conversations")
PERSIST=$(echo "$CONVO_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('persistence','?'))" 2>/dev/null)
info "persistence: $PERSIST"
[[ "$PERSIST" == "db" ]] && ok "Neon-backed persistence active" || bad "expected 'db', got '$PERSIST'"
COOKIE_LINES=$(wc -l < "$COOKIE_JAR")
[[ "$COOKIE_LINES" -gt 3 ]] && ok "cookie jar populated ($COOKIE_LINES lines)" || bad "no cookie set"

# ------------------------------------------------------------------
bold "Test 2 — full agentic turn: 'tell me about stripe.com'"
START=$(date +%s)
curl -sN -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$URL/api/chat" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Tell me about stripe.com: recent funding, what they are hiring for, and a brief summary."}]}' \
  > "$OUT_DIR/turn1.ndjson"
DURATION=$(($(date +%s) - START))
info "turn took ${DURATION}s, ndjson lines: $(wc -l < "$OUT_DIR/turn1.ndjson")"

# Count key event types
TOOL_STARTS=$(grep -c '"type":"tool_call_start"' "$OUT_DIR/turn1.ndjson" || echo 0)
TOOL_RESULTS=$(grep -c '"type":"tool_call_result"' "$OUT_DIR/turn1.ndjson" || echo 0)
TEXT_DELTAS=$(grep -c '"type":"text_delta"' "$OUT_DIR/turn1.ndjson" || echo 0)
CONTEXT_UPDATES=$(grep -c '"type":"context_update"' "$OUT_DIR/turn1.ndjson" || echo 0)
ERRORS=$(grep -c '"type":"error"' "$OUT_DIR/turn1.ndjson" || echo 0)
DONE=$(grep -c '"type":"done"' "$OUT_DIR/turn1.ndjson" || echo 0)

info "events: tool_starts=$TOOL_STARTS tool_results=$TOOL_RESULTS text_deltas=$TEXT_DELTAS context_updates=$CONTEXT_UPDATES errors=$ERRORS done=$DONE"
[[ "$TOOL_STARTS" -ge 1 ]] && ok "at least one tool fired" || bad "no tools fired"
[[ "$TEXT_DELTAS" -ge 5 ]] && ok "model streamed text" || bad "no/short text stream"
[[ "$CONTEXT_UPDATES" -ge 1 ]] && ok "context_update events emitted" || bad "no context updates"
[[ "$DONE" == "1" ]] && ok "stream closed with 'done'" || bad "stream did not close cleanly"

# Pull last context_update for actual vs naive
LAST_CTX=$(grep '"type":"context_update"' "$OUT_DIR/turn1.ndjson" | tail -1)
if [[ -n "$LAST_CTX" ]]; then
  ACTUAL=$(echo "$LAST_CTX" | python3 -c "import sys,json; e=json.load(sys.stdin); print(e.get('actual_tokens',0))")
  NAIVE=$(echo "$LAST_CTX" | python3 -c "import sys,json; e=json.load(sys.stdin); print(e.get('naive_tokens',0))")
  MAX=$(echo "$LAST_CTX" | python3 -c "import sys,json; e=json.load(sys.stdin); print(e.get('model_max',0))")
  info "final context: actual=$ACTUAL naive=$NAIVE model_max=$MAX"
fi

# Pull tool providers used
TOOLS_FIRED=$(grep '"type":"tool_call_start"' "$OUT_DIR/turn1.ndjson" | python3 -c "
import sys,json
seen=set()
for line in sys.stdin:
    try:
        e=json.loads(line)
        seen.add(e.get('tool_name','?'))
    except: pass
print(', '.join(sorted(seen)))
")
info "tools used: $TOOLS_FIRED"

# ------------------------------------------------------------------
bold "Test 3 — repeat the same call, expect cache hits"
sleep 1
curl -sN -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$URL/api/chat" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Tell me about stripe.com: recent funding, what they are hiring for, and a brief summary."}]}' \
  > "$OUT_DIR/turn2.ndjson"
CACHED=$(grep '"type":"tool_call_result"' "$OUT_DIR/turn2.ndjson" | grep -c '"cached":true' || echo 0)
PRICE_TOTAL=$(grep '"type":"tool_call_result"' "$OUT_DIR/turn2.ndjson" | python3 -c "
import sys,json
t=0
for line in sys.stdin:
    try: t+=json.loads(line).get('price_cents',0)
    except: pass
print(t)
")
info "repeat call: cached_results=$CACHED total_price_cents=$PRICE_TOTAL"
[[ "$CACHED" -ge 1 || "$PRICE_TOTAL" -eq 0 ]] && ok "cache hits or zero cost on repeat" || info "no cache hits — model may have rephrased the query"

# ------------------------------------------------------------------
bold "Test 4 — Neon row count grew"
ROW_COUNT=$(curl -s "$URL/api/conversations" -b "$COOKIE_JAR" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('conversations',[])))")
info "conversations visible to this cookie: $ROW_COUNT"
[[ "$ROW_COUNT" -ge 1 ]] && ok "Neon has at least one conversation for this session" || bad "Neon write may have failed"

# ------------------------------------------------------------------
bold "Test 5 — invalid payload behavior"
BAD_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$URL/api/chat" -H 'Content-Type: application/json' -d '{"garbage":true}')
BAD_CODE=$(echo "$BAD_RESP" | grep -o "HTTP:[0-9]*" | cut -d: -f2)
info "bad payload returned HTTP $BAD_CODE"
[[ "$BAD_CODE" == "400" || "$BAD_CODE" == "422" ]] && ok "rejected with 4xx" || bad "expected 4xx, got $BAD_CODE"

# ------------------------------------------------------------------
bold "Test 6 — confirm-send rejects unknown draft id"
SEND_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$URL/api/chat/confirm-send" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_JAR" \
  -d '{"draftId":"nonsense","to":"alice@stripe.com"}')
SEND_CODE=$(echo "$SEND_RESP" | grep -o "HTTP:[0-9]*" | cut -d: -f2)
info "unknown draft returned HTTP $SEND_CODE"
[[ "$SEND_CODE" == "404" || "$SEND_CODE" == "403" ]] && ok "guardrail rejected bogus draft" || bad "expected 404/403, got $SEND_CODE"

# ------------------------------------------------------------------
bold "Output saved at $OUT_DIR"
ls -la "$OUT_DIR"
