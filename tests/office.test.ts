import { expect, test } from "claude-code/testing"

import {
  CHEER_MS,
  CREW_COLORS,
  DONE_KEEP_MS,
  LEAVE_MS,
  MAIL_MS,
  SLEEP_MS,
  STALE_MS,
  addresseesOf,
  bandOf,
  boardOf,
  btwOf,
  inboxOf,
  recipientsOf,
  targetOf,
  subagentBtwOf,
  companyOf,
  createSnapshot,
  detailOf,
  findCrab,
  handoverOf,
  hatsOf,
  memoFor,
  orderPromptOf,
  ordersFor,
  parseSay,
  messageSent,
  parseSnapshot,
  placeOf,
  promptOf,
  pruned,
  seatOf,
  spawned,
  talkOf,
  toolAsked,
  toolFinished,
  toolLabel,
  toolStarted,
  turnFinished,
  turnStarted,
} from "../hooks/office.ts"
import { LEADER_COLOR } from "../hooks/pixels.ts"

import { setLanguage } from "../hooks/words.ts"

// These tests read the office in Chinese, the words it was first written in.
setLanguage("zh")

const T0 = 1_000_000

function hire(
  s: ReturnType<typeof createSnapshot>,
  agentId: string,
  type = "Explore",
) {
  spawned(
    s,
    {
      agentId,
      type,
      isFork: false,
      model: "claude-haiku-5-5",
      description: "map packages",
      prompt: "List every package",
    },
    T0,
  )
}

function withAgent() {
  const s = createSnapshot("s1", "web-app", "claude-opus-5-5", T0)
  hire(s, "a1")
  return s
}

test("a subagent walks from thinking through a tool to done, then leaves", async () => {
  const s = withAgent()
  toolStarted(
    s,
    "a1",
    "Read",
    toolLabel("Read", { file_path: "/x/y/package.json" }),
    T0 + 1,
  )
  expect(s.agents[0]?.status).toBe("reading")
  expect(s.agents[0]?.tools).toEqual(["Read package.json"])
  toolFinished(s, "a1", T0 + 2)
  expect(s.agents[0]?.status).toBe("thinking")
  turnFinished(
    s,
    "a1",
    { isAnswer: true, answer: "  seven\n packages " },
    T0 + 3,
  )
  expect(s.agents[0]?.status).toBe("done")
  expect(s.agents[0]?.answer).toBe("seven packages")
  expect(pruned(s, T0 + 3 + DONE_KEEP_MS - 1)).toBe(false)
  expect(pruned(s, T0 + 3 + DONE_KEEP_MS)).toBe(true)
  expect(s.agents).toEqual([])
})

test("the leader takes the prompt, raises a hand for approval, then waits and falls asleep", async () => {
  const s = withAgent()
  turnStarted(s, undefined, "fix the   persona test", T0)
  expect(s.leader.title).toBe("fix the persona test")
  toolStarted(s, undefined, "Bash", "Bash pnpm test", T0 + 1)
  toolAsked(s, undefined, T0 + 2)
  expect(s.leader.status).toBe("approval")
  turnFinished(
    s,
    undefined,
    { isAnswer: true, answer: "done", model: "claude-opus-5-5" },
    T0 + 3,
  )
  expect(s.leader.status).toBe("idle")
  expect(seatOf(s.leader, T0 + 3 + SLEEP_MS - 1, false).look).toBe("idle")
  expect(seatOf(s.leader, T0 + 4 + SLEEP_MS, false).look).toBe("asleep")
  expect(seatOf(s.leader, T0 + 4, true).look).toBe("gone")
})

test("a manager's task is what the person asked, without the tags around it", async () => {
  const goal =
    "<command-name>/goal</command-name>\n<command-message>goal</command-message>\n<command-args>完善办公室设计</command-args>" +
    "<local-command-stdout>Goal set: 完善办公室设计</local-command-stdout>"
  expect(promptOf(goal)).toBe("/goal 完善办公室设计")
  // a memo handed over is its memo, not the handover with its roster
  const handover = "The crab-office plugin sent a message: [螃蟹办公室 · 董事长在白板上的留言 · 待领 · memo m1]\n全体扣工资\n\n你是 web-app 部 · 本部 的部长。公司里现在的同事：\n- …"
  expect(promptOf(handover)).toBe("留言：全体扣工资")
  expect(promptOf("[crab-office · the chairman's memo on the board · everyone · memo m2]\nship it\n\nYou are…")).toBe("留言：ship it")
  expect(
    promptOf("<system-reminder>be brief</system-reminder>为啥我看不到"),
  ).toBe("为啥我看不到")
  expect(
    promptOf("<bash-input>ls apps</bash-input><bash-stdout>x</bash-stdout>"),
  ).toBe("! ls apps")
  expect(promptOf("plain words")).toBe("plain words")
})

