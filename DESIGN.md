# crab-office

Every running Claude Code session on this machine as a pixel-art company: you are
the chairman, each project a department, each session a team whose manager is the
session itself and whose crew are its subagents.

## Language

Every word the office shows or says, to the person and to the model, is in
`hooks/words.ts`, once in English and once in Chinese, chosen by the plugin's
`language` option (`en` by default, `zh`; set in `/config`). The drawing runs
in an environment of its own, so the company it is handed carries the
language. Titles below are given in both: 大部长 Director, 部长 Head, 组长
Lead, 本部 HQ. A board line names its crabs as the drawing names them now, in
the words the office speaks now: a note keeps the names it was written with,
before anyone knew which session would be 大部长.

## What it shows

- **`/office` pane**: the whole company. A header line, then a framed room per
  department (`<project> 部`), this session's first. A session in a git worktree
  belongs to its repository's department as a team of its own: its head is 组长
  where the repository's own checkout has 部长, and
  where a department has more than one team each sits on its own rug under a
  sign (`本部`, `<worktree> 组`). An idle manager goes by its worktree's name.
- **Rows of rooms**: a department of several teams has a row of the pane to
  itself, its teams side by side and centred, two columns of aisle between two
  and two of clear floor inside each wall. Departments of one team share rows,
  every room as wide as the widest needs and together filling the row; a last
  row they do not fill keeps that width and is centred. Rooms of a row are as
  tall as its tallest. One team to a full-width row left a desk alone on an
  empty floor; rooms sized each to its own contents read as cramped and ragged.
- **Like an office**: rooms are drawn as a floor plan, double walls with the
  department's name on a brass plate over the top one and a doorway in the
  bottom one beside the head-count, on carpet tiles a shade apart, with one
  floor lamp by the left wall. A plant, a water cooler, a bookshelf, a printer,
  a filing cabinet and a sofa were tried beside the desks and read as
  misshapen at two pixels a cell. The board is a whiteboard: an aluminium frame
  and three markers in its tray.
- **You are here**: the team of the session whose pane it is has a gold wall
  beside it and `◀ 你在这` on its sign, or `· 你在这` in the title of a
  department with one team. It is always the first team of the first room.
- **Finishing**: when a session finishes a turn its manager cheers for 15 s
  (arms up, sparks, "完成了！" in green) and its department's walls flash green
  with "✓ 完成" in the title; after that a green ✓ stays over the manager until
  the next turn starts. A session with the pane open toasts each other session's
  finish once. Each team is an org chart:
  the manager's desk centred on a row of its own, the crew on the rows below,
  hung from one line, at most two rows of desks; further crew wait in a crowd
  line ("还有 5 人" and a head each). The room's bottom edge counts who is working, who waits on
  you and who has gone home. Click a crab for its detail under the drawing: a
  crew member's task handed down, last five tool calls and answer handed back;
  a manager's current prompt.
- **btw**: under a clicked crab, a field to ask it something. The answer never
  starts a turn or interrupts the work: a manager answers through a fork of its
  session's own thread (`$.model.fork`, as `/btw` does), a subagent from its own
  conversation (`$.session.messages`) through one completion, or, once that can
  no longer be read, through its manager's fork. A crab of another session is
  asked through `asks/<id>.json`; its session answers on its next tick into
  `replies/<id>.json`, and an ask unanswered after two minutes says so.
- **Shared board (共享白板)**: a chalkboard under the departments with the latest
  eight things anyone said to anyone, from every session: work handed down
  (`agent.spawn`), work handed back (a crew member's `turn.complete`) and every
  SendMessage (`session.send`), to a crab of this session or to another session.
  Each line is two rows, who to whom in their own colours, then the words.
  Click a line to select the crab who said it; a selected crab's lines carry ▸.
- **The chairman's memos**: `/office say [@组名|@全体] 留言`, or the framed field
  under the board in the pane (click it, type, Enter, the names it can call
  shown as tags beneath), pins a memo to the board. `@<worktree>` (or `@本部`) is for that team, `@全体` for every team,
  no `@` for whoever is free first. Typing `@` after `/office say` lists them
  in the typeahead, each team with what it is doing. A session takes a memo when it is finished, its manager waiting and none
  of its crew at work, with nothing typed in its prompt box, and
  has not taken it before: the memo arrives as a prompt naming its colleagues
  and the `office_board` tool, with which it claims the memo, posts to the
  board or lists its colleagues. An open memo goes to one session only, the
  first free one by id; it stays with that session while it is busy, so the
  gap before its claim lands does not pass it on, and its claim stops a second.
  A named or all memo is every addressee's, each claiming it for itself, and
  reaches only sessions that were running when it was written. The board shows
  `✓ <who>、<who> 接了` under a claimed memo. Memos expire after 24 h.
- **Envelopes on the org chart**: for three seconds after work is handed down a
  ✉ walks the wire from the manager's junction to the crew member's desk, and
  after it is handed back, the other way.
- **Band above the prompt**: this session's team on one row of desks, while it
  has crew.

## The workstation

Each seat is 14 cells by 6 rows: a badge row, four rows of pixel art, then the
job title and the task. The art is drawn at quadrant resolution (two pixels each
way per cell) and every cell is reduced to one quadrant glyph of at most two
colours, which is all a terminal cell can show.

- **Clawd** is drawn from Claude Code's own parts (arms, eyes, feet, turned
  frames; body `rgb(215,119,87)` for managers, eyes `clawd_background`). Crew
  colours come in hiring order so a team never repeats one.
