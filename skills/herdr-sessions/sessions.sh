#!/bin/sh
# Every Claude Code session herdr runs, with its crab-office job title and the
# ids that address it, and the sessions resting on the roster.
# Needs herdr (0.9 or later) and jq.
set -eu

if [ "${HERDR_ENV:-}" != 1 ]; then
  echo "Not inside herdr (HERDR_ENV is not 1): herdr session management is not available here."
  exit 1
fi
office="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/crab-office"

# A title is kept per writer (office_board title); the latest one stands.
titles=$(cat "$office"/titles/*.json 2>/dev/null |
  jq -s '[.[] | to_entries[]] | group_by(.key) | map({key: .[0].key, value: (max_by(.value.at).value.text)}) | from_entries')
labels=$(herdr tab list | jq '[.result.tabs[] | {key: .tab_id, value: .label}] | from_entries')

printf 'title\tstatus\ttab label\ttab\tpane\tworkspace\tsession id\tcwd\n'
herdr agent list | jq -r --argjson titles "${titles:-{\}}" --argjson labels "$labels" '
  .result.agents[] | select(.agent == "claude")
  | (.agent_session.value // "") as $id
  | [($titles[$id] // "-"), .agent_status, ($labels[.tab_id] // "-"), .tab_id, .pane_id,
     .workspace_id, (if $id == "" then "-" else $id end), .cwd]
  | @tsv'

# Resting sessions in the same table: no tab or pane until brought back.
if ls "$office"/resting/*.json >/dev/null 2>&1; then
  jq -r '[.title, "resting", "-", "-", "-", .workspace, .sessionId, .cwd] | @tsv' "$office"/resting/*.json
fi