test("a failed subagent is marked failed, not done", async () => {
  const s = withAgent()
  turnFinished(s, "a1", { isAnswer: false, answer: "" }, T0 + 1)
  expect(s.agents[0]?.status).toBe("failed")
})

test("the leader wears Clawd's own colour, the crew a colour each in hiring order", async () => {
  const s = withAgent()
  hire(s, "a2", "Plan")
  expect(seatOf(s.leader, T0, false)).toEqual({
    id: "s1",
    role: "leader",
    task: "",
    look: "idle",
    color: LEADER_COLOR,
  })
  expect(seatOf(s.agents[0]!, T0, false).color).toBe(CREW_COLORS[0]!)
  expect(seatOf(s.agents[1]!, T0, false).color).toBe(CREW_COLORS[1]!)
  expect(seatOf(s.agents[1]!, T0, false).task).toBe("map packages")
})

test("the company puts my department and my team first, and lets long-gone sessions go", async () => {
  const now = T0 + 10_000
  const mine = withAgent()
  mine.updatedAt = now
  const sibling = createSnapshot("s2", "web-app", undefined, T0 - 5)
  sibling.updatedAt = now - STALE_MS - 1
  const elsewhere = createSnapshot("s3", "api-server", undefined, T0)
  elsewhere.updatedAt = now
  const longGone = createSnapshot("s4", "old", undefined, T0)
  longGone.updatedAt = now - LEAVE_MS - 1

  const company = companyOf([elsewhere, longGone, sibling, mine], "s1", now)

  expect(company.rooms.map((r) => r.title)).toEqual([
    "web-app 部",
    "api-server 部",
  ])
  expect(company.rooms[0]?.teams.map((team) => team.map((s) => s.id))).toEqual([
    ["s1", "a1"],
    ["s2"],
  ])
  expect(company.rooms[0]?.teams[1]?.[0]?.look).toBe("gone")
  expect(company.rooms.map((r) => r.here)).toEqual([0, undefined])
  expect(company.rooms[0]?.footer).toBe("1 在干活  1 等你  1 下班")
  expect(company.header).toBe("螃蟹有限公司  董事长：你  在岗 3 人")
})

test("the band is this session's team on one bare row", async () => {
  const mine = withAgent()
  const band = bandOf(mine, [mine], T0)
  expect(band.header).toBeUndefined()
  expect(band.rooms).toHaveLength(1)
  expect(band.rooms[0]?.bare).toBe(true)
  expect(band.rooms[0]?.teams[0]?.map((s) => s.id)).toEqual(["s1", "a1"])
})

test("a click finds the crab and its detail carries what passed between them", async () => {
  const s = withAgent()
  turnFinished(s, "a1", { isAnswer: true, answer: "seven" }, T0 + 1)
  const found = findCrab([s], "a1")
  expect(found?.snap.sessionId).toBe("s1")
  const card = detailOf(found!.crab, found!.snap, T0 + 2)
  expect(card.title).toBe("调研员")
  expect(card.where).toBe("web-app 部 · 本部")
  expect(card.rows).toEqual([
    { label: "收到", text: "List every package" },
    { label: "交回", text: "seven" },
  ])
  // the manager's card names it as the drawing does: alone in its department, 大部长
  expect(detailOf(s.leader, s, T0 + 2, [s]).title).toBe("大部长")
})

test("a snapshot file that is not one is ignored", async () => {
  expect(parseSnapshot("{")).toBeUndefined()
  expect(parseSnapshot('{"v":2}')).toBeUndefined()
  expect(parseSnapshot(JSON.stringify(withAgent()))?.agents.length).toBe(1)
})

test("the shared board hears work handed down, handed back and messages passed", async () => {
  const s = withAgent()
  turnFinished(s, "a1", { isAnswer: true, answer: "seven packages" }, T0 + 5)
  messageSent(s, "a1", "s1", "one more thing", T0 + 6)
  messageSent(s, undefined, "reviewer", "please look", T0 + 7)
  expect(s.board?.map((n) => [n.kind, n.from.name, n.to.name, n.text])).toEqual([
    ["assign", "部长", "调研员", "map packages"],
    ["report", "调研员", "部长", "seven packages"],
    ["message", "调研员", "部长", "one more thing"],
    ["message", "部长", "reviewer", "please look"],
  ])
})

