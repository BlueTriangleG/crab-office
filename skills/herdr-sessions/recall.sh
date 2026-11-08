#!/bin/sh
# Brings a resting session back as the same conversation, and prints its
# handoff. herdr closes a workspace with its last tab, so the one on the roster
# may be gone: the tab then goes to a workspace already open in the same
# directory, else to a new workspace there.
# Usage: recall.sh <session id>. Needs herdr (0.9 or later) and jq.
set -eu

if [ "${HERDR_ENV:-}" != 1 ]; then
  echo "Not inside herdr (HERDR_ENV is not 1): herdr session management is not available here."
  exit 1
fi
id=${1:?usage: recall.sh <session id>}
roster="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/crab-office/resting/$id.json"
if [ ! -f "$roster" ]; then
  echo "No resting session $id: $roster does not exist."
  exit 1
fi
title=$(jq -r .title "$roster")
cwd=$(jq -r .cwd "$roster")
ws=$(jq -r .workspace "$roster")

if herdr workspace list | jq -e --arg ws "$ws" 'any(.result.workspaces[]; .workspace_id == $ws)' >/dev/null; then
  where=$ws
else
  where=$(herdr pane list | jq -r --arg cwd "$cwd" '[.result.panes[] | select(.cwd == $cwd)][0].workspace_id // empty')
fi
if [ -n "$where" ]; then
  pane=$(herdr tab create --workspace "$where" --cwd "$cwd" --label "$title" --no-focus | jq -r .result.root_pane.pane_id)
else
  pane=$(herdr workspace create --cwd "$cwd" --label "$title" --no-focus | jq -r .result.root_pane.pane_id)
fi

back=$(herdr agent start "$title" --kind claude --pane "$pane" --timeout 60000 -- --resume "$id" |
  jq -r '.result.agent.agent_session.value // empty')
if [ "$back" != "$id" ]; then
  echo "Started in pane $pane, but herdr reports session ${back:-none}, not $id: check the pane before going on. The roster entry is kept."
  exit 1
fi
echo "$title is back as session $id in pane $pane. Its handoff:"
jq '.handoff' "$roster"
rm "$roster"
