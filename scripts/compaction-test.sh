#!/usr/bin/env bash
# Real compaction proof: chain 3 enrich-heavy turns in the SAME conversation,
# watch actual_tokens vs naive_tokens climb. With MODEL_MAX_TOKENS=32000
# and Apollo + ContactOut returning ~15-20k of tool data per turn, the
# system should compact by turn 2 or 3.
set -u

URL="${1:-https://lumiere-orthogonal.vercel.app}"
COOKIE_JAR="$(mktemp)"
OUT="$(mktemp -d)"
HISTORY="$(mktemp)"
trap "rm -f $COOKIE_JAR $HISTORY" EXIT

# warm
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$URL/api/conversations" > /dev/null

echo '[]' > "$HISTORY"

run_turn() {
  local n="$1"
  local prompt="$2"
  echo ""
  echo "─── turn $n ───────────────────────────────────────────────"
  echo "user: $prompt"

  # Build payload: prior history + this turn
  local payload
  payload=$(python3 -c "
import json
hist = json.load(open('$HISTORY'))
hist.append({'role':'user','content':'$prompt'})
print(json.dumps({'messages':hist}))
")

  curl -sN -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$URL/api/chat" \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    > "$OUT/turn-$n.ndjson"

  # Pull stats
  local tools last_ctx actual naive compacted text
  tools=$(grep '"type":"tool_call_start"' "$OUT/turn-$n.ndjson" | python3 -c "
import sys,json
seen=[]
for line in sys.stdin:
    try:
        e=json.loads(line)
        n=e.get('tool_name','?')
        if n not in seen: seen.append(n)
    except: pass
print(', '.join(seen))
")
  last_ctx=$(grep '"type":"context_update"' "$OUT/turn-$n.ndjson" | tail -1)
  actual=$(echo "$last_ctx" | python3 -c "import sys,json; print(json.load(sys.stdin).get('actual_tokens',0))" 2>/dev/null || echo 0)
  naive=$(echo "$last_ctx" | python3 -c "import sys,json; print(json.load(sys.stdin).get('naive_tokens',0))" 2>/dev/null || echo 0)
  compacted=$(grep -c '"type":"compaction"' "$OUT/turn-$n.ndjson")
  # Compose the assistant reply text for history continuity
  text=$(grep '"type":"text_delta"' "$OUT/turn-$n.ndjson" | python3 -c "
import sys,json
out=[]
for line in sys.stdin:
    try: out.append(json.loads(line).get('text',''))
    except: pass
print(''.join(out))
" | head -c 8000)

  printf "  tools fired:        %s\n" "$tools"
  printf "  actual_tokens:      %s\n" "$actual"
  printf "  naive_tokens:       %s\n" "$naive"
  printf "  compaction events:  %s\n" "$compacted"
  if [[ "$compacted" -gt 0 ]]; then
    echo "  >>> COMPACTION FIRED <<<"
    grep '"type":"compaction"' "$OUT/turn-$n.ndjson" | head -1 | python3 -c "
import sys,json
c=json.load(sys.stdin)
print('    ', c.get('summary','(no summary)'))
print('    would_have_crashed:', c.get('would_have_crashed'))
"
  fi
  if [[ "$naive" -gt "$actual" ]]; then
    diff=$((naive - actual))
    echo "  >>> DIVERGENCE: naive is $diff tokens larger than actual"
  fi

  # Append the assistant text to history for next turn
  python3 -c "
import json
hist = json.load(open('$HISTORY'))
hist.append({'role':'user','content':'$prompt'})
hist.append({'role':'assistant','content':'''$(echo "$text" | sed "s/'/'\\\\''/g")'''})
json.dump(hist, open('$HISTORY','w'))
"
}

run_turn 1 "Find 5 senior engineers at stripe.com on Apollo with full profile details, then enrich the top 3 contacts (emails + phones via ContactOut)."
sleep 1
run_turn 2 "Now do the same for anthropic.com — find 5 senior engineers and enrich the top 3."
sleep 1
run_turn 3 "Same again for openai.com — 5 senior engineers, enrich top 3, and summarize differences in seniority across all three companies."

echo ""
echo "════════════════════════════════════════════════════════"
echo "All turns saved at: $OUT"
ls -la "$OUT"