test("the company's board merges every session's lines, latest eight, oldest first", async () => {
  const a = withAgent()
  a.updatedAt = T0 + 100
  const b = createSnapshot("s2", "api-server", undefined, T0)
  b.updatedAt = T0 + 100
  messageSent(b, undefined, "s1", "too old", T0 + 40)
  messageSent(b, undefined, "s1", "from b", T0 + 50)
  for (const i of [1, 2, 3, 4, 5, 6]) messageSent(a, undefined, "s2", `to b ${i}`, T0 + 60 + i)
  messageSent(b, undefined, "s1", "last", T0 + 80)
  const board = companyOf([a, b], "s1", T0 + 100).board ?? []
  expect(board.map((l) => l.text)).toEqual(["from b", "to b 1", "to b 2", "to b 3", "to b 4", "to b 5", "to b 6", "last"])
})

test("an envelope rides down when work is handed out and up when it comes back", async () => {
  const s = withAgent()
  expect(seatOf(s.agents[0]!, T0 + MAIL_MS - 1, false).mail).toBe("down")
  expect(seatOf(s.agents[0]!, T0 + MAIL_MS, false).mail).toBeUndefined()
  turnFinished(s, "a1", { isAnswer: true, answer: "ok" }, T0 + 10_000)
  expect(seatOf(s.agents[0]!, T0 + 10_001, false).mail).toBe("up")
  expect(seatOf(s.leader, T0, false).mail).toBeUndefined()
})

test("a git worktree joins its repository's department under its own name", async () => {
  const worktree = "gitdir: /Users/me/code/web-app/.git/worktrees/checkout-redesign\n"
  expect(placeOf("/Users/me/code/web-app/.claude/worktrees/checkout-redesign", worktree)).toEqual({
    project: "web-app",
    team: "checkout-redesign",
  })
  expect(placeOf("/Users/me/code/web-app", undefined)).toEqual({ project: "web-app" })
  const idle = createSnapshot("w1", "web-app", undefined, T0, "checkout-redesign")
  idle.updatedAt = T0
  const company = companyOf([withAgent(), idle], "s1", T0)
  expect(company.rooms.map((r) => r.title)).toEqual(["web-app 部"])
  expect(company.rooms[0]?.teams[1]?.[0]?.task).toBe("checkout-redesign")
})

test("worktree teams are led by 组长 under their own sign; the checkout's head is 部长", async () => {
  const hq = withAgent()
  hq.updatedAt = T0
  const wt = createSnapshot("w1", "web-app", undefined, T0, "checkout-redesign")
  wt.updatedAt = T0
  hire(wt, "w1a", "Plan")
  const room = companyOf([hq, wt], "s1", T0).rooms[0]
  expect(room?.signs).toEqual(["本部", "checkout-redesign 组"])
  expect(room?.teams.map((team) => team[0]?.role)).toEqual(["chief", "lead"])
  expect(wt.board?.[0]?.from.name).toBe("组长")
  const alone = companyOf([hq], "s1", T0).rooms[0]
  expect(alone?.signs).toBeUndefined()
})

test("each department crowns its 大部长, seated first; every other manager a hat of its own", async () => {
  const big = withAgent()
  const second = createSnapshot("s2", "web-app", undefined, T0 + 5)
  // the longest-serving of web-app, but a worktree's 组长, so not its 大部长
  const wt = createSnapshot("w1", "web-app", undefined, T0 - 20, "docs")
  const api = createSnapshot("a", "api-server", undefined, T0 - 10)
  // a department of worktrees alone crowns its longest-serving
  const solo = createSnapshot("x", "web", undefined, T0, "spike")
  const snaps = [api, big, second, wt, solo]
  for (const s of snaps) s.updatedAt = T0 + 10
  const hats = hatsOf(snaps, T0 + 10)
  expect(["s1", "a", "x"].map((id) => hats.get(id))).toEqual(["chief", "chief", "chief"])
  const others = ["s2", "w1"].map((id) => hats.get(id))
  expect(new Set(others).size).toBe(2)
  expect(others).not.toContain("chief")
  // viewed from s2: the 大部长 first all the same, then by seniority
  const room = companyOf(snaps, "s2", T0 + 10).rooms[0]
  expect(room?.teams.map((team) => [team[0]?.role, team[0]?.hat])).toEqual([
    ["chief", undefined],
    ["lead", hats.get("w1")],
    ["leader", hats.get("s2")],
  ])
  expect(room?.here).toBe(2)
})

