import type { ClientElements, EngineInterface, Register } from "claude-code"

import {
  CHEER_MS,
  LEAVE_MS,
  bandOf,
  companyOf,
  createSnapshot,
  detailOf,
  findCrab,
  handoverOf,
  boardOf,
  btwOf,
  inboxOf,
  memoFor,
  orderPromptOf,
  ordersFor,
  recipientsOf,
  targetOf,
  messageSent,
  subagentBtwOf,
  parseSay,
  addresseesOf,
  parseSnapshot,
  placeOf,
  pruned,
  rosterOf,
  spawned,
  talkOf,
  toolAsked,
  toolFinished,
  toolLabel,
  toolStarted,
  turnFinished,
  turnStarted,
  whoOf,
} from "./office.ts"
import type { Ask, Claim, Detail, Memo, Order, Reply, Snapshot, Talk } from "./office.ts"
import type { BoardLine } from "./pixels.ts"
import { SEAT_COLS, heightOf, office as draw, slicesOf } from "./pixels.ts"
import { setLanguage, w } from "./words.ts"

// Every hook passes its event on unchanged. Three effects are the mod's own: this
// session's snapshot file, which is how the other sessions see it; the
// chairman's memos; and btw. A memo the person posts with `/office say` is handed
// to a session as a prompt of its own; only the person can post one, so no
// session sets another to work. A btw is answered beside the work, by a fork of
// the session's thread or a completion over a subagent's conversation, and
// never starts a turn.

const PANE = "crab-office"
const COMMAND = "office"
const BOARD_TOOL = "office_board"
const TICK_MS = 1000
const HEARTBEAT_MS = 5000
// The board pages by as many lines as it shows.
const BOARD_PAGE = 8
// Room for three desks a row between the room's walls.
const PANE_COLUMNS = SEAT_COLS * 3 + 2

// Module scope rather than register's, because the validator only lets `$` reach
// functions declared at the top of the file. A reload starts it over.
const office = {
  me: undefined as Snapshot | undefined,
  base: "",
  isDirty: true,
  lastWrite: 0,
  isOpen: false,
  isBandHidden: false,
  selected: null as string | null,
  others: [] as Snapshot[],
  memos: [] as Memo[],
  claims: [] as Claim[],
  stop: undefined as (() => void) | undefined,
  // Each other session's last finish already announced, so one finish toasts once.
  announced: new Map<string, number>(),
  // Part of the board field's key: a posted memo draws a new, empty field, as
  // redrawing the same field keeps what was typed in it.
  said: 0,
  // btw: each crab's questions and answers, newest last, while this module runs.
  chats: new Map<string, Chat[]>(),
  // The btw field's key, as `said` is the board field's.
  asked: 0,
  // How many lines back from the newest the board is paged, and the line shown
  // whole under the drawing.
  boardOlder: 0,
  note: null as string | null,
  // Asks from other sessions this one has taken up, so each is answered once.
  answered: new Set<string>(),
  // A background process the daemon keeps warm for a session nobody has opened
  // yet: it loads plugins like any session and drew as a second, phantom crab
  // beside the real one. It joins the office at its first turn.
  isSpare: false,
}

// A btw asked of a crab, or an instruction given to a session: `answer` is the
// btw's reply, or for an instruction to this session itself, that it went.
type Chat = { id: string; at: number; question: string; answer?: string; isRemote: boolean; kind: "btw" | "order" }

const GOLD = "#e8c468"
const CHALK = "#5d7a66"

// A board line shown whole, on a card the colour of the board.
function noteCard(el: Pick<ClientElements, "Box" | "Text">, note: BoardLine) {
  const { Box, Text } = el
  return (
    <Box key="note-card" flexDirection="column" borderStyle="round" borderColor={CHALK} paddingX={1}>
      <Box flexDirection="row" columnGap={1}>
        <Text dimColor>{note.time}</Text>
        <Text bold color={note.from.color}>
          {note.from.name}
        </Text>
        <Text dimColor>→</Text>
        <Text bold color={note.to.color}>
          {note.to.name}
        </Text>
      </Box>
      <Text wrap="wrap">{note.text}</Text>
    </Box>
  )
}

