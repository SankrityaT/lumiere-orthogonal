#!/usr/bin/env bash
# Deep stress: forces multi-tool chains, big context, and full send_email
# guardrail behavior. Run against the deployed URL.

set -u

URL="${1:-https://lumiere-orthogonal.vercel.app}"
COOKIE_JAR="$(mktemp)"
OUT="$(mktemp -d)"
trap "rm -f $COOKIE_JAR" EXIT

ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; }
info() { printf "  · %s\n" "$1"; }
bold() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }

# warm cookie
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$URL/api/conversations" > /dev/null

# ============================================
bold "Deep Test A — multi-tool chain in one turn"
# Should fire apollo + (maybe contactout) + tavily in one turn
curl -sN -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$URL/api/chat" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Find 3 senior engineers at stripe.com on Apollo, enrich them, AND search the web for Stripe latest funding news."}]}' \
  > "$OUT/multi.ndjson"

TOOLS_USED=$(grep '"type":"tool_call_start"' "$OUT/multi.ndjson" | python3 -c "
import sys,json
seen=set()
for line in sys.stdin:
    try: seen.add(json.loads(line).get('tool_name','?'))
    except: pass
print(', '.join(sorted(seen)))
print('count:', len(seen), file=sys.stderr)
")
TOOL_COUNT=$(grep -c '"type":"tool_call_start"' "$OUT/multi.ndjson")
TOOL_RESULTS=$(grep -c '"type":"tool_call_result"' "$OUT/multi.ndjson")
ERRORS=$(grep -c '"type":"error"' "$OUT/multi.ndjson")
LAST_CTX=$(grep '"type":"context_update"' "$OUT/multi.ndjson" | tail -1)
ACTUAL=$(echo "$LAST_CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('actual_tokens',0))" 2>/dev/null || echo "?")
NAIVE=$(echo "$LAST_CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('naive_tokens',0))" 2>/dev/null || echo "?")

info "tool calls fired: $TOOL_COUNT (results: $TOOL_RESULTS, errors: $ERRORS)"
info "tools used: $TOOLS_USED"
info "final context: actual=$ACTUAL naive=$NAIVE"
[[ "$TOOL_COUNT" -ge 2 ]] && ok "multi-tool chain fired" || bad "only $TOOL_COUNT tool(s) — agent didn't chain"
[[ "$ERRORS" -eq 0 ]] && ok "zero errors in chain" || bad "$ERRORS error(s) during chain"

# ============================================
bold "Deep Test B — forcing context bloat (long synthetic history)"
# Generate a payload with many fake prior messages to push context up.
# We send 30 prior assistant messages each with a chunk of text to simulate
# accumulated tool results.

PAYLOAD=$(python3 <<'PY'
import json
chunk = ("Stripe is a payments company. Their job openings include senior software engineer, "
         "staff engineer, principal engineer, infrastructure roles, and many more positions. "
         "Recent funding includes a $6.5B round in March 2023 at $50B valuation. ") * 20
msgs = []
for i in range(20):
    msgs.append({"role": "user", "content": f"Tell me more about Stripe (turn {i})"})
    msgs.append({"role": "assistant", "content": chunk})
msgs.append({"role": "user", "content": "Now in one sentence: what's the most important thing to know about Stripe?"})
print(json.dumps({"messages": msgs}))
PY
)

curl -sN -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$URL/api/chat" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" \
  > "$OUT/bloat.ndjson"

LAST_CTX=$(grep '"type":"context_update"' "$OUT/bloat.ndjson" | tail -1)
ACTUAL=$(echo "$LAST_CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('actual_tokens',0))" 2>/dev/null || echo 0)
NAIVE=$(echo "$LAST_CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('naive_tokens',0))" 2>/dev/null || echo 0)
COMPACTIONS=$(grep -c '"type":"compaction"' "$OUT/bloat.ndjson" || echo 0)
DONE=$(grep -c '"type":"done"' "$OUT/bloat.ndjson")

info "after bloat: actual_tokens=$ACTUAL naive_tokens=$NAIVE compaction_events=$COMPACTIONS"
[[ "$NAIVE" -gt "$ACTUAL" ]] && ok "naive > actual (compaction reduced active context)" || info "actual==naive (didn't cross threshold)"
[[ "$COMPACTIONS" -ge 1 ]] && ok "compaction fired" || info "no compaction event (budget not crossed)"
[[ "$DONE" -eq 1 ]] && ok "stream still closed cleanly under bloat" || bad "stream broke"

# ============================================
bold "Deep Test C — send_email full guardrail (blocked recipient)"
# Send to an address that's NOT on the allowlist; expect 403 blocked
GUARD_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$URL/api/chat/confirm-send" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_JAR" \
  -d '{"draftId":"draft_test_99","to":"random@gmail.com","subject":"hi","body":"test"}')
GUARD_CODE=$(echo "$GUARD_RESP" | grep -o "HTTP:[0-9]*" | cut -d: -f2)
info "non-allowlisted recipient returned HTTP $GUARD_CODE"
[[ "$GUARD_CODE" == "403" || "$GUARD_CODE" == "404" || "$GUARD_CODE" == "400" ]] && ok "blocked at guardrail" || bad "expected 4xx, got $GUARD_CODE"

# ============================================
bold "Deep Test D — concurrency (5 simultaneous identical queries)"
# Should hit cache coalesce or response cache; second-onwards should be fast
for i in 1 2 3 4 5; do
  (curl -sN -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$URL/api/chat" \
    -H 'Content-Type: application/json' \
    -d '{"messages":[{"role":"user","content":"What is stripe.com'\''s most recent funding round?"}]}' \
    > "$OUT/concurrent-$i.ndjson") &
done
wait
echo "  · all 5 returned"
for i in 1 2 3 4 5; do
  CACHED=$(grep '"type":"tool_call_result"' "$OUT/concurrent-$i.ndjson" | grep -c '"cached":true')
  ERRS=$(grep -c '"type":"error"' "$OUT/concurrent-$i.ndjson")
  DONE_I=$(grep -c '"type":"done"' "$OUT/concurrent-$i.ndjson")
  info "call $i: cached_results=$CACHED errors=$ERRS done=$DONE_I"
done

bold "Output: $OUT"
ls -la "$OUT" | tail -10