test("a manager that finishes cheers, then keeps a mark until the next turn", async () => {
  const s = withAgent()
  s.updatedAt = T0 + 1
  turnStarted(s, undefined, "do it", T0)
  turnFinished(s, undefined, { isAnswer: true, answer: "done" }, T0 + 1)
  expect(seatOf(s.leader, T0 + 2, false).finish).toBe("cheer")
  expect(companyOf([s], "s1", T0 + 2).rooms[0]?.isCheering).toBe(true)
  expect(seatOf(s.leader, T0 + 1 + CHEER_MS, false).finish).toBe("done")
  turnStarted(s, undefined, "next", T0 + 1 + CHEER_MS + 5)
  expect(seatOf(s.leader, T0 + 1 + CHEER_MS + 6, false).finish).toBeUndefined()
})

test("/office say reads @全体, @a team, or no @ as a memo for whoever is free", async () => {
  expect(parseSay(" @全体 周五前把测试补齐", "m1", T0)?.to).toEqual({ kind: "all" })
  expect(parseSay("@checkout-redesign 组 改一下文案", "m2", T0)).toEqual({
    id: "m2",
    at: T0,
    text: "改一下文案",
    to: { kind: "team", name: "checkout-redesign" },
  })
  expect(parseSay("谁有空看看 CI", "m3", T0)?.to).toEqual({ kind: "open" })
  expect(parseSay("   ", "m4", T0)).toBeUndefined()
})

test("a memo reaches the free sessions it names, and an open one only the first free", async () => {
  const hq = createSnapshot("a", "web-app", undefined, T0)
  const wt = createSnapshot("b", "web-app", undefined, T0, "checkout-redesign")
  const busy = createSnapshot("c", "api-server", undefined, T0)
  for (const s of [hq, wt, busy]) s.updatedAt = T0 + 100
  busy.leader.status = "editing"
  const snaps = [hq, wt, busy]
  const team = parseSay("@checkout-redesign 改文案", "t", T0 + 50)!
  const all = parseSay("@全体 开会", "all", T0 + 50)!
  const open = parseSay("看看 CI", "o", T0 + 50)!
  const now = T0 + 100
  expect(memoFor(wt, snaps, [team], [], now)?.id).toBe("t")
  expect(memoFor(hq, snaps, [team], [], now)).toBeUndefined()
  expect([hq, wt, busy].map((s) => memoFor(s, snaps, [all], [], now)?.id)).toEqual(["all", "all", undefined])
  // whoever is free first, by id: a before b; while a works on it nobody else
  // gets it, and once a is free again without claiming it, b does
  expect([hq, wt].map((s) => memoFor(s, snaps, [open], [], now)?.id)).toEqual(["o", undefined])
  hq.handled = ["o"]
  hq.leader.status = "thinking"
  expect(memoFor(wt, snaps, [open], [], now)).toBeUndefined()
  hq.leader.status = "idle"
  expect(memoFor(wt, snaps, [open], [], now)?.id).toBe("o")
  // claimed, it reaches nobody else
  const claimed = [{ memoId: "o", at: now, sessionId: "a", who: "web-app 部 · 本部" }]
  expect(memoFor(wt, snaps, [open], claimed, now)).toBeUndefined()
  // but one addressee taking an everyone's memo leaves it for the rest
  const tookAll = [{ memoId: "all", at: now, sessionId: "a", who: "web-app 部 · 本部" }]
  expect(memoFor(wt, snaps, [all], tookAll, now)?.id).toBe("all")
})

test("a memo waits for a team whose crew is still at work, however idle its manager", async () => {
  const s = withAgent()
  s.updatedAt = T0
  const open = parseSay("看看 CI", "o", T0)!
  expect(memoFor(s, [s], [open], [], T0)).toBeUndefined()
  s.agents[0]!.status = "done"
  expect(memoFor(s, [s], [open], [], T0)?.id).toBe("o")
})