// A clicked crab on a card in its own colour: who, where and what it is doing,
// its task and tools, then the btw asked of it and the field to ask again. The
// pane and the band draw the same card.
function crabCard(
  el: Pick<ClientElements, "Box" | "Text" | "Input">,
  detail: Detail,
  chats: Chat[],
  inputKey: string,
  orders?: { key: string; obeyed: string[]; talk: Talk[] },
) {
  const { Box, Text, Input } = el
  const given = chats.filter((chat) => chat.kind === "order")
  return (
    <Box key="crab-card" flexDirection="column" borderStyle="round" borderColor={detail.color} paddingX={1}>
      <Box flexDirection="row" columnGap={1}>
        <Text bold color={detail.color}>
          {detail.title}
        </Text>
        <Text dimColor>{detail.where}</Text>
        <Text>{detail.state}</Text>
      </Box>
      {detail.rows.map((row) => (
        <Box key={`row-${row.label}`} flexDirection="row">
          <Box width={7}>
            <Text dimColor>{row.label}</Text>
          </Box>
          <Text wrap="wrap">{row.text}</Text>
        </Box>
      ))}
      {orders !== undefined &&
        orders.talk.map((line, i) => (
          <Box key={`talk-${i}`} flexDirection="row">
            <Box width={6}>
              <Text color={line.role === "user" ? GOLD : detail.color} bold>
                {line.role === "user" ? w().you : w().it}
              </Text>
            </Box>
            <Text wrap="wrap" dimColor={line.role === "user"}>
              {line.text}
            </Text>
          </Box>
        ))}
      {orders !== undefined &&
        given.map((chat) => (
          <Box key={`order-${chat.id}`} flexDirection="row" columnGap={2}>
            <Text color={GOLD} wrap="wrap">{`➤ ${chat.question}`}</Text>
            <Text dimColor>
              {chat.answer !== undefined || orders.obeyed.includes(chat.id) ? w().orderDelivered : w().orderQueued}
            </Text>
          </Box>
        ))}
      {orders !== undefined && (
        <Input
          key={orders.key}
          label={w().orderLabel}
          placeholder={w().orderPlaceholder}
          submitLabel={w().send}
          onSubmit={() => undefined}
        />
      )}
      {chats.filter((chat) => chat.kind === "btw").flatMap((chat) => [
        <Text key={`ask-${chat.id}`} color={GOLD} wrap="wrap">
          {`${w().you}${chat.question}`}
        </Text>,
        <Text key={`answer-${chat.id}`} wrap="wrap" dimColor={chat.answer === undefined}>
          {`${w().it}${chat.answer ?? w().thinkingDots}`}
        </Text>,
      ])}
      <Input key={inputKey} label="btw " placeholder={w().btwPlaceholder} submitLabel={w().ask} onSubmit={() => undefined} />
    </Box>
  )
}
const CHAT_KEPT = 5
// A question to another session waits this long for its answer, and an ask this
// session finds older than it is left alone: whoever asked has given up on it.
const ASK_WAIT_MS = 120_000

