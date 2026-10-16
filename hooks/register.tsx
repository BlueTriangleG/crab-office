import type { EngineInterface, Register } from "claude-code"

import {
  CHEER_MS,
  LEAVE_MS,
  bandOf,
  companyOf,
  createSnapshot,
  detailLines,
  findCrab,
  handoverOf,
  boardOf,
  btwOf,
  inboxOf,
  memoFor,
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
  toolAsked,
  toolFinished,
  toolLabel,
  toolStarted,
  turnFinished,
  turnStarted,
  whoOf,
} from "./office.ts"
import type { Ask, Claim, Memo, Reply, Snapshot } from "./office.ts"
import { SEAT_COLS, heightOf, office as draw, slicesOf } from "./pixels.ts"

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
  // Asks from other sessions this one has taken up, so each is answered once.
  answered: new Set<string>(),
}

type Chat = { id: string; at: number; question: string; answer?: string; isRemote: boolean }
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
  if (found === undefined) return "这只螃蟹已经不在了"
  const { crab } = found
  try {
    if (crab.role !== "leader") {
      const rows = await $.session.messages({ agentId: crabId })
      if (Array.isArray(rows)) {
        const model = crab.model ?? (await $.session.model())
        const r = await $.model.complete({ model, ...subagentBtwOf(crab, rows, question), maxTokens: 800 })
        return r.isAnswered ? r.text : `没答上来（${r.reason}）`
      }
    }
    const r = await $.model.fork({ prompt: btwOf(crab, question) })
    if (r.isAnswered) return r.text
    return r.reason === "nothing-to-fork" ? "还没开始干活，没什么可说的" : `没答上来（${r.reason}）`
  } catch (err) {
    return `没答上来（${err}）`
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
  const chat: Chat = { id: idOf(now), at: now, question: question.trim(), isRemote }
  office.chats.set(crabId, [...(office.chats.get(crabId) ?? []), chat].slice(-CHAT_KEPT))
  office.asked += 1
  $.ui.invalidate("ui.render")
  if (!isRemote) return heard($, crabId, chat.id, await answer($, crabId, chat.question))
  const sent: Ask = { id: chat.id, at: now, to: found.snap.sessionId, crab: crabId, question: chat.question }
  await $.fs.write(`${office.base}/asks/${chat.id}.json`, JSON.stringify(sent))
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
      else if (now - chat.at > ASK_WAIT_MS) heard($, crabId, chat.id, "没回音：那边可能没装新版本，或者已经下班了")
    }
}