test("btw asks the manager through its own thread, and a subagent from its own record", async () => {
  const s = withAgent()
  expect(btwOf(s.leader, "在干嘛？")).toContain("btw")
  expect(btwOf(s.leader, "在干嘛？")).toContain("在干嘛？")
  // a subagent whose record is gone is answered for by its manager
  expect(btwOf(s.agents[0]!, "进展？")).toContain("派出去的")
  const rows = [
    { role: "user", text: "map the packages", toolUses: [] },
    { role: "assistant", text: "", toolUses: [{ tool: "Grep", input: { pattern: "import" }, text: "12 files" }] },
  ]
  const { system, prompt } = subagentBtwOf(s.agents[0]!, rows, "进展？")
  expect(system).toContain("子代理")
  expect(prompt).toContain("收到：map the packages")
  expect(prompt).toContain('[Grep] {"pattern":"import"} → 12 files')
  expect(prompt.endsWith("董事长问：进展？")).toBe(true)
  // a long record keeps its newest end
  const long = subagentBtwOf(s.agents[0]!, [{ role: "assistant", text: "x".repeat(100) + "END", toolUses: [] }], "q", 50).prompt
  expect(long.startsWith("…")).toBe(true)
  expect(long).toContain("END")
})

test("the handover names the memo, who you are, your colleagues and how to take it", async () => {
  const hq = createSnapshot("a", "web-app", undefined, T0)
  const wt = createSnapshot("b", "web-app", undefined, T0, "checkout-redesign")
  for (const s of [hq, wt]) s.updatedAt = T0
  const memo = parseSay("@全体 周五前把测试补齐", "m1", T0)!
  const text = handoverOf(memo, wt, [hq, wt], T0)
  expect(text).toContain("memo m1")
  expect(text).toContain("周五前把测试补齐")
  expect(text).toContain("web-app 部 · checkout-redesign 的组长")
  expect(text).toContain("- web-app 部 · 本部 大部长")
  expect(text).toContain("office_board")
  const board = companyOf([hq], "a", T0, { memos: [memo], claims: [{ memoId: "m1", at: T0, sessionId: "b", who: "web-app 部 · checkout-redesign" }] }).board
  expect(board?.at(-1)?.from.name).toBe("董事长")
  expect(board?.at(-1)?.text).toContain("✓ web-app 部 · checkout-redesign 接了")
})

test("after /office say @ the typeahead offers everyone, each department and each worktree team", async () => {
  const hq = createSnapshot("a", "web-app", undefined, T0)
  const wt = createSnapshot("b", "web-app", undefined, T0, "checkout-redesign")
  const api = createSnapshot("c", "api-server", undefined, T0)
  for (const s of [hq, wt, api]) s.updatedAt = T0
  const rows = addresseesOf([hq, wt, api], T0, "")
  expect(rows.map((r) => r.text)).toEqual(["@全体 ", "@api-server ", "@web-app ", "@checkout-redesign "])
  expect(rows[2]?.description).toBe("web-app 部，2 个组")
  expect(addresseesOf([hq, wt, api], T0, "CHECK").map((r) => r.text)).toEqual(["@checkout-redesign "])
  // what a row writes is what /office say reads
  for (const row of rows) expect(parseSay(`${row.text}看一下`, "x", T0)?.text).toBe("看一下")
  expect(parseSay(`${rows[3]?.text}看一下`, "x", T0)?.to).toEqual({ kind: "team", name: "checkout-redesign" })
})

test("a memo can name 本部 or a team the way the board spells it", async () => {
  expect(parseSay("@本部 看一下", "x", T0)?.to).toEqual({ kind: "team", name: "本部" })
  expect(parseSay("@checkout-redesign组 看一下", "x", T0)?.to).toEqual({ kind: "team", name: "checkout-redesign" })
  expect(parseSay("@web-app部 看一下", "x", T0)?.to).toEqual({ kind: "team", name: "web-app" })
})