function idOf(now: number): string {
  return `${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

// A crab of this session answers for itself: the manager through a fork of the
// session's own thread; a subagent from its own conversation, or, once that can
// no longer be read, through its manager's fork.
async function answer($: EngineInterface, crabId: string, question: string): Promise<string> {
  const found = office.me === undefined ? undefined : findCrab([office.me], crabId)
  if (found === undefined) return w().crabGone
  const { crab } = found
  try {
    if (crab.role !== "leader") {
      const rows = await $.session.messages({ agentId: crabId })
      if (Array.isArray(rows)) {
        const model = crab.model ?? (await $.session.model())
        const r = await $.model.complete({ model, ...subagentBtwOf(crab, rows, question), maxTokens: 800 })
        return r.isAnswered ? r.text : w().noAnswer(r.reason)
      }
    }
    const r = await $.model.fork({ prompt: btwOf(crab, question) })
    if (r.isAnswered) return r.text
    return r.reason === "nothing-to-fork" ? w().notStartedYet : w().noAnswer(r.reason)
  } catch (err) {
    return w().noAnswer(String(err))
  }
}

function heard($: EngineInterface, crabId: string, id: string, text: string) {
  const chat = office.chats.get(crabId)?.find((c) => c.id === id)
  if (chat === undefined) return
  chat.answer = text
  $.ui.invalidate("ui.render")
}

async function ask($: EngineInterface, crabId: string, question: string) {
  const me = office.me
  const found = me === undefined ? undefined : findCrab([me, ...office.others], crabId)
  if (me === undefined || found === undefined || question.trim() === "") return
  const now = Date.now()
  const isRemote = found.snap.sessionId !== me.sessionId
  const chat: Chat = { id: idOf(now), at: now, question: question.trim(), isRemote, kind: "btw" }
  office.chats.set(crabId, [...(office.chats.get(crabId) ?? []), chat].slice(-CHAT_KEPT))
  office.asked += 1
  $.ui.invalidate("ui.render")
  if (!isRemote) return heard($, crabId, chat.id, await answer($, crabId, chat.question))
  const sent: Ask = { id: chat.id, at: now, to: found.snap.sessionId, crab: crabId, question: chat.question }
  await $.fs.write(`${office.base}/asks/${chat.id}.json`, JSON.stringify(sent))
}

// An instruction from a session's card: to this session, a prompt now, as if
// typed here; to another, a file it takes up on its next tick.
async function order($: EngineInterface, sessionId: string, text: string) {
  const me = office.me
  if (me === undefined || text.trim() === "") return
  const now = Date.now()
  const isRemote = sessionId !== me.sessionId
  const chat: Chat = { id: idOf(now), at: now, question: text.trim(), isRemote, kind: "order" }
  if (!isRemote) chat.answer = ""
  office.chats.set(sessionId, [...(office.chats.get(sessionId) ?? []), chat].slice(-CHAT_KEPT))
  office.asked += 1
  $.ui.invalidate("ui.render")
  if (!isRemote) return void (await $.prompt.submit({ text: chat.question }))
  const sent: Order = { id: chat.id, at: now, to: sessionId, text: chat.question }
  await $.fs.write(`${office.base}/orders/${chat.id}.json`, JSON.stringify(sent))
}

// Instructions for this session, each taken up once: the engine runs a prompt
// submitted while a turn is on once that turn ends, so none interrupts work.
async function obey($: EngineInterface, now: number) {
  const me = office.me
  if (me === undefined) return
  for (const o of ordersFor(me, await readJsonDir<Order>($, `${office.base}/orders`), now)) {
    me.obeyed = [...(me.obeyed ?? []), o.id]
    changed($)
    void $.prompt.submit({ text: orderPromptOf(o.text) })
  }
}

// What this session's card shows of its conversation, read from the transcript
// itself: at load, so a session reloaded a minute ago is not a blank, and as each
// turn ends.
async function refreshTalk($: EngineInterface) {
  const me = office.me
  if (me === undefined) return
  me.talk = talkOf(await $.session.messages())
  changed($)
}

async function reply($: EngineInterface, asked: Ask) {
  const text = await answer($, asked.crab, asked.question)
  const sent: Reply = { id: asked.id, at: Date.now(), text }
  await $.fs.write(`${office.base}/replies/${asked.id}.json`, JSON.stringify(sent))
}

// Asks of this session's crabs are answered one at a time as they come; answers
// to this session's asks are read back as they land.
async function btw($: EngineInterface, now: number) {
  const me = office.me
  if (me === undefined) return
  const asks = await readJsonDir<Ask>($, `${office.base}/asks`)
  for (const asked of asks) {
    if (asked.to !== me.sessionId || office.answered.has(asked.id) || now - asked.at > ASK_WAIT_MS) continue
    office.answered.add(asked.id)
    void reply($, asked)
  }
  for (const [crabId, chats] of office.chats)
    for (const chat of chats) {
      if (!chat.isRemote || chat.answer !== undefined) continue
      const text = await $.fs.read(`${office.base}/replies/${chat.id}.json`).catch(() => undefined)
      if (text !== undefined) heard($, crabId, chat.id, (JSON.parse(text) as Reply).text)
      else if (now - chat.at > ASK_WAIT_MS) heard($, crabId, chat.id, w().noReply)
    }
}

async function say($: EngineInterface, text: string): Promise<string> {
  const now = Date.now()
  const id = `${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
  const memo = parseSay(text, id, now)
  if (memo === undefined) return w().sayUsage
  await $.fs.write(`${office.base}/memos/${memo.id}.json`, JSON.stringify(memo))
  office.memos = [...office.memos, memo]
  $.ui.invalidate("ui.render")
  const to = memo.to.kind === "all" ? w().everyone : memo.to.kind === "team" ? memo.to.name : w().toOpen
  return w().posted(to, memo.text)
}

function changed($: EngineInterface) {
  office.isDirty = true
  $.ui.invalidate("ui.render")
}

function liveOf(sessionId: string): string {
  return `${office.base}/live/${sessionId}.json`
}

async function readOthers(
  $: EngineInterface,
  now: number,
): Promise<Snapshot[]> {
  const dir = `${office.base}/live`
  const entries = await $.fs.list(dir).catch(() => [])
  const fresh = entries.filter(
    (f) =>
      f.kind === "file" &&
      f.name.endsWith(".json") &&
      f.name !== `${office.me?.sessionId}.json` &&
      now - f.mtimeMs < LEAVE_MS,
  )
  const texts = await Promise.all(
    fresh.map((f) => $.fs.read(`${dir}/${f.name}`).catch(() => "")),
  )
  return texts.map(parseSnapshot).filter((s): s is Snapshot => s !== undefined)
}

async function readJsonDir<T>($: EngineInterface, dir: string): Promise<T[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const texts = await Promise.all(
    entries
      .filter((f) => f.kind === "file" && f.name.endsWith(".json"))
      .map((f) => $.fs.read(`${dir}/${f.name}`).catch(() => "")),
  )
  return texts.flatMap((text) => {
    try {
      return [JSON.parse(text) as T]
    } catch {
      return []
    }
  })
}

// A toast in the session whose office is open when another session's manager
// finishes a turn, naming the department and the team.
function announce($: EngineInterface, others: Snapshot[], now: number) {
  for (const s of others) {
    const finished = s.leader.finishedAt
    if (finished === undefined || now - finished > CHEER_MS) continue
    if (office.announced.get(s.sessionId) === finished) continue
    office.announced.set(s.sessionId, finished)
    $.ui.toast(w().finished(whoOf(s)))
  }
}

// Hands this session the one memo it should take up now, as a prompt of its own.
async function deliver($: EngineInterface, now: number) {
  const me = office.me
  if (me === undefined) return
  const snaps = [me, ...office.others]
  const memo = memoFor(me, snaps, office.memos, office.claims, now)
  if (memo === undefined) return
  // Whoever is typing in this session is at work in it, waiting or not.
  if ((await $.prompt.read()).text.trim() !== "") return
  const text = handoverOf(memo, me, snaps, now)
  me.handled = [...(me.handled ?? []), memo.id]
  // Busy in the same write that says it took the memo, so no other session
  // reads it as having passed before its turn starts.
  turnStarted(me, undefined, text, now)
  changed($)
  await $.prompt.submit({ text })
}

async function tick($: EngineInterface) {
  const me = office.me
  if (me === undefined || office.isSpare) return
  const now = Date.now()
  if (pruned(me, now)) changed($)
  if (office.isDirty || now - office.lastWrite >= HEARTBEAT_MS) {
    me.updatedAt = now
    office.isDirty = false
    office.lastWrite = now
    await $.fs.write(liveOf(me.sessionId), JSON.stringify(me))
  }
  office.others = await readOthers($, now)
  office.memos = await readJsonDir<Memo>($, `${office.base}/memos`)
  office.claims = await readJsonDir<Claim>($, `${office.base}/claims`)
  await deliver($, now)
  await btw($, now)
  await obey($, now)
  if (office.isOpen) announce($, office.others, now)
  // The elapsed times on screen move every second.
  if (office.isOpen || me.agents.length > 0) $.ui.invalidate("ui.render")
}

// A reload starts the module over; the board and the memos already handed are
// read back from this session's own snapshot, so nothing is handed twice, and so
// is when it started: seniority picks each department's 大部长 and hands out the
// hats, and taken from the reload it crowned whichever session reloaded first.
async function restore($: EngineInterface, me: Snapshot) {
  const before = parseSnapshot(
    await $.fs.read(liveOf(me.sessionId)).catch(() => ""),
  )
  if (before === undefined || before.sessionId !== me.sessionId) return
  me.startedAt = Math.min(me.startedAt, before.startedAt)
  me.board = before.board ?? []
  me.handled = before.handled ?? []
  if (before.seen !== undefined) me.seen = before.seen
  me.obeyed = before.obeyed ?? []
}

async function claim(
  $: EngineInterface,
  memoId: string,
  agentId: string | undefined,
): Promise<string> {
  const me = office.me
  if (me === undefined) return w().tool.notReady
  const memo = office.memos.find((m) => m.id === memoId)
  if (memo === undefined) return w().tool.noMemo(memoId)
  // Only a memo for whoever is free is one session's: a named or everyone's
  // memo is each addressee's to take, so each claim is a file of its own.
  const isOpen = memo.to.kind === "open"
  const file = `${office.base}/claims/${isOpen ? memoId : `${memoId}.${me.sessionId}`}.json`
  const prior = await $.fs.read(file).catch(() => undefined)
  if (prior !== undefined) {
    const by = JSON.parse(prior) as Claim
    return by.sessionId === me.sessionId
      ? w().tool.claimedAlready
      : w().tool.claimedBy(by.who)
  }
  const claimed: Claim = {
    memoId,
    at: Date.now(),
    sessionId: me.sessionId,
    who: whoOf(me),
  }
  await $.fs.write(file, JSON.stringify(claimed))
  office.claims = [...office.claims, claimed]
  messageSent(me, agentId, w().chairman, w().tool.claimNote(memo.text), Date.now())
  return w().tool.claimed
}

export const register: Register = (on, options) => {
  setLanguage(typeof options.language === "string" ? options.language : undefined)
  on("session.start", async ($, e, next) => {
    const r = await next(e)
    const [sessionId, root, model, configDir, home, kind] = await Promise.all([
      $.session.id(),
      $.session.root().catch(() => e.cwd),
      $.session.model().catch(() => undefined),
      $.env.get("CLAUDE_CONFIG_DIR"),
      $.env.get("HOME"),
      $.env.get("CLAUDE_CODE_SESSION_KIND"),
    ])
    office.isSpare = kind === "bg"
    office.base = `${configDir || `${home}/.claude`}/crab-office`
    // A worktree's `.git` is a file naming its repository; a checkout's is a
    // folder, which a read rejects.
    const gitFile = await $.fs.read(`${root}/.git`).catch(() => undefined)
    const place = placeOf(root, gitFile)
    office.me = createSnapshot(
      sessionId,
      place.project,
      model,
      Date.now(),
      place.team,
    )
    await restore($, office.me)
    await refreshTalk($).catch(() => undefined)
    office.isDirty = true
    await $.command.register({
      name: COMMAND,
      description: w().commandDescription,
      argumentHint: w().commandHint,
      immediate: true,
    })
    await $.tool.register({
      name: BOARD_TOOL,
      description:
        w().tool.description,
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["read", "post", "colleagues", "claim"] },
          memo: { type: "string", description: w().tool.memo },
          text: { type: "string", description: w().tool.text },
          to: { type: "string", description: w().tool.to },
        },
        required: ["action"],
      },
      isDeferred: false,
    })
    office.stop?.()
    const timer = $.clock.every(TICK_MS, () => {
      tick($).catch((err) =>
        $.ui.log(`crab-office: tick failed: ${err}`, { to: "debug" }),
      )
    })
    office.stop = () => timer.cancel()
    return r
  })

  on("session.end", async ($, e, next) => {
    office.stop?.()
    const me = office.me
    if (me !== undefined) {
      me.ended = true
      me.updatedAt = Date.now()
      await $.fs
        .write(liveOf(me.sessionId), JSON.stringify(me))
        .catch(() => undefined)
    }
    return next(e)
  })

  on("turn.start", ($, e, next) => {
    if (e.agentId === undefined) office.isSpare = false
    // What was just said to it shows on its card at once, not when the turn ends.
    if (office.me !== undefined && e.agentId === undefined) {
      const said = talkOf([{ role: "user", text: e.text }])
      office.me.talk = [...(office.me.talk ?? []), ...said].slice(-6)
    }
    if (office.me !== undefined) {
      turnStarted(office.me, e.agentId, e.text, Date.now())
      changed($)
    }
    return next(e)
  })

  on("agent.spawn", async ($, e, next) => {
    const r = await next(e)
    if (office.me !== undefined && r.agentId !== undefined) {
      spawned(
        office.me,
        {
          agentId: r.agentId,
          parentId: e.parentAgentId,
          type: e.subagentType,
          isFork: e.fork,
          model: r.model,
          description: e.description,
          prompt: e.prompt,
        },
        Date.now(),
      )
      changed($)
    }
    return r
  })

  // Every SendMessage from any of this session's loops, to its own crabs or to
  // another session, goes up on the shared board.
  on("session.send", ($, e, next) => {
    if (office.me !== undefined) {
      messageSent(office.me, e.agentId, e.to, e.text, Date.now())
      changed($)
    }
    return next(e)
  })

  // The board tool the model calls to take up a memo, say something, or see
  // who else is in the company. Matched by pattern: a tool the mod registers
  // is not among the names the types know until the mod has loaded.
  on("tool.call", { tool: /^mcp__crab-office__office_board$/ }, async ($, e) => {
    const input = e as unknown as {
      action?: string
      memo?: string
      text?: string
      to?: string
      agentId?: string
    }
    const me = office.me
    if (me === undefined) return { result: w().tool.notReady }
    const now = Date.now()
    const snaps = [me, ...office.others]
    const names = addresseesOf(snaps, now, "").map((r) => r.text.trim()).join(" ")
    if (input.action === "read") {
      const inbox = inboxOf(me, snaps, now)
      me.seen = now
      changed($)
      return {
        result: [
          inbox.length > 0 ? w().tool.inbox(inbox) : w().tool.noInbox,
          w().tool.latest(boardOf(snaps, now)),
        ].join("\n\n"),
      }
    }
    const unread = inboxOf(me, snaps, now).length
    const nudge = unread > 0 ? w().tool.unread(unread) : ""
    if (input.action === "claim")
      return { result: `${await claim($, input.memo ?? "", input.agentId)}${nudge}` }
    if (input.action === "post") {
      if (!input.text) return { result: w().tool.empty }
      const to = input.to?.trim() || w().chairman
      const target = targetOf(to)
      const reach = target === undefined ? [] : recipientsOf(target, me, snaps, now).map(whoOf)
      if (target !== undefined && reach.length === 0)
        return { result: `${w().tool.nobody(to, names)}${nudge}` }
      messageSent(me, input.agentId, to, input.text, now)
      changed($)
      const heard = target === undefined ? w().tool.heardByChairman : w().tool.heardBy(reach)
      return { result: `${w().tool.written(heard)}${nudge}` }
    }
    return {
      result: `${rosterOf(snaps, me, now).join("\n")}\n${w().tool.canWriteTo(names)}${nudge}`,
    }
  })

  on("tool.call", async ($, e, next) => {
    if (office.me === undefined) return next(e)
    toolStarted(
      office.me,
      e.agentId,
      e.tool,
      toolLabel(e.tool, e as unknown as Record<string, unknown>),
      Date.now(),
    )
    changed($)
    try {
      return await next(e)
    } finally {
      if (office.me !== undefined) {
        toolFinished(office.me, e.agentId, Date.now())
        changed($)
      }
    }
  })

  // Raised as a permission dialog opens. `tool.check` answering `ask` was tried
  // first and raised a hand on nearly every call in auto mode, where the ask goes
  // to the classifier and nobody is shown anything.
  on("classic.PermissionRequest", ($, e, next) => {
    if (office.me !== undefined && e.permission_mode !== "auto") {
      toolAsked(office.me, e.agent_id, Date.now())
      changed($)
    }
    return next(e)
  })

  on("turn.complete", async ($, e, next) => {
    const r = await next(e)
    if (office.me !== undefined) {
      turnFinished(
        office.me,
        e.agentId,
        {
          isAnswer: e.reason === "answer",
          answer: e.answer,
          model: e.usage?.model,
        },
        Date.now(),
      )
      changed($)
      if (e.agentId === undefined) await refreshTalk($).catch(() => undefined)
    }
    return r
  })

  // Only the first word after `/office say` can name who a memo is for.
  on("prompt.autocomplete", { token: /^@/ }, async ($, e, next) => {
    const result = await next(e)
    const me = office.me
    if (me === undefined || !/^\/office\s+say\s+$/.test(e.text.slice(0, e.start))) return result
    const rows = addresseesOf([me, ...office.others], Date.now(), e.token.slice(1))
    return { suggestions: [...result.suggestions, ...rows] }
  })

  on("command.run", { command: COMMAND }, async ($, e) => {
    const args = e.args.trim()
    const arg = args.toLowerCase()
    if (arg === "close") {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      office.isOpen = false
      return { text: w().closed }
    }
    if (arg === "band") {
      office.isBandHidden = !office.isBandHidden
      $.ui.invalidate("ui.render")
      return {
        text: w().band(office.isBandHidden),
      }
    }
    if (arg.startsWith("say")) return { text: await say($, args.slice(3)) }
    try {
      await $.ui.open({
        id: PANE,
        title: w().paneTitle,
        focus: true,
        columns: PANE_COLUMNS,
      })
    } catch (err) {
      return { text: w().paneFailed(String(err)) }
    }
    office.isOpen = true
    office.others = await readOthers($, Date.now())
    $.ui.invalidate("ui.render")
    const hint = e.presentation.isFullscreen
      ? w().hintFull
      : w().hintInline
    return { text: `${hint}${w().hintTail}` }
  })

  on("ui.input", { element: /^office-say-/ }, async ($, e, next) => {
    if (e.kind !== "submit") return next(e)
    $.ui.toast(await say($, e.value))
    office.said += 1
    return next(e)
  })

  on("ui.input", { element: /^office-order-/ }, async ($, e, next) => {
    if (e.kind !== "submit" || office.selected === null) return next(e)
    const found = findCrab([...(office.me ? [office.me] : []), ...office.others], office.selected)
    if (found?.crab.role === "leader") void order($, found.snap.sessionId, e.value)
    return next(e)
  })

  on("ui.input", { element: /^office-btw-/ }, async ($, e, next) => {
    if (e.kind !== "submit" || office.selected === null) return next(e)
    void ask($, office.selected, e.value)
    return next(e)
  })

  on("ui.close", ($, e, next) => {
    if (e.id === PANE) office.isOpen = false
    return next(e)
  })

  on("ui.message", ($, e, next) => {
    if (!e.element.startsWith("crab-office") && e.element !== "crab-band") return next(e)
    const data = e.data as { select?: unknown; drawn?: unknown; board?: unknown; note?: unknown } | null
    // A drawing's first frame reports itself, so the snapshot shows the
    // surface module really drew in this session.
    if (data?.drawn === true) {
      if (office.me !== undefined) {
        office.me.drawn = { ...office.me.drawn, [e.element]: Date.now() }
        office.isDirty = true
      }
      return next(e)
    }
    if (data?.board === "older" || data?.board === "newer") {
      office.boardOlder = Math.max(0, office.boardOlder + (data.board === "older" ? BOARD_PAGE : -BOARD_PAGE))
      $.ui.invalidate("ui.render")
      return next(e)
    }
    office.selected = typeof data?.select === "string" ? data.select : null
    const note = typeof data?.note === "string" ? data.note : null
    office.note = note === office.note ? null : note
    $.ui.invalidate("ui.render")
    return next(e)
  })

  on(
    "ui.render",
    { component: "Pane", requestId: PANE },
    async ($, e, next) => {
      // Only the terminal has a Client to draw the crabs with.
      if (e.surface !== "terminal") return next(e)
      const { Box, Text, Client, Input } = $.ui.resolve(e)
      const now = Date.now()
      const me = office.me
      const snaps = me !== undefined ? [me, ...office.others] : office.others
      const names = addresseesOf(snaps, now, "").map((r) => r.text.trim())
      const company = companyOf(
        snaps,
        me?.sessionId ?? "",
        now,
        { memos: office.memos, claims: office.claims },
        office.boardOlder,
      )
      // Paged past the oldest line kept, the count comes back to where it shows.
      if (company.boardView !== undefined)
        office.boardOlder = company.boardView.total - company.boardView.last
      const note = company.board?.find((line) => line.key === office.note)
      const chosen =
        office.selected !== null ? findCrab(snaps, office.selected) : undefined
      return (
        <Box flexDirection="column">
          {slicesOf(draw(company, e.props.bodyColumns, 0, office.selected).cells).map((rows, i) => (
            <Client
              key={`crab-office-${i}`}
              module="./crabs.tsx"
              props={{ company, selected: office.selected, rows }}
              width={e.props.bodyColumns}
              height={rows[1] - rows[0]}
            />
          ))}
          <Box flexDirection="column" borderStyle="round" borderColor="#5d7a66" paddingX={1}>
            <Input
              key={`office-say-${office.said}`}
              label={w().sayLabel}
              placeholder={w().sayPlaceholder}
              submitLabel={w().post}
              onSubmit={() => undefined}
            />
            <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
              <Text dimColor>{w().call}</Text>
              {names.map((name) => (
                <Text key={`to-${name}`} color="#e8c468" backgroundColor="#2e3a33">
                  {` ${name} `}
                </Text>
              ))}
              <Text dimColor>{w().uncalled}</Text>
            </Box>
          </Box>
          {note !== undefined && noteCard({ Box, Text }, note)}
          {chosen !== undefined &&
            crabCard(
              { Box, Text, Input },
              detailOf(chosen.crab, chosen.snap, now, snaps),
              office.chats.get(chosen.crab.id) ?? [],
              `office-btw-${office.asked}-${chosen.crab.id}`,
              chosen.crab.role === "leader"
                ? {
                    key: `office-order-${office.asked}-${chosen.crab.id}`,
                    obeyed: chosen.snap.obeyed ?? [],
                    talk: chosen.snap.talk ?? [],
                  }
                : undefined,
            )}
        </Box>
      )
    },
  )

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const me = office.me
    const isQuiet =
      me === undefined ||
      office.isBandHidden ||
      e.props.hasSurvey ||
      me.agents.length === 0 ||
      e.surface !== "terminal"
    if (isQuiet) return next(e)
    const { Box, Text, Client, Input } = $.ui.resolve(e)
    const now = Date.now()
    const band = bandOf(me, [me, ...office.others], now)
    const chosen =
      office.selected !== null ? findCrab([me], office.selected) : undefined
    return (
      <Box flexDirection="column">
        <Client
          key="crab-band"
          module="./crabs.tsx"
          props={{ company: band, selected: office.selected }}
          height={heightOf(band, 0)}
          flexGrow={1}
        />
        {chosen !== undefined &&
          crabCard(
            { Box, Text, Input },
            detailOf(chosen.crab, chosen.snap, now, [me, ...office.others]),
            (office.chats.get(chosen.crab.id) ?? []).slice(-1),
            `office-btw-band-${office.asked}-${chosen.crab.id}`,
            chosen.crab.role === "leader"
              ? {
                  key: `office-order-band-${office.asked}-${chosen.crab.id}`,
                  obeyed: chosen.snap.obeyed ?? [],
                  talk: (chosen.snap.talk ?? []).slice(-2),
                }
              : undefined,
          )}
      </Box>
    )
  })
}