- **A crown a department**: each department's 大部长 is its longest-serving
  session in the repository's own checkout, or in a worktree where none is, and
  wears its crown; the 大部长's team sits alone on the department's top row,
  centred, the other teams below. Every other 部长 and 组长 wears a hat of its
  own, handed out by seniority so a newcomer never takes an old hand's:
  mortarboard, chef's hat, viking helmet, pom beanie, bunny ears, cowboy hat,
  propeller cap; an eighth manager starts the list again. A crown on every 部长
  said nothing, and one crown for the whole company left every other
  repository headless.
- **Hats and titles by role**: managers as above, Explore safari hat 调研员,
  Plan cap 规划师, general-purpose hard hat 工程师, fork sprout 分身,
  claude-code-guide 顾问, verifier 质检员, any other 实习生 with no hat.
- **Desk**: oak for crew, walnut with a gold nameplate for managers; each desk
  stops a cell short of the next. A keyboard sits in front of the crab.
- **Monitor**: ten pixels wide on a neck, drawn in front of the crab so his right
  arm sits behind it. Bezels two pixels at the sides and one above and below,
  which read as even at this pixel shape, a lit top edge, and a three-by-three
  screen and no power light, which said again what the screen says. Only a crab
  at work has anything moving on its screen: idle it shows a still standby
  screen, a Claude-orange dot on slate; asleep it goes dark; gone, it is off
  with a sticky note on it. The keyboard sits in front of the crab.

## Looks

The eyes never blink: at one pixel a shutting eye read as swelling, vanishing
or fading, and all three were tried. Eyes shut only asleep, failed and winking,
as a lid of darker body on the eye's own pixel.

| Look | Crab | Screen and badge |
| --- | --- | --- |
| thinking | facing you, glancing along one row | cursor blinking, Claude Code's spinner ✻ |
| editing | turned to the screen | code lines appear, keys flash |
| reading | turned to the screen | a page scrolls |
| searching | looking left and right | a highlight hops |
| running | turned to the screen | output scrolls |
| browsing | turned to the screen | a cloud crosses the sky |
| delegating | arms up, pointing | a spark drifts across standby, » |
| approval | one hand up | a dialog with a pulsing button, ! blinking |
| idle | holding a mug, sipping | standby, still |
| asleep (idle 10 min) | head down behind the desk, eyes shut | dark, z Z |
| done | cheers, then winks | green, ✦ then ✓ |
| failed | eyes shut, a bead of sweat | red, × |
| gone | an empty chair | a sticky note on the screen |

## How sessions talk to each other

Every session has the `office_board` tool, whose description tells the model
its colleagues are the other sessions on this machine and when to use it:
before starting, after finishing something, and whenever its work touches
another session's. `read` gives the messages written to it since it last read
and the board's latest lines, each naming its session; `post` writes to the
chairman, or with `to` to a team, a department or 全体; `colleagues` lists who
is at work on what and whom it can write to. Every answer mentions unread
messages. A colleague's message never wakes its reader: it waits in the inbox
until the reader next looks, so two sessions cannot talk each other into turns
without end. Only the chairman's memos start a turn.

## How sessions see each other

Each session writes its own snapshot to `<config>/crab-office/live/<sessionId>.json`
when it changes (at most once a second) and as a heartbeat every 5 s. An open pane
reads the folder every second. No heartbeat for 30 s, or an explicit end, draws the
session as gone; after 5 min it leaves the company. Finished crew stay 60 s.
Memos are `memos/<id>.json` and claims `claims/<memoId>[.<sessionId>].json` beside `live/`,
one file each, so nobody writes a file somebody else writes.

`$.store` was rejected (one file every session writes, so concurrent writes clobber)
and `$.session.send` too (the message reaches the other session's model).

Each drawing reports its first frame back (`drawn` in the snapshot, by the
`Client`'s key), so a session can be checked for a surface module that loaded
but never drew.

## Limits

- Observes, except for memos and btw: every hook passes its event on unchanged;
  it hands a memo the chairman wrote to a finished session as a prompt, and
  answers a btw with one side call to the model. No network, no processes.
- "Waiting for approval" comes from the classic `PermissionRequest` event, skipped in
  auto mode. `tool.check` answering `ask` was tried first and raised a hand on most
  calls in auto mode, where the classifier answers and nobody is asked. Where an
  organization manages Claude Code, classic events skip installed plugins, so no
  crab raises a hand there.
- The mods API has no delete, so snapshots of closed sessions stay in `live/`; they
  are skipped by mtime. Delete the folder by hand if it ever matters.
- Terminal only. A frame of a 128-row office takes about 3 ms to draw.
- The Claude Code daemon keeps background processes warm for sessions nobody
  has opened yet (`claude bg-spare`, `CLAUDE_CODE_SESSION_KIND=bg`). They load
  plugins like any session, and one drew as a second crab beside the real
  session in its folder. A background session stays out of the office until
  its first turn: no snapshot and no memos until it is someone's.
- A Client's tree may serialize to 100,000 characters, past which it draws
  nothing; carpet and furniture took a seven-session office past it. The pane
  draws the office as a stack of Clients, each a band of rows the hook sizes to
  about 60,000 by counting its runs, and every band reads the wall clock for its
  frame so a crab cut between two moves as one. `Raster` would have been one
  element, but it takes only width-1 characters and the office writes Chinese.