test("a colleague's message waits in its addressee's inbox until the board is read", async () => {
  const hq = createSnapshot("a", "web-app", undefined, T0)
  const wt = createSnapshot("b", "web-app", undefined, T0, "docs")
  const api = createSnapshot("c", "api-server", undefined, T0)
  for (const s of [hq, wt, api]) s.updatedAt = T0 + 100
  expect(targetOf("董事长")).toBeUndefined()
  expect(targetOf("@docs 组")).toEqual({ kind: "team", name: "docs" })
  expect(targetOf("全体")).toEqual({ kind: "all" })
  expect(recipientsOf(targetOf("web-app")!, api, [hq, wt, api], T0 + 100).map((s) => s.sessionId)).toEqual(["a", "b"])
  messageSent(hq, undefined, "docs", "我改了 schema，你那边重新生成一下", T0 + 10)
  messageSent(hq, undefined, "董事长", "做完了", T0 + 20)
  messageSent(api, undefined, "全体", "别动 main", T0 + 30)
  const snaps = [hq, wt, api]
  const inbox = inboxOf(wt, snaps, T0 + 100)
  expect(inbox).toHaveLength(2)
  expect(inbox[0]).toContain("web-app 部 · 本部 的大部长（写给 docs）：我改了 schema")
  expect(inbox[1]).toContain("别动 main")
  // the chairman's line is the board's, nobody's inbox; a sender's own lines are not its mail
  expect(inboxOf(hq, snaps, T0 + 100)).toHaveLength(1)
  expect(inboxOf(hq, snaps, T0 + 100)[0]).toContain("别动 main")
  wt.seen = T0 + 30
  expect(inboxOf(wt, snaps, T0 + 100)).toHaveLength(0)
  const board = boardOf(snaps, T0 + 100)
  expect(board).toHaveLength(3)
  expect(board[2]).toContain("api-server 部 · 本部 的大部长 → 全体：别动 main")
})

test("the board pages back eight lines at a time and keeps a long line whole", async () => {
  const a = withAgent()
  a.updatedAt = T0 + 100
  for (let i = 0; i < 20; i++) messageSent(a, undefined, "s2", `line ${i} ${"x".repeat(300)}`, T0 + 10 + i)
  const newest = companyOf([a], "s1", T0 + 100)
  // the hire's own line, then the twenty said
  expect(newest.boardView).toEqual({ first: 14, last: 21, total: 21 })
  expect(newest.board?.at(-1)?.text.startsWith("line 19 ")).toBe(true)
  expect(newest.board?.at(-1)?.text.length).toBe("line 19 ".length + 300)
  expect(companyOf([a], "s1", T0 + 100, undefined, 8).boardView).toEqual({ first: 6, last: 13, total: 21 })
  // paged past the oldest, it stops at the oldest page
  expect(companyOf([a], "s1", T0 + 100, undefined, 100).boardView).toEqual({ first: 1, last: 8, total: 21 })
  expect(new Set(newest.board?.map((l) => l.key)).size).toBe(8)
})

test("a session's talk is what was said to it and what it answered, the engine's own lines left out", async () => {
  const rows = [
    { role: "user", text: "<system-reminder>be brief</system-reminder>整理 README" },
    { role: "assistant", text: "先看一下现在的结构" },
    { role: "user", text: "" },
    { role: "assistant", text: "README 改好了，加了截图" },
    { role: "user", text: "Stop hook feedback:\n[goal]: not yet" },
    { role: "user", text: "The crab-office plugin sent a message: [螃蟹办公室 · 董事长交代] 再跑一遍测试" },
    { role: "assistant", text: "测试全过了" },
  ]
  expect(talkOf(rows)).toEqual([
    { role: "user", text: "整理 README" },
    { role: "assistant", text: "README 改好了，加了截图" },
    { role: "user", text: "再跑一遍测试" },
    { role: "assistant", text: "测试全过了" },
  ])
  const many = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `第 ${i} 句` }))
  expect(talkOf(many).map((t) => t.text)).toEqual(["第 14 句", "第 15 句", "第 16 句", "第 17 句", "第 18 句", "第 19 句"])
})

test("the chairman's instructions reach only the session they name, once", async () => {
  const s = withAgent()
  const other = createSnapshot("s2", "web-app", undefined, T0)
  const orders = [
    { id: "o2", at: T0 + 20, to: "s1", text: "再跑一遍测试" },
    { id: "o1", at: T0 + 10, to: "s1", text: "先合并 main" },
    { id: "o3", at: T0 + 10, to: "s2", text: "别动" },
    { id: "old", at: T0 - 25 * 60 * 60_000, to: "s1", text: "太久了" },
  ]
  expect(ordersFor(s, orders, T0 + 30).map((o) => o.id)).toEqual(["o1", "o2"])
  s.obeyed = ["o1"]
  expect(ordersFor(s, orders, T0 + 30).map((o) => o.id)).toEqual(["o2"])
  expect(ordersFor(other, orders, T0 + 30).map((o) => o.id)).toEqual(["o3"])
  // taken up, an instruction is its session's task as it was written
  expect(promptOf(`The crab-office plugin sent a message: ${orderPromptOf("再跑一遍测试")}`)).toBe("再跑一遍测试")
})