async function say($: EngineInterface, text: string): Promise<string> {
  const now = Date.now()
  const id = `${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
  const memo = parseSay(text, id, now)
  if (memo === undefined) return "要说什么？/office say [@组名|@全体] 留言"
  await $.fs.write(`${office.base}/memos/${memo.id}.json`, JSON.stringify(memo))
  office.memos = [...office.memos, memo]
  $.ui.invalidate("ui.render")
  const to =
    memo.to.kind === "all"
      ? "全体"
      : memo.to.kind === "team"
        ? `${memo.to.name}`
        : "待领，谁先空下来谁看"
  return `已经贴到白板上（${to}）：${memo.text}`
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
    const team = s.team ? ` · ${s.team}` : ""
    $.ui.toast(`✓ ${s.project} 部${team} 完成了`)
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
  if (me === undefined) return
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
}

async function claim(
  $: EngineInterface,
  memoId: string,
  agentId: string | undefined,
): Promise<string> {
  const me = office.me
  if (me === undefined) return "办公室还没准备好"
  const memo = office.memos.find((m) => m.id === memoId)
  if (memo === undefined) return `白板上没有 memo ${memoId}`
  // Only a memo for whoever is free is one session's: a named or everyone's
  // memo is each addressee's to take, so each claim is a file of its own.
  const isOpen = memo.to.kind === "open"
  const file = `${office.base}/claims/${isOpen ? memoId : `${memoId}.${me.sessionId}`}.json`
  const prior = await $.fs.read(file).catch(() => undefined)
  if (prior !== undefined) {
    const by = JSON.parse(prior) as Claim
    return by.sessionId === me.sessionId
      ? "你已经认领过了，继续做吧"
      : `已经被 ${by.who} 认领了，停下，别做这件事`
  }
  const claimed: Claim = {
    memoId,
    at: Date.now(),
    sessionId: me.sessionId,
    who: whoOf(me),
  }
  await $.fs.write(file, JSON.stringify(claimed))
  office.claims = [...office.claims, claimed]
  messageSent(me, agentId, "董事长", `我来接：${memo.text}`, Date.now())
  return "认领成功，白板上大家都看得到是你接的。开始做吧，做完在白板上说一声。"
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e)
    const [sessionId, root, model, configDir, home] = await Promise.all([
      $.session.id(),
      $.session.root().catch(() => e.cwd),
      $.session.model().catch(() => undefined),
      $.env.get("CLAUDE_CONFIG_DIR"),
      $.env.get("HOME"),
    ])
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
    office.isDirty = true
    await $.command.register({
      name: COMMAND,
      description:
        "Every session and its subagents as crabs in an office (close|band|say)",
      argumentHint: "[close|band|say [@组名|@全体] 留言]",
      immediate: true,
    })
    await $.tool.register({
      name: BOARD_TOOL,
      description:
        "螃蟹办公室的共享白板。这台机器上同时开着的其他 Claude Code 会话是你的同事，各在自己的项目或 worktree 里干活，白板他们都看得到。开工前、做完一件事、碰到和别的会话有关的事（要它配合、提醒它别动某处、告诉它你改了它会用到的东西）时用它。action=read 看白板最近的话和同事写给你的消息；action=post 写一句：to 写同事的组名（worktree 名）、部门名（项目名）或「全体」就是写给他们，他们下次看白板时收到，不会被打断；不写 to 就是写给董事长（用户）；action=colleagues 看同事都是谁、在干什么、能写给谁；action=claim 认领董事长的留言（memo id 在留言开头的方括号里），认领后别的会话就不会再接。",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["read", "post", "colleagues", "claim"] },
          memo: { type: "string", description: "要认领的 memo id" },
          text: { type: "string", description: "要写在白板上的话" },
          to: { type: "string", description: "写给谁：同事的组名、部门名或「全体」；不写就是写给董事长" },
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
    if (me === undefined) return { result: "办公室还没准备好" }
    const now = Date.now()
    const snaps = [me, ...office.others]
    const names = addresseesOf(snaps, now, "").map((r) => r.text.trim()).join(" ")
    if (input.action === "read") {
      const inbox = inboxOf(me, snaps)
      me.seen = now
      changed($)
      return {
        result: [
          inbox.length > 0 ? `同事写给你的（${inbox.length} 条）：\n${inbox.join("\n")}` : "没有同事写给你的新消息。",
          `白板最近的话：\n${boardOf(snaps).join("\n") || "（白板是空的）"}`,
        ].join("\n\n"),
      }
    }
    const unread = inboxOf(me, snaps).length
    const nudge = unread > 0 ? `\n（同事给你写了 ${unread} 条还没看的消息，用 action=read 看）` : ""
    if (input.action === "claim")
      return { result: `${await claim($, input.memo ?? "", input.agentId)}${nudge}` }
    if (input.action === "post") {
      if (!input.text) return { result: "要写的话是空的" }
      const to = input.to?.trim() || "董事长"
      const target = targetOf(to)
      const reach = target === undefined ? [] : recipientsOf(target, me, snaps, now).map(whoOf)
      if (target !== undefined && reach.length === 0)
        return { result: `现在没有叫 ${to} 的同事在岗，没写。能写给：${names}${nudge}` }
      messageSent(me, input.agentId, to, input.text, now)
      changed($)
      const heard = target === undefined ? "董事长看得到" : `${reach.join("、")} 下次看白板时会收到，不会打断他们`
      return { result: `已经写到白板上了，${heard}。${nudge}` }
    }
    return {
      result: `${rosterOf(snaps, me, now).join("\n")}\n能写给：${names}${nudge}`,
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
      return { text: "办公室关了" }
    }
    if (arg === "band") {
      office.isBandHidden = !office.isBandHidden
      $.ui.invalidate("ui.render")
      return {
        text: `输入框上方的螃蟹${office.isBandHidden ? "藏起来了" : "回来了"}`,
      }
    }
    if (arg.startsWith("say")) return { text: await say($, args.slice(3)) }
    try {
      await $.ui.open({
        id: PANE,
        title: "螃蟹有限公司",
        focus: true,
        columns: PANE_COLUMNS,
      })
    } catch (err) {
      return { text: `面板没打开: ${err}` }
    }
    office.isOpen = true
    office.others = await readOthers($, Date.now())
    $.ui.invalidate("ui.render")
    const hint = e.presentation.isFullscreen
      ? "点一只螃蟹看详情"
      : "画在输入框上方；/tui fullscreen 让它停靠在右侧"
    return { text: `${hint} · /office say 在白板上留言 · /office close 关掉` }
  })

  on("ui.input", { element: /^office-say-/ }, async ($, e, next) => {
    if (e.kind !== "submit") return next(e)
    $.ui.toast(await say($, e.value))
    office.said += 1
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
    const data = e.data as { select?: unknown; drawn?: unknown } | null
    // A drawing's first frame reports itself, so the snapshot shows the
    // surface module really drew in this session.
    if (data?.drawn === true) {
      if (office.me !== undefined) {
        office.me.drawn = { ...office.me.drawn, [e.element]: Date.now() }
        office.isDirty = true
      }
      return next(e)
    }
    office.selected = typeof data?.select === "string" ? data.select : null
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
      const company = companyOf(snaps, me?.sessionId ?? "", now, {
        memos: office.memos,
        claims: office.claims,
      })
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
              label="✎ 写在白板上 "
              placeholder="比如：@全体 下班前把测试补齐"
              submitLabel="贴上"
              onSubmit={() => undefined}
            />
            <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
              <Text dimColor>点名</Text>
              {names.map((name) => (
                <Text key={`to-${name}`} color="#e8c468" backgroundColor="#2e3a33">
                  {` ${name} `}
                </Text>
              ))}
              <Text dimColor>· 不点名就谁有空谁接</Text>
            </Box>
          </Box>
          {chosen !== undefined &&
            detailLines(chosen.crab, chosen.snap, now).map((line, i) => (
              <Text key={`detail-${i}`} wrap="wrap" bold={i === 0}>
                {line}
              </Text>
            ))}
          {chosen !== undefined &&
            (office.chats.get(chosen.crab.id) ?? []).flatMap((chat) => [
              <Text key={`ask-${chat.id}`} color="#e8c468" wrap="wrap">
                {`你：${chat.question}`}
              </Text>,
              <Text key={`answer-${chat.id}`} wrap="wrap" dimColor={chat.answer === undefined}>
                {`它：${chat.answer ?? "……正在想"}`}
              </Text>,
            ])}
          {chosen !== undefined && (
            <Input
              key={`office-btw-${office.asked}-${chosen.crab.id}`}
              label="btw "
              placeholder="问它一句：在干什么？干得咋样？"
              submitLabel="问"
              onSubmit={() => undefined}
            />
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
          detailLines(chosen.crab, chosen.snap, now).map((line, i) => (
            <Text key={`detail-${i}`} wrap="truncate" dimColor={i > 0}>
              {line}
            </Text>
          ))}
        {chosen !== undefined &&
          (office.chats.get(chosen.crab.id) ?? []).slice(-1).flatMap((chat) => [
            <Text key={`ask-${chat.id}`} color="#e8c468" wrap="truncate">
              {`你：${chat.question}`}
            </Text>,
            <Text key={`answer-${chat.id}`} wrap="wrap" dimColor={chat.answer === undefined}>
              {`它：${chat.answer ?? "……正在想"}`}
            </Text>,
          ])}
        {chosen !== undefined && (
          <Input
            key={`office-btw-band-${office.asked}-${chosen.crab.id}`}
            label="btw "
            placeholder="问它一句：在干什么？干得咋样？"
            submitLabel="问"
            onSubmit={() => undefined}
          />
        )}
      </Box>
    )
  })
}
