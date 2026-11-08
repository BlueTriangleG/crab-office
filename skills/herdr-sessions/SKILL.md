---
name: herdr-sessions
description: Use when you manage the office's Claude Code sessions inside herdr (HERDR_ENV=1) and need to see every session with its job title and session id, rest an idle one (handoff, roster, close its tab), or bring a resting one back with its conversation intact. For the CEO, or any session the chairman asks to do it.
---

# Managing sessions in herdr

herdr runs each Claude Code session in a tab. These steps let you see them all, put an idle one to rest, and bring it back later as the same conversation. Tested on herdr 0.9.5.

**First, check you are in herdr:** `echo "$HERDR_ENV"` must print `1`. If it does not, tell whoever asked that herdr session management is not available here, and do nothing else.

The office's files are in `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/crab-office`, called `$OFFICE` below. Resting sessions are kept in `$OFFICE/resting/`, one JSON file per session.

## See every session

```sh
sh <this skill's base directory>/sessions.sh | column -t -s "$(printf '\t')"
```

Each row lists one Claude session: its job title (`office_board title`, `-` if none), its herdr status, its tab label, tab, pane, workspace, session id and working directory. A resting session shows as `resting`, with no tab or pane. To address a session, use its job title with SendMessage. `office_board staff` gives each title's SendMessage name, its duty and its open jobs. The script needs `jq`. Without it, read `herdr agent list` and `herdr tab list` and join them on `tab_id`, then match `agent_session.value` against the session ids in `$OFFICE/titles/*.json`; where two files name one session, the later `at` wins.

## Put a session to rest

Do not rest:
- yourself;
- a session that is working (status `working`);
- a session waiting on the chairman: its tab label starts with ⏳, or it has an item on the chairman's list;
- a session with an open job (`office_board staff`): let it report, or withdraw the job first;
- a session whose PR was opened recently and is still waiting for review. It stands by instead.

1. Ask it for a three-line handoff by SendMessage: what is unfinished, where things are (branches, worktrees, notes), and what to do first on return. Wait for the reply.
2. Write `$OFFICE/resting/<session id>.json` (create the folder if needed):
   ```json
   {
     "title": "<job title>",
     "sessionId": "<session id>",
     "cwd": "<its cwd, absolute>",
     "workspace": "<its workspace id>",
     "closedAt": "<ISO time>",
     "handoff": { "unfinished": "…", "where": "…", "first": "…" }
   }
   ```
3. Close its tab: `herdr tab close <tab id>`.
4. Run `sessions.sh` again. It should show as `resting`. If it was the last tab in its workspace, herdr closes the workspace too; `recall.sh` copes with that.

Its conversation stays on disk at `~/.claude/projects/<its cwd, slashes turned into dashes>/<session id>.jsonl`. Its job title and duty stay in the office, because they are kept by session id.

## Bring a session back

```sh
sh <this skill's base directory>/recall.sh <session id>
```

It reads the session's roster file, opens a tab labelled with its job title, and resumes the same conversation there with `herdr agent start <title> --kind claude --pane <pane> -- --resume <session id>`. Then it prints the handoff and deletes the roster file. herdr closes a workspace when its last tab closes, so the workspace on the roster may be gone. The script handles that: the tab goes to the recorded workspace if it is still open, else to a workspace that already has a pane in the same directory, else to a new workspace created there. The recorded cwd is used exactly, because Claude finds the conversation by the directory it was started in.

- If herdr reports a different session on the new pane, the script stops and keeps the roster entry. Look at the pane before trying again.
- Run `sessions.sh` again. The same session id should show on the new pane, with its job title.
- It comes back with its whole conversation, in the permission mode `claude` starts in. Its SendMessage name is new; `office_board staff` shows it.
- Send it the first step of the handoff the script printed.

## What the office already does in herdr

- A session's tab is renamed to its job title whenever the title is set or changes.
- A session that needs the chairman in person calls `office_board confirm`. Its tab shows `⏳ <title> · …`, the chairman gets a notification, and both clear once the chairman types in that session. herdr's own status for a Claude tab cannot be set from outside, so the tab label is the signal.
- A job given to a session in herdr tells it to work in a worktree of its own (`herdr worktree create --branch <name> --no-focus`) and to remove it after reporting (`herdr worktree remove --workspace <id>`).

None of this happens to a session outside herdr.
