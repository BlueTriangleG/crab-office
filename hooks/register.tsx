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
  oneSessionOf,
  orderPromptOf,
  ordersFor,
  recipientsOf,
  targetOf,
  messageSent,
  subagentBtwOf,
  parseSay,
  parseAddressed,
  addresseesOf,
  parseSnapshot,
  peerOf,
  placeOf,
  pruned,
  spawned,
  talkOf,
  toolAsked,
  toolFinished,
  toolLabel,
  toolStarted,
  turnFinished,
  turnStarted,
  whoOf,
  chairman,
  noted,
  chiefsOf,
  isFree,
  heldClaims,
} from "./office.ts"
import type { Ask, Claim, Detail, Memo, Order, Reply, Snapshot, Talk } from "./office.ts"
import type { BoardLine } from "./pixels.ts"
import { LEADER_COLOR, SEAT_COLS, boardTopOf, roomBottomOf, heightOf, office as draw, partOf, slicesOf, titleOf } from "./pixels.ts"
import type { Speaker } from "./pixels.ts"
import {
  NO_ORG,
  appointedNote,
  ceoHandoverOf,
  addressOf,
  dutiesOf,
  labelOf,
  titleRefusal,
  titlesOf,
  orgOf,
  parseAppoint,
  prunedRecords,
  rankOf,
  roleSectionOf,
  sessionNamed,
  staffOf,
} from "./org.ts"
import type { Appointment, Duty, Org } from "./org.ts"
import { REJECTS_MAX, WATCH, jobsOf, nudgesOf, refusalOf } from "./jobs.ts"
import type { Amend, Assignment, BoardAction, Job, Nudge, Report, Verdict } from "./jobs.ts"
import { answerOf, isAway, pendingOf, rowsOf, settleRefusal } from "./decisions.ts"
import { cardText, linesText, officeText } from "./text.ts"
import { LINE_STATUSES, askOfLine, lineRefusal, lineRowsOf, linesOf } from "./lines.ts"
import type { Line, LineRow, LineStatus } from "./lines.ts"
import type { Decision, Settled } from "./decisions.ts"
import { MEETING, closeRefusal, isLiveMeeting, meetingNameRefusal, meetingNamed, meetingsOf, speakRefusal } from "./meetings.ts"
import type { Meeting, MeetingFile } from "./meetings.ts"
import { setLanguage, setTheme, w } from "./words.ts"
import { DEFAULT_THEME, chairmanFor, nameFrom, namesFor, needsName, parseTheme, parseThemeArgs, themeNamed, themeNote, themeOff } from "./themes.ts"
import type { Theme, ThemeChoice } from "./themes.ts"

// Every hook passes its event on unchanged. Three effects are the mod's own: this
// session's snapshot file, which is how the other sessions see it; the
// chairman's memos; and btw. A memo the person posts with `/office say` is handed
// to a session as a prompt of its own; only the person can post one, so no
// session sets another to work. A btw is answered beside the work, by a fork of
// the session's thread or a completion over a subagent's conversation, and
// never starts a turn.

const PANE = "crab-office"
// Bumped with each sync; every session's snapshot carries it.
const BUILD = "2026-11-05.21"
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
  // The engine's register of this machine's sessions, one `<pid>.json` each.
  sessions: "",
  // Every session's appointments (`org/<sessionId>.json`), and who runs the
  // office as they come to; the CEO's who while present, for the toast when it
  // leaves.
  records: [] as Appointment[],
  org: NO_ORG as Org,
  ceoWho: "",
  // The CEO's jobs as their files come to, and who is responsible for what.
  jobs: [] as Job[],
  duties: {} as Record<string, string>,
  // Each session's job title (`titles/<writer>.json`), the latest word standing.
  titles: {} as Record<string, string>,
  // Every session's meeting files (`meetings/<id>.<writer>.json`), and the
  // meetings they make together.
  meetingFiles: [] as MeetingFile[],
  meetings: [] as Meeting[],
  // What is waiting on the chairman (`decisions/`, `settled/`).
  pending: [] as Decision[],
  // The CEO's tracker (`lines/<writer>.json`).
  lines: [] as Line[],
  // The office's theme as chosen (`theme.json`), the person's own themes
  // (`themes/*.json`), and the theme in force: its key and how the chairman is called.
  themeChoice: undefined as ThemeChoice | undefined,
  themes: [] as Theme[],
  // The themes the plugin ships, a folder each under its own `themes/`.
  shipped: [] as Theme[],
  themeKey: `${DEFAULT_THEME}|`,
  themeChairman: "",
  // The language the person set, which a theme's own stands over while it is on.
  language: undefined as string | undefined,
  watchedAt: 0,
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
const LINE_COLORS: Record<LineStatus, string> = { stuck: "#e5534b", waiting: "#f2c037", risk: "#d9a441", ok: "#57ab5a", done: "#768390" }

// The CEO's tracker, under its office: each line as a dot in its status's
// colour, its name and where it stands. The status's word, the owner and the
// time were more than the chairman wanted to read.
function trackerCard(el: Pick<ClientElements, "Box" | "Text">, rows: LineRow[]) {
  const { Box, Text } = el
  if (rows.length === 0)
    return (
      <Text key="tracker-card" dimColor>
        {w().linesHead(0)}
      </Text>
    )
  return (
    <Box key="tracker-card" flexDirection="column" borderStyle="round" borderColor={LEADER_COLOR} paddingX={1}>
      <Text bold color={LEADER_COLOR}>
        {w().linesHead(rows.length)}
      </Text>
      {rows.map((r) => (
        <Box key={`line-${r.name}`} flexDirection="row" columnGap={1}>
          <Text bold color={LINE_COLORS[r.status]}>
            ●
          </Text>
          <Text bold>{r.name}</Text>
          <Text wrap="wrap">{r.text}</Text>
        </Box>
      ))}
    </Box>
  )
}

// What is waiting on the chairman, between the rooms and the board: who asked and what,
// each with a field to answer it there and a ✓ that takes it off unanswered.
function chairmanCard(el: Pick<ClientElements, "Box" | "Text" | "Button" | "Input">, rows: { id: string; who: string; text: string }[]) {
  const { Box, Text, Button, Input } = el
  if (rows.length === 0)
    return (
      <Text key="chairman-card" dimColor>
        {w().chairmanList(0)}
      </Text>
    )
  return (
    <Box key="chairman-card" flexDirection="column" borderStyle="round" borderColor={LEADER_COLOR} paddingX={1}>
      <Text bold color={LEADER_COLOR}>
        {w().chairmanList(rows.length)}
      </Text>
      {rows.map((r) => (
        <Box key={`decision-${r.id}`} flexDirection="column">
          <Box flexDirection="row" columnGap={1}>
            <Button key={`office-settle-${r.id}`} label="✓" onPress={() => undefined} />
            <Text bold>{r.who}</Text>
            <Text wrap="wrap">{r.text}</Text>
          </Box>
          <Input key={`office-answer-${r.id}`} label="  ➤ " placeholder={w().answerPlaceholder} submitLabel={w().send} onSubmit={() => undefined} />
        </Box>
      ))}
    </Box>
  )
}

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
  el: Pick<ClientElements, "Box" | "Text" | "Input" | "Button">,
  detail: Detail,
  chats: Chat[],
  inputKey: string,
  orders?: { key: string; obeyed: string[]; talk: Talk[] },
  // A session's own crab in the pane: whether it is CEO, or its repository's
  // appointed head, so each button offers the other way.
  appointed?: { isCeo: boolean; isHead: boolean },
) {
  const { Box, Text, Input, Button } = el
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
      {appointed !== undefined && (
        <Box flexDirection="row" columnGap={2}>
          <Button key="office-appoint-ceo" label={appointed.isCeo ? w().revokeCeo : w().appointCeo} onPress={() => undefined} />
          {!appointed.isCeo && (
            <Button
              key="office-appoint-head"
              label={appointed.isHead ? w().revokeHead : w().appointHead}
              onPress={() => undefined}
            />
          )}
        </Box>
      )}
    </Box>
  )
}
const CHAT_KEPT = 5
// A question to another session waits this long for its answer, and an ask this
// session finds older than it is left alone: whoever asked has given up on it.
const ASK_WAIT_MS = 120_000
const JOB_KEEP_MS = 7 * 24 * 60 * 60_000

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

// An instruction from a session's card, `/office tell` or an answer on the
// chairman's list: a file the session takes up on its next tick, this session's
// own too. A prompt submitted from a command hook never started a turn: awaited,
// the command never answered (the submit waits for the session to be idle);
// not awaited, it was dropped. One from the tick runs once the session is free.
async function order($: EngineInterface, sessionId: string, text: string) {
  const me = office.me
  if (me === undefined || text.trim() === "") return
  const now = Date.now()
  const chat: Chat = { id: idOf(now), at: now, question: text.trim(), isRemote: sessionId !== me.sessionId, kind: "order" }
  office.chats.set(sessionId, [...(office.chats.get(sessionId) ?? []), chat].slice(-CHAT_KEPT))
  office.asked += 1
  $.ui.invalidate("ui.render")
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
      // An instruction is delivered once its session takes it up (`obeyed`); the
      // btw wait running out marked one "delivered" that never was.
      if (!chat.isRemote || chat.kind !== "btw" || chat.answer !== undefined) continue
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

// `maxAgeMs`: files untouched that long are left unread, so a folder that only
// grows (the jobs) costs the tick no more as weeks go by.
// ponytail: a job silent for JOB_KEEP_MS drops out unanswered; archive it if that bites.
async function readJsonDir<T>($: EngineInterface, dir: string, maxAgeMs = Number.POSITIVE_INFINITY): Promise<T[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const now = Date.now()
  const texts = await Promise.all(
    entries
      .filter((f) => f.kind === "file" && f.name.endsWith(".json") && now - f.mtimeMs < maxAgeMs)
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
  const text = handoverOf(memo, me, snaps, now, office.org)
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
  office.records = (await readJsonDir<Appointment[]>($, `${office.base}/org`)).flat()
  const org = orgOf(office.records, [me, ...office.others], now)
  lapsed($, org)
  office.org = org
  office.memos = await readJsonDir<Memo>($, `${office.base}/memos`)
  office.claims = await readJsonDir<Claim>($, `${office.base}/claims`)
  const [given, reported, judged, duties, titles, meetingFiles, amends, asked, settled, tracked] = await Promise.all([
    readJsonDir<Assignment>($, `${office.base}/jobs`, JOB_KEEP_MS),
    readJsonDir<Report>($, `${office.base}/reports`, JOB_KEEP_MS),
    readJsonDir<Verdict>($, `${office.base}/verdicts`, JOB_KEEP_MS),
    readJsonDir<Record<string, Duty>>($, `${office.base}/duties`),
    readJsonDir<Record<string, Duty>>($, `${office.base}/titles`),
    readJsonDir<MeetingFile>($, `${office.base}/meetings`, JOB_KEEP_MS),
    readJsonDir<Amend>($, `${office.base}/amends`, JOB_KEEP_MS),
    readJsonDir<Decision>($, `${office.base}/decisions`, JOB_KEEP_MS),
    readJsonDir<Settled>($, `${office.base}/settled`, JOB_KEEP_MS),
    readJsonDir<Record<string, Line>>($, `${office.base}/lines`),
  ])
  office.pending = pendingOf(asked, settled)
  office.lines = linesOf(tracked)
  office.jobs = jobsOf(given, reported, judged, amends)
  office.duties = dutiesOf(duties)
  office.titles = titlesOf(titles)
  office.meetingFiles = meetingFiles
  office.meetings = meetingsOf(meetingFiles, [me, ...office.others], now)
  await btw($, now)
  office.themeChoice = await $.fs.read(`${office.base}/theme.json`).then((s) => JSON.parse(s) as ThemeChoice).catch(() => undefined)
  office.themes = await readThemes($, `${office.base}/themes`)
  applyTheme($)
  // An observer is sent nothing: no memo, no instruction, no CEO's handover.
  if (me.observe === true) return
  await tellTheme($, now)
  await adjourn($, now)
  await deliver($, now)
  await handOver($, now)
  await watch($, now)
  await obey($, now)
  if (office.isOpen) announce($, office.others, now)
  // The elapsed times on screen move every second.
  if (office.isOpen || me.agents.length > 0) $.ui.invalidate("ui.render")
}

// The session the chairman just made CEO is handed the staff list and the reports
// waiting for a verdict, once per appointment, when it is free, as a memo is.
async function handOver($: EngineInterface, now: number) {
  const me = office.me
  if (me === undefined || office.org.ceo !== me.sessionId || !isFree(me, now)) return
  const made = office.records.filter((r) => r.kind === "ceo").sort((a, b) => b.at - a.at)[0]
  if (made === undefined || me.ceoSeen === made.at) return
  if ((await $.prompt.read()).text.trim() !== "") return
  const snaps = [me, ...office.others]
  const peers = await readJsonDir<unknown>($, office.sessions)
  const text = ceoHandoverOf(me, snaps, office.org, office.jobs, office.duties, peers, now)
  me.ceoSeen = made.at
  turnStarted(me, undefined, text, now)
  changed($)
  await $.prompt.submit({ text })
}

// The watchdog runs in the CEO's own session. A wait for approval goes to the
// chairman at once, as a toast, since only the chairman can give it; the rest
// is put to the CEO as one prompt when it is free, never interrupting it, and
// waits for that otherwise.
async function watch($: EngineInterface, now: number) {
  const me = office.me
  if (me === undefined || office.org.ceo !== me.sessionId || now - office.watchedAt < WATCH.everyMs) return
  office.watchedAt = now
  const snaps = [me, ...office.others]
  const nudges = nudgesOf(office.jobs, snaps, now, me.nudged ?? {})
  if (nudges.length === 0) return
  const jobOf = (id: string) => office.jobs.find((j) => j.id === id)
  const whoIs = (id: string) => {
    const s = snaps.find((x) => x.sessionId === jobOf(id)?.to)
    return s === undefined ? (jobOf(id)?.to ?? id) : whoOf(s)
  }
  // Kept to the last WATCH.againMs, all a stamp is ever read for.
  const stamp = (keys: string[]) => {
    const kept = Object.entries(me.nudged ?? {}).filter(([, at]) => now - at < WATCH.againMs)
    me.nudged = Object.fromEntries([...kept, ...keys.map((key): [string, number] => [key, now])])
    changed($)
  }
  const keyOf = (n: Nudge) => `${n.id}:${n.rule}`
  // The chairman's toast is stamped apart (`<job>:<rule>:toast`), so it is said
  // at once and the CEO still hears of the wait when it is free.
  const toasts = nudges.filter((n) => n.toChairman && now - (me.nudged?.[`${keyOf(n)}:toast`] ?? -Infinity) >= WATCH.againMs)
  for (const n of toasts) $.ui.toast(w().approvalToast(n.id, whoIs(n.id), n.minutes))
  if (toasts.length > 0) stamp(toasts.map((n) => `${keyOf(n)}:toast`))
  if (!isFree(me, now) || (await $.prompt.read()).text.trim() !== "") return
  stamp(nudges.map(keyOf))
  const lines = nudges.map((n) => w().nudgeLine(n.rule, n.id, jobOf(n.id)?.task ?? "", whoIs(n.id), n.minutes))
  const text = [w().nudgeHead, ...lines, "", w().nudgeTail].join("\n")
  turnStarted(me, undefined, text, now)
  changed($)
  await $.prompt.submit({ text })
}

// A CEO that left the company while still appointed, said once where the pane
// is open: a revocation is the chairman's own doing and needs no word.
function lapsed($: EngineInterface, org: Org) {
  const was = office.org.ceo
  const ceo = org.ceo === undefined ? undefined : [office.me, ...office.others].find((s) => s?.sessionId === org.ceo)
  if (ceo !== undefined) office.ceoWho = whoOf(ceo)
  if (was === undefined || org.ceo !== undefined) return
  const last = office.records.filter((r) => r.kind === "ceo").sort((a, b) => b.at - a.at)[0]
  if (last?.sessionId === was && office.isOpen) $.ui.toast(w().ceoLapsed(office.ceoWho))
}

// An appointment by the chairman, from /office or a card: written to this
// session's own file, and a line on its board naming whom it is about.
async function appoint(
  $: EngineInterface,
  a: { kind: "ceo" | "head"; name: string | null; isOff: boolean },
  chosen?: Snapshot,
): Promise<string> {
  const me = office.me
  if (me === undefined) return w().tool.notReady
  const now = Date.now()
  const snaps = [me, ...office.others]
  const peers = await readJsonDir<unknown>($, office.sessions)
  let target = chosen
  if (target === undefined && a.name !== null) {
    const found = sessionNamed(a.name, snaps, peers, now, office.titles)
    if (found.many.length > 1) return w().ambiguous(found.many.map((s) => peerOf(peers, s.sessionId)?.name ?? whoOf(s)))
    // A head is revoked by naming its repository as well as the head.
    target = found.one ?? (a.kind === "head" && a.isOff ? snaps.find((s) => s.project === a.name) : undefined)
    if (target === undefined) return w().nobodyNamed(a.name)
  }
  if (a.kind === "head" && !a.isOff && target !== undefined && target.sessionId === office.org.ceo) return w().ceoCantHead
  if (!a.isOff && target?.observe === true) return w().observing(whoOf(target))
  const project = target?.project ?? me.project
  const holder = a.kind === "ceo" ? office.org.ceo : office.org.heads[project]
  const about = a.isOff ? snaps.find((s) => s.sessionId === holder) ?? target : target
  if (about === undefined) return a.kind === "ceo" ? w().noCeo : w().nobodyNamed(project)
  const record: Appointment = {
    kind: a.kind,
    ...(a.kind === "head" ? { project } : {}),
    sessionId: a.isOff ? null : about.sessionId,
    at: now,
    by: "chairman",
  }
  await recordAppointment($, record, chairman(), about)
  return w().appointDone(labelOf(about, peers, office.titles), titleOf(a.kind === "ceo" ? "ceo" : "chief"), a.isOff)
}

async function recordAppointment($: EngineInterface, record: Appointment, by: Speaker, about: Snapshot) {
  const me = office.me
  if (me === undefined) return
  const file = `${office.base}/org/${me.sessionId}.json`
  const mine = await $.fs.read(file).then((text) => JSON.parse(text) as Appointment[]).catch(() => [])
  await $.fs.write(file, JSON.stringify(prunedRecords([...mine, record])))
  office.records = [...office.records, record]
  office.org = orgOf(office.records, [me, ...office.others], record.at)
  noted(me, appointedNote(by, about, record.kind, record.sessionId === null, record.at))
  changed($)
  $.ui.invalidate("ui.render")
}

// A meeting this session called that ended with nobody's word (gone quiet, or
// down to one) is closed in its file, once, with a line on the board.
async function adjourn($: EngineInterface, now: number) {
  const me = office.me
  if (me === undefined) return
  for (const m of office.meetings) {
    if (m.by !== me.sessionId || (m.status !== "idle" && m.status !== "empty")) continue
    await writeMeeting($, m.id, (f) => ({ ...f, close: { at: now, conclusion: "" } }))
    messageSent(me, undefined, w().meetingTask(m.name), w().meetingEndedLine(m.status === "idle"), now)
    changed($)
  }
}

// This session's own file of a meeting, changed and written back, and the
// meetings worked out again at once so the next word sees it.
async function writeMeeting($: EngineInterface, id: string, change: (f: MeetingFile) => MeetingFile) {
  const me = office.me
  if (me === undefined) return
  const held = office.meetingFiles.find((f) => f.id === id && f.writer === me.sessionId)
  const next = change(held ?? { id, writer: me.sessionId, members: [], said: 0, lastAt: 0 })
  await $.fs.write(`${office.base}/meetings/${id}.${me.sessionId}.json`, JSON.stringify(next))
  office.meetingFiles = [...office.meetingFiles.filter((f) => f !== held), next]
  office.meetings = meetingsOf(office.meetingFiles, [me, ...office.others], Date.now())
}

async function sendEach($: EngineInterface, to: Snapshot[], text: string, peers: unknown[]) {
  const sent = await Promise.all(to.map(async (s) => ({ s, r: await $.session.send({ to: { sessionId: s.sessionId }, text }) })))
  const label = (s: Snapshot) => labelOf(s, peers, office.titles)
  return { heard: sent.filter((x) => x.r.isDelivered).map((x) => label(x.s)), missed: sent.filter((x) => !x.r.isDelivered).map((x) => label(x.s)) }
}

// Every other member still in the company: one a moment slow to write its
// snapshot is still at the table.
function tableOf(m: Meeting, me: Snapshot, now: number): Snapshot[] {
  return office.others.filter((s) => m.members.includes(s.sessionId) && s.ended !== true && now - s.updatedAt < LEAVE_MS && s.sessionId !== me.sessionId)
}

async function invite($: EngineInterface, m: Meeting, to: Snapshot[], peers: unknown[]) {
  const snaps = office.me === undefined ? office.others : [office.me, ...office.others]
  const label = (s: Snapshot) => labelOf(s, peers, office.titles)
  const caller = snaps.find((s) => s.sessionId === m.by)
  const seated = m.members.flatMap((id) => snaps.filter((s) => s.sessionId === id)).map(label)
  return sendEach($, to, w().meetingInvite(m.name, m.topic, caller === undefined ? m.by : label(caller), seated), peers)
}

// A SendMessage to a meeting's name: passed on to every other member, and
// answered here as SendMessage answers, since the call names no session. The
// input is never changed, which auto mode refuses.
async function speak($: EngineInterface, m: Meeting, me: Snapshot, text: string, agentId: string | undefined, peers: unknown[]) {
  const refused = speakRefusal(m, me.sessionId)
  if (refused !== undefined) return { deny: refused }
  const now = Date.now()
  const isLast = m.said + 1 >= MEETING.saidMax
  await writeMeeting($, m.id, (f) => ({ ...f, said: f.said + 1, lastAt: now }))
  const envelope = w().meetingEnvelope(m.name, labelOf(me, peers, office.titles), text, isLast ? { max: MEETING.saidMax } : undefined)
  const sent = await sendEach($, tableOf(m, me, now), envelope, peers)
  messageSent(me, agentId, w().meetingTask(m.name), text, now)
  changed($)
  const message = `${w().tool.meetingSent(m.name, sent.heard, sent.missed)}${isLast ? ` ${w().tool.meetingFull(m.name, MEETING.saidMax)}` : ""}`
  return { result: { success: true, message } }
}

// office_board meet and close: any session calls a meeting or brings colleagues
// to one it is at, and whoever called it closes it, the conclusion going to
// everyone at the table.
async function meet($: EngineInterface, input: BoardInput, me: Snapshot, now: number): Promise<string> {
  const name = input.meeting?.trim() ?? ""
  if (name === "") return w().tool.needMeeting
  const snaps = [me, ...office.others]
  const peers = await readJsonDir<unknown>($, office.sessions)
  const label = (s: Snapshot) => labelOf(s, peers, office.titles)
  const m = meetingNamed(name, office.meetings)
  const text = input.text?.trim() ?? ""
  if (input.action === "close") {
    if (m === undefined) return w().tool.noMeeting(name)
    const refused = closeRefusal(m, me.sessionId)
    if (refused !== undefined) return refused
    await writeMeeting($, m.id, (f) => ({ ...f, close: { at: now, conclusion: text } }))
    const told = await sendEach($, tableOf(m, me, now), w().meetingClosedEnvelope(m.name, text), peers)
    messageSent(me, input.agentId, w().meetingTask(m.name), w().closeLine(text), now)
    changed($)
    return w().tool.meetClosed(m.name, told.heard)
  }
  const found: Snapshot[] = []
  for (const n of (input.to ?? "").split(/[,，、]/).map((x) => x.trim()).filter(Boolean)) {
    const one = sessionNamed(n, snaps, peers, now, office.titles)
    if (one.many.length > 1) return w().ambiguous(one.many.map((s) => peerOf(peers, s.sessionId)?.name ?? whoOf(s)))
    if (one.one === undefined) return w().nobodyNamed(n)
    if (one.one.observe === true) return w().observing(label(one.one))
    if (one.one.sessionId !== me.sessionId && !found.includes(one.one)) found.push(one.one)
  }
  if (m !== undefined && isLiveMeeting(m)) {
    if (!m.members.includes(me.sessionId)) return w().tool.notInMeeting(m.name)
    const fresh = found.filter((s) => !m.members.includes(s.sessionId))
    if (fresh.length === 0) return w().tool.alreadyIn(m.name)
    await writeMeeting($, m.id, (f) => ({ ...f, members: [...f.members, ...fresh.map((s) => s.sessionId)], lastAt: now }))
    const sent = await invite($, office.meetings.find((x) => x.id === m.id) ?? m, fresh, peers)
    messageSent(me, input.agentId, w().meetingTask(m.name), w().meetAddLine(fresh.map(label)), now)
    changed($)
    return w().tool.meetAdded(m.name, sent.heard, sent.missed)
  }
  if (found.length === 0) return w().tool.needTo
  if (text === "") return w().tool.empty
  const refused = meetingNameRefusal(name, office.meetings, office.titles, snaps, peers, now)
  if (refused !== undefined) return refused
  const id = idOf(now)
  const members = [me.sessionId, ...found.map((s) => s.sessionId)]
  await writeMeeting($, id, (f) => ({ ...f, members, lastAt: now, open: { name, topic: text, at: now } }))
  const opened = office.meetings.find((x) => x.id === id)
  // Narrows: writeMeeting has just put it among the meetings.
  if (opened === undefined) return w().tool.notReady
  const sent = await invite($, opened, found, peers)
  messageSent(me, input.agentId, w().meetingTask(name), w().meetLine(text), now)
  changed($)
  return w().tool.meetOpened(name, sent.heard, sent.missed)
}

// The person's own themes first, so one of theirs wins over a shipped one.
function allThemes(): Theme[] {
  return [...office.themes, ...office.shipped]
}

// Each folder's theme.json under `dir`; one that will not read is said in the
// debug log and left out, never a reason to fail the rest.
async function readThemes($: EngineInterface, dir: string): Promise<Theme[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const read = await Promise.all(
    entries
      .filter((e) => e.kind === "dir")
      .map(async (e) => {
        const text = await $.fs.read(`${dir}/${e.name}/theme.json`).catch(() => undefined)
        const theme = text === undefined ? undefined : parseTheme(text, e.name)
        if (theme === undefined) $.ui.log(`crab-office: theme ${dir}/${e.name} has no readable theme.json`, { to: "debug" })
        return theme
      }),
  )
  return read.filter((t): t is Theme => t !== undefined)
}

// The theme in force: its names over the office's words, so the drawing and
// every reply name the chairman and the ranks its way.
function applyTheme($: EngineInterface) {
  const choice = office.themeChoice
  const theme = choice === undefined || choice.name === DEFAULT_THEME ? undefined : themeNamed(choice.name, allThemes())
  const chairman = theme === undefined || choice === undefined ? "" : chairmanFor(theme, choice)
  const key = theme === undefined ? `${DEFAULT_THEME}|` : `${theme.name}|${chairman}`
  if (key === office.themeKey) return
  office.themeKey = key
  office.themeChairman = chairman
  setLanguage(theme?.language ?? office.language)
  setTheme(theme === undefined ? undefined : namesFor(theme, chairman))
  $.ui.invalidate("ui.render")
}

// This session's model is told of the theme once, in its own conversation (the
// system prompt never reaches it: a plugin ahead of this one leaves the section
// out), when it is free: at start, after a compaction, and when the theme
// changes. A session that never had a theme is told nothing of the default.
async function tellTheme($: EngineInterface, now: number) {
  const me = office.me
  if (me === undefined || me.themeSeen === office.themeKey || !isFree(me, now)) return
  const isDefault = office.themeKey.startsWith(`${DEFAULT_THEME}|`)
  const theme = isDefault ? undefined : themeNamed(office.themeKey.split("|")[0] ?? "", allThemes())
  const text = theme !== undefined ? themeNote(theme, office.themeChairman || w().chairman) : me.themeSeen === undefined ? undefined : themeOff()
  me.themeSeen = office.themeKey
  changed($)
  if (text !== undefined) await $.session.append({ message: { type: "user", content: [{ type: "text", text }] } }).catch(() => undefined)
}

// "/office theme": the themes there are; "/office theme <name> [how to address
// you]"; "/office theme default".
async function chooseTheme($: EngineInterface, args: string): Promise<string> {
  const names = [DEFAULT_THEME, ...new Set(allThemes().map((t) => t.name))]
  const current = office.themeKey.split("|")[0] ?? DEFAULT_THEME
  const parsed = parseThemeArgs(args)
  if (parsed === undefined) return w().themeList(names, current)
  const isDefault = parsed.name.toLowerCase() === DEFAULT_THEME
  const theme = isDefault ? undefined : themeNamed(parsed.name, allThemes())
  if (!isDefault && theme === undefined) return w().noTheme(parsed.name)
  const choice: ThemeChoice = { name: theme?.name ?? DEFAULT_THEME, at: Date.now(), ...(parsed.chairman ? { chairman: parsed.chairman } : {}) }
  await $.fs.write(`${office.base}/theme.json`, JSON.stringify(choice))
  office.themeChoice = choice
  applyTheme($)
  // An older question of how to address the chairman is moot now.
  for (const d of office.pending.filter((x) => x.theme !== undefined)) await settle($, d, "")
  if (theme !== undefined && needsName(theme, choice) && theme.nameQuestion !== undefined) {
    // The CEO asks, where there is one; else the session the theme was chosen in.
    const asked: Decision = { id: idOf(Date.now()), by: office.org.ceo ?? office.me?.sessionId ?? "", at: Date.now(), text: theme.nameQuestion, theme: theme.name }
    await $.fs.write(`${office.base}/decisions/${asked.id}.json`, JSON.stringify(asked))
    office.pending = [...office.pending, asked]
  }
  return theme === undefined ? w().themeDefault : w().themeSet(theme.name, office.themeChairman || w().chairman)
}

// The chairman's answer to how to be addressed: the theme's name filled in,
// office-wide, so every session is told the name in its next note.
async function nameChairman($: EngineInterface, d: Decision, answer: string): Promise<string> {
  const choice = office.themeChoice
  const theme = choice === undefined ? undefined : themeNamed(choice.name, allThemes())
  const name = nameFrom(answer)
  await settle($, d, answer)
  if (choice === undefined || theme === undefined || name === "") return w().themeDefault
  const chairman = (theme.chairman ?? "{name}").replace("{name}", name)
  const named: ThemeChoice = { ...choice, chairman, at: Date.now() }
  await $.fs.write(`${office.base}/theme.json`, JSON.stringify(named))
  office.themeChoice = named
  applyTheme($)
  return w().themeNamedYou(chairman)
}

// office_board ask and settle: any session puts what only the chairman can
// decide on the chairman's list; the one that asked, or the CEO, takes it off
// once answered.
async function decide($: EngineInterface, input: BoardInput, me: Snapshot, now: number): Promise<string> {
  const text = input.text?.trim() ?? ""
  if (input.action === "ask") {
    if (text === "") return w().tool.empty
    const d: Decision = { id: idOf(now), by: me.sessionId, at: now, text }
    await $.fs.write(`${office.base}/decisions/${d.id}.json`, JSON.stringify(d))
    office.pending = [...office.pending, d]
    messageSent(me, input.agentId, w().chairman, w().askLine(text), now)
    changed($)
    $.ui.invalidate("ui.render")
    return w().tool.asked(d.id)
  }
  const id = input.decision?.trim().replace(/^#/, "") ?? ""
  const d = office.pending.find((x) => x.id === id)
  const refused = settleRefusal(d, me.sessionId, office.org.ceo === me.sessionId)
  if (refused !== undefined || d === undefined) return refused ?? w().tool.noDecision
  await settle($, d, text)
  messageSent(me, input.agentId, w().chairman, w().settleLine(text || d.text), now)
  changed($)
  return w().tool.settled(d.id)
}

async function settle($: EngineInterface, d: Decision, text: string) {
  const me = office.me
  if (me === undefined) return
  const done: Settled = { id: d.id, by: me.sessionId, at: Date.now(), text }
  await $.fs.write(`${office.base}/settled/${d.id}.${me.sessionId}.json`, JSON.stringify(done))
  office.pending = office.pending.filter((x) => x.id !== d.id)
  $.ui.invalidate("ui.render")
}

async function openPane($: EngineInterface): Promise<string | undefined> {
  try {
    await $.ui.open({ id: PANE, title: w().paneTitle, focus: true, columns: PANE_COLUMNS })
  } catch (err) {
    return w().paneFailed(String(err))
  }
  office.isOpen = true
  office.others = await readOthers($, Date.now())
  $.ui.invalidate("ui.render")
  return undefined
}

// What a card's fields and a click do, from the prompt box: tell a session
// something (as ➤ Tell it), ask it a btw, or open its card.
async function addressed($: EngineInterface, verb: "tell" | "btw" | "card", args: string): Promise<string> {
  const me = office.me
  const parsed = parseAddressed(args)
  if (me === undefined || parsed === undefined) return w().addressUsage
  const peers = await readJsonDir<unknown>($, office.sessions)
  const found = sessionNamed(parsed.name, [me, ...office.others], peers, Date.now(), office.titles)
  if (found.many.length > 1) return w().ambiguous(found.many.map((s) => peerOf(peers, s.sessionId)?.name ?? whoOf(s)))
  const s = found.one
  if (s === undefined) return w().nobodyNamed(parsed.name)
  const who = labelOf(s, peers, office.titles)
  if (verb !== "card" && parsed.text === "") return w().needWords
  if (verb === "tell") {
    if (s.observe === true) return w().observing(who)
    await order($, s.sessionId, parsed.text)
    // Its own model reads this receipt: a name it does not know as its own read
    // as an instruction for another session, and it was left undone.
    return s.sessionId === me.sessionId ? w().toldSelf : w().toldDone(who)
  }
  // A session's manager is its crab of the session's own id; selected, the pane
  // shows its card too, where one is open.
  office.selected = s.sessionId
  $.ui.invalidate("ui.render")
  if (verb === "btw") {
    void ask($, s.sessionId, parsed.text)
    return w().askedDone(who, parsed.name)
  }
  // As text, for a terminal where the pane will not open or a click will not land.
  const chats = office.chats.get(s.sessionId) ?? []
  const obeyed = s.obeyed ?? []
  return cardText(
    detailOf(s.leader, s, Date.now(), everyone(), office.org, office.jobs),
    s.talk ?? [],
    chats.filter((c) => c.kind === "order").map((c) => ({ text: c.question, isDelivered: obeyed.includes(c.id) })),
    chats.filter((c) => c.kind === "btw").map((c) => ({ question: c.question, ...(c.answer === undefined ? {} : { answer: c.answer }) })),
  )
}

function everyone(): Snapshot[] {
  return office.me === undefined ? office.others : [office.me, ...office.others]
}

// The company as the pane draws it now.
function companyNow(older = 0) {
  return companyOf(
    everyone(),
    office.me?.sessionId ?? "",
    Date.now(),
    {
      memos: office.memos,
      claims: office.claims,
      org: office.org,
      jobs: office.jobs,
      titles: office.titles,
      meetings: office.meetings,
      asking: office.pending.map((d) => d.by),
    },
    older,
  )
}

// What a field and a ✓ on the chairman's list do, by command:
// "/office answer #id the answer", "/office settle #id".
async function byCommand($: EngineInterface, verb: "answer" | "settle", args: string): Promise<string> {
  const parsed = parseAddressed(args)
  const d = office.pending.find((x) => x.id === parsed?.name.replace(/^#/, ""))
  if (parsed === undefined || d === undefined) return w().noItem
  if (verb === "settle") {
    await settle($, d, w().settledByChairman)
    return w().settledDone(d.id)
  }
  if (parsed.text === "") return w().needWords
  return answerItem($, d, parsed.text)
}

// The chairman's answer to an item on the list: to the session that asked, as
// the chairman's own instruction, and the item settled with it.
async function answerItem($: EngineInterface, d: Decision, text: string): Promise<string> {
  if (d.theme !== undefined) return nameChairman($, d, text)
  await order($, d.by, answerOf(d, text))
  await settle($, d, text)
  const asker = everyone().find((s) => s.sessionId === d.by)
  // One that left the company is named by its title, never by its raw session id.
  const who = office.titles[d.by] ?? (asker === undefined ? w().theAsker : whoOf(asker))
  return isAway(asker, Date.now()) ? w().answeredAway(who) : w().answeredToast(who)
}

type BoardInput = {
  action?: string
  line?: string
  status?: string
  decision?: string
  meeting?: string
  memo?: string
  text?: string
  to?: string
  assignment?: string
  standard?: string
  agentId?: string
}

const MANAGING = new Set<string>(["staff", "duty", "assign", "report", "accept", "reject", "amend", "track", "withdraw", "appoint", "title"])

// The CEO's actions, a head's duties and a session's report: each judged by
// refusalOf before anything is written, each delivery through the engine's own
// cross-session channel, each recorded on the board when it arrives.
async function manage($: EngineInterface, input: BoardInput, me: Snapshot, now: number): Promise<string> {
  const action = input.action ?? ""
  if (!MANAGING.has(action)) return w().tool.actions
  const snaps = [me, ...office.others]
  const peers = await readJsonDir<unknown>($, office.sessions)
  const nameOf = (s: Snapshot) => peerOf(peers, s.sessionId)?.name ?? whoOf(s)
  const rank = rankOf(me.sessionId, office.org, chiefsOf(snaps, now, office.org))
  const id = input.assignment?.trim().replace(/^#/, "")
  const job = office.jobs.find((j) => j.id === id)
  let target: Snapshot | undefined
  // A job title is set on this session itself unless `to` names another.
  if (action === "title" && !input.to) target = me
  else if (action === "assign" || action === "duty" || action === "appoint" || action === "title" || (action === "track" && input.to)) {
    if (!input.to) return w().tool.needTo
    const found = sessionNamed(input.to, snaps, peers, now, office.titles)
    if (found.many.length > 1) return w().ambiguous(found.many.map(nameOf))
    if (found.one === undefined) return w().nobodyNamed(input.to)
    target = found.one
  }
  const refusal = refusalOf(action as BoardAction, me.sessionId, rank, {
    job,
    target,
    myProject: me.project,
    org: office.org,
    isSubagent: input.agentId !== undefined,
  })
  if (refusal !== undefined) return refusal
  if (action === "staff") return staffOf(snaps, me, office.org, office.duties, office.jobs, peers, now, office.titles).join("\n")
  const text = input.text?.trim() ?? ""
  if (action === "appoint" && target !== undefined) {
    const by = { name: titleOf("ceo"), color: LEADER_COLOR, id: me.sessionId }
    const record: Appointment = { kind: "head", project: target.project, sessionId: target.sessionId, at: now, by: "ceo" }
    await recordAppointment($, record, by, target)
    const head = snaps.find((s) => s.sessionId === office.org.heads[target.project])
    if (head !== undefined && head.sessionId !== target.sessionId) return w().tool.overruled(labelOf(head, peers, office.titles))
    return w().appointDone(labelOf(target, peers, office.titles), titleOf("chief"), false)
  }
  if (text === "" && action !== "accept" && action !== "withdraw") return w().tool.empty
  if (action === "track") {
    const name = (input.line ?? "").trim().replace(/\s+/g, " ")
    const status = input.status?.trim().toLowerCase() ?? ""
    const lineRefused = lineRefusal(name, status, text)
    if (lineRefused !== undefined) return lineRefused
    const key = name.toLowerCase()
    // Its owner stands until another is named, so a word on how it goes needs no `to`.
    const owner = target?.sessionId ?? office.lines.find((l) => l.name.toLowerCase() === key)?.owner
    const line: Line = { name, status: status as LineStatus, text, at: now, by: me.sessionId, ...(owner === undefined ? {} : { owner }) }
    const file = `${office.base}/lines/${me.sessionId}.json`
    const mine = await $.fs.read(file).then((s) => JSON.parse(s) as Record<string, Line>).catch(() => ({}))
    await $.fs.write(file, JSON.stringify({ ...mine, [key]: line }))
    office.lines = linesOf([Object.fromEntries(office.lines.map((l) => [l.name.toLowerCase(), l])), { [key]: line }])
    // The line's question to the chairman, if one is open, is replaced or, the
    // line moving on, settled: one item per line on the chairman's board.
    for (const d of office.pending.filter((x) => x.line?.toLowerCase() === key)) await settle($, d, line.text)
    if (line.status === "waiting") {
      const asked = askOfLine(line, idOf(now))
      await $.fs.write(`${office.base}/decisions/${asked.id}.json`, JSON.stringify(asked))
      office.pending = [...office.pending, asked]
    }
    $.ui.invalidate("ui.render")
    return line.status === "waiting" ? w().tool.trackedWaiting(name) : line.status === "done" ? w().tool.trackedOff(name) : w().tool.tracked(name)
  }
  if (action === "title" && target !== undefined) {
    const titleRefused = titleRefusal(text, target.sessionId, office.titles, snaps, peers, now)
    if (titleRefused !== undefined) return titleRefused
    const file = `${office.base}/titles/${me.sessionId}.json`
    const mine = await $.fs.read(file).then((s) => JSON.parse(s) as Record<string, Duty>).catch(() => ({}))
    await $.fs.write(file, JSON.stringify({ ...mine, [target.sessionId]: { text, at: now, by: me.sessionId } }))
    office.titles = { ...office.titles, [target.sessionId]: text }
    changed($)
    return w().tool.titleDone(labelOf(target, peers, office.titles), text)
  }
  if (action === "duty" && target !== undefined) {
    const file = `${office.base}/duties/${me.sessionId}.json`
    const mine = await $.fs.read(file).then((s) => JSON.parse(s) as Record<string, Duty>).catch(() => ({}))
    await $.fs.write(file, JSON.stringify({ ...mine, [target.sessionId]: { text, at: now, by: me.sessionId } }))
    office.duties = { ...office.duties, [target.sessionId]: text }
    return w().tool.dutyDone(labelOf(target, peers, office.titles))
  }
  if (action === "assign" && target !== undefined) {
    const given: Assignment = {
      id: idOf(now),
      at: now,
      by: me.sessionId,
      to: target.sessionId,
      task: text,
      ...(input.standard?.trim() ? { standard: input.standard.trim() } : {}),
    }
    await $.fs.write(`${office.base}/jobs/${given.id}.json`, JSON.stringify(given))
    office.jobs = [...office.jobs, ...jobsOf([given], [], [])]
    const envelope = w().jobEnvelope(given.id, given.task, given.standard, whoOf(me))
    const sent = await $.session.send({ to: { sessionId: target.sessionId }, text: envelope })
    if (!sent.isDelivered) return w().tool.notDelivered(given.id, sent.reason)
    messageSent(me, input.agentId, nameOf(target), w().jobLine(given.id, given.task), now, target.sessionId)
    changed($)
    return w().tool.assigned(given.id, labelOf(target, peers, office.titles))
  }
  // Narrows: refusalOf has answered every report, accept and reject without a job.
  if (job === undefined) return w().tool.noJob
  if (action === "amend") {
    const added: Amend = { id: job.id, n: job.amends.length + 1, at: now, by: me.sessionId, text }
    await $.fs.write(`${office.base}/amends/${job.id}.${added.n}.json`, JSON.stringify(added))
    office.jobs = office.jobs.map((j) => (j.id === job.id ? { ...j, amends: [...j.amends, added] } : j))
    const sent = await $.session.send({ to: { sessionId: job.to }, text: w().amendEnvelope(job.id, text) })
    if (!sent.isDelivered) return w().tool.notDelivered(job.id, sent.reason)
    const worker = snaps.find((s) => s.sessionId === job.to)
    messageSent(me, input.agentId, worker ? nameOf(worker) : job.to, w().amendLine(job.id, text), now, job.to)
    changed($)
    return w().tool.amended(job.id)
  }
  if (action === "report") {
    const said: Report = { id: job.id, n: job.reports.length + 1, at: now, from: me.sessionId, text }
    await $.fs.write(`${office.base}/reports/${job.id}.${said.n}.json`, JSON.stringify(said))
    office.jobs = office.jobs.map((j) => (j.id === job.id ? (jobsOf([j], [...j.reports, said], j.verdicts)[0] ?? j) : j))
    const ceo = snaps.find((s) => s.sessionId === office.org.ceo)
    if (ceo === undefined) {
      messageSent(me, input.agentId, w().chairman, w().reportLine(job.id, text), now)
      changed($)
      $.ui.toast(w().noCeoToast(whoOf(me), job.id))
      return w().tool.noCeoKept
    }
    const task = [job.task, ...job.amends.map((a) => `+ ${a.text}`)].join("\n")
    const sent = await $.session.send({ to: { sessionId: ceo.sessionId }, text: w().reportEnvelope(job.id, task, text, whoOf(me)) })
    if (!sent.isDelivered) return w().tool.reportHeld(sent.reason)
    messageSent(me, input.agentId, nameOf(ceo), w().reportLine(job.id, text), now, ceo.sessionId)
    changed($)
    return w().tool.reportedTo(labelOf(ceo, peers, office.titles))
  }
  const ok = action === "accept"
  const isWithdrawn = action === "withdraw"
  const judged: Verdict = {
    id: job.id,
    n: job.verdicts.length + 1,
    at: now,
    by: me.sessionId,
    ok,
    note: text,
    ...(isWithdrawn ? { isWithdrawn } : {}),
  }
  await $.fs.write(`${office.base}/verdicts/${job.id}.${judged.n}.json`, JSON.stringify(judged))
  office.jobs = office.jobs.map((j) => (j.id === job.id ? (jobsOf([j], j.reports, [...j.verdicts, judged])[0] ?? j) : j))
  const worker = snaps.find((s) => s.sessionId === job.to)
  const line = (said: string) => {
    messageSent(me, input.agentId, worker ? nameOf(worker) : job.to, said, now, job.to)
    changed($)
  }
  const rejects = job.verdicts.filter((v) => !v.ok && !v.isWithdrawn).length + (ok || isWithdrawn ? 0 : 1)
  if (rejects > REJECTS_MAX) {
    line(w().escalatedLine(job.id, text))
    $.ui.toast(w().toChairmanToast(job.id, job.task))
    return w().tool.toChairman(job.id)
  }
  // Sent back or taken back, the session is told; a gone one is told nothing.
  const word = isWithdrawn ? w().withdrawEnvelope(job.id, text) : ok ? undefined : w().rejectEnvelope(job.id, text)
  if (word !== undefined && worker !== undefined) {
    const sent = await $.session.send({ to: { sessionId: job.to }, text: word })
    if (!sent.isDelivered) return w().tool.notDelivered(job.id, sent.reason)
  }
  line(isWithdrawn ? w().withdrawLine(job.id, text) : w().verdictLine(job.id, ok, text))
  return isWithdrawn ? w().tool.withdrawn(job.id) : w().tool.judged(job.id, ok)
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
  if (before.ceoSeen !== undefined) me.ceoSeen = before.ceoSeen
  if (before.nudged !== undefined) me.nudged = before.nudged
  if (before.themeSeen !== undefined) me.themeSeen = before.themeSeen
}

// Only a memo for whoever is free is one session's: a named or everyone's memo
// is each addressee's to take, so each claim is a file of its own.
function claimFileOf(memo: Memo, sessionId: string): string {
  return `${office.base}/claims/${memo.to.kind === "open" ? memo.id : `${memo.id}.${sessionId}`}.json`
}

// The claims this session made and has now answered a turn after: done, and
// never to lapse when it goes away.
async function claimsDone($: EngineInterface, now: number) {
  const me = office.me
  if (me === undefined) return
  for (const c of office.claims.filter((x) => x.sessionId === me.sessionId && x.doneAt === undefined)) {
    const memo = office.memos.find((m) => m.id === c.memoId)
    if (memo === undefined) continue
    const done = { ...c, doneAt: now }
    await $.fs.write(claimFileOf(memo, me.sessionId), JSON.stringify(done))
    office.claims = office.claims.map((x) => (x === c ? done : x))
  }
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
  const file = claimFileOf(memo, me.sessionId)
  const prior = await $.fs.read(file).catch(() => undefined)
  if (prior !== undefined) {
    const by = JSON.parse(prior) as Claim
    if (by.sessionId === me.sessionId) return w().tool.claimedAlready
    // One whose session went away mid-work is taken over.
    if (heldClaims([by], [me, ...office.others], Date.now()).length > 0) return w().tool.claimedBy(by.who)
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
  office.language = typeof options.language === "string" ? options.language : undefined
  setLanguage(office.language)
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
    // A -p run or the SDK only observes, as observe mode does; a warm background
    // process is not one of those, though no person is at its prompt yet.
    const isObserving = options.mode === "observe" || (!e.isInteractive && kind !== "bg")
    office.base = `${configDir || `${home}/.claude`}/crab-office`
    office.sessions = `${configDir || `${home}/.claude`}/sessions`
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
    office.me.build = BUILD
    office.shipped = await readThemes($, `${$.plugin.root}/themes`)
    await restore($, office.me)
    if (isObserving) office.me.observe = true
    await refreshTalk($).catch(() => undefined)
    office.isDirty = true
    await $.command.register({
      name: COMMAND,
      description: w().commandDescription,
      argumentHint: w().commandHint,
      immediate: true,
    })
    if (!isObserving) await $.tool.register({
      name: BOARD_TOOL,
      description:
        w().tool.description,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["read", "post", "claim", "meet", "close", "ask", "settle", "staff", "duty", "assign", "report", "accept", "reject", "amend", "track", "withdraw", "appoint", "title"],
          },
          line: { type: "string", description: w().tool.line },
          status: { type: "string", enum: LINE_STATUSES, description: w().tool.status },
          meeting: { type: "string", description: w().tool.meeting },
          decision: { type: "string", description: w().tool.decision },
          memo: { type: "string", description: w().tool.memo },
          assignment: { type: "string", description: w().tool.assignment },
          standard: { type: "string", description: w().tool.standard },
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

  on("session.compact", async ($, e, next) => {
    const r = await next(e)
    if (office.me !== undefined && !office.themeKey.startsWith(`${DEFAULT_THEME}|`)) office.me.themeSeen = undefined
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

  // Each session's rank, and how it works with colleagues, goes into its system
  // prompt after the cache boundary; the text moves only when an appointment
  // or a title does (roleSectionOf).
  on("prompt.compose", async ($, e, next) => {
    const r = await next(e)
    const me = office.me
    // A teammate's prompt is its own, not this session's.
    if (me === undefined || me.observe === true || e.traits.includes("teammate")) return r
    const now = Date.now()
    const snaps = [me, ...office.others]
    const rank = rankOf(me.sessionId, office.org, chiefsOf(snaps, now, office.org))
    const peers = await readJsonDir<unknown>($, office.sessions)
    const text = roleSectionOf(rank, me, snaps, office.org, peers, now, office.titles)
    return { sections: [...r.sections, { id: "crab-office:rank", text, scope: "session" as const }] }
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
  // another session, goes up on the shared board once it is delivered. One to
  // another session names that session's crab, found in the engine's register
  // by the name or socket it was sent to.
  on("session.send", async ($, e, next) => {
    const r = await next(e)
    // A delivery office_board made itself is on the board already; another
    // plugin's is not.
    const isOurs = e.origin.kind === "plugin" && e.origin.name === "crab-office"
    if (office.me !== undefined && r.isDelivered && !isOurs) {
      const peer = peerOf(await readJsonDir<unknown>($, office.sessions), e.to)
      messageSent(office.me, e.agentId, e.to, e.text, Date.now(), peer?.sessionId)
      changed($)
    }
    return r
  })

  // A SendMessage to a job title, or to CEO, is delivered here, to that session
  // by its id, and answered as SendMessage answers. It is not readdressed: auto
  // mode reviews the call server-side as the model wrote it, before any hook,
  // and refuses one whose input a hook changed ("a hook changed this call's
  // input after auto mode reviewed it"), at session.send and at the tool call
  // alike; answering with the real name to send again cost a failed call every
  // time. A title nobody at work holds is refused, never guessed; every other
  // address passes untouched.
  on("tool.call", { tool: "SendMessage" }, async ($, e, next) => {
    const me = office.me
    const { to, message } = e as unknown as { to?: unknown; message?: unknown }
    if (me === undefined || typeof to !== "string") return next(e)
    const peers = await readJsonDir<unknown>($, office.sessions)
    // A meeting's name, unless a session goes by it now.
    const m = peerOf(peers, to) === undefined ? meetingNamed(to, office.meetings) : undefined
    if (m !== undefined) return speak($, m, me, typeof message === "string" ? message : String(message ?? ""), e.agentId, peers)
    const routed = addressOf(to, office.titles, office.org, [me, ...office.others], peers, Date.now())
    if (routed?.refusal !== undefined) return { deny: routed.refusal }
    if (routed?.sessionId === undefined) return next(e)
    if (routed.sessionId === me.sessionId) return { deny: w().tool.notToSelf }
    const text = typeof message === "string" ? message : String(message ?? "")
    const sent = await $.session.send({ to: { sessionId: routed.sessionId }, text })
    const target = office.others.find((s) => s.sessionId === routed.sessionId)
    const who = target === undefined ? to : labelOf(target, peers, office.titles)
    if (!sent.isDelivered) return { deny: w().tool.titleNotDelivered(who, sent.reason) }
    messageSent(me, e.agentId, to, text, Date.now(), routed.sessionId)
    changed($)
    return { result: { success: true, message: w().tool.titleSent(who) } }
  })

  // The board tool the model calls to take up a memo, say something, or see
  // who else is in the company. Matched by pattern: a tool the mod registers
  // is not among the names the types know until the mod has loaded.
  on("tool.call", { tool: /^mcp__crab-office__office_board$/ }, async ($, e) => {
    const input = e as unknown as BoardInput
    const me = office.me
    if (me === undefined) return { result: w().tool.notReady }
    const now = Date.now()
    const snaps = [me, ...office.others]
    // What a post may name: everyone and each department, a team that is one
    // session left to SendMessage.
    const names = addresseesOf(snaps, now, "")
      .map((r) => r.text.trim())
      .filter((name) => {
        const target = targetOf(name)
        return target === undefined || oneSessionOf(target, me, snaps, now) === undefined
      })
      .join(" ")
    if (input.action === "read") {
      const inbox = inboxOf(me, snaps, now, office.org)
      me.seen = now
      changed($)
      // Each read carries this session's rank and what it may do: a plugin ahead
      // of this one can keep the system prompt's section out, and a session keeps
      // the tool description it started with, so one started before an update
      // never learned the CEO's actions from it.
      const rank = rankOf(me.sessionId, office.org, chiefsOf(snaps, now, office.org))
      const role = roleSectionOf(rank, me, snaps, office.org, await readJsonDir<unknown>($, office.sessions), now, office.titles)
      return {
        result: [
          inbox.length > 0 ? w().tool.inbox(inbox) : w().tool.noInbox,
          w().tool.latest(boardOf(snaps, now, undefined, office.org)),
          ...(rank === "ceo" ? [linesText(lineRowsOf(office.lines, snaps, office.titles)).join("\n")] : []),
          ...(office.pending.length === 0
            ? []
            : [[w().pendingHead, ...rowsOf(office.pending, snaps, office.titles).map((r) => w().pendingLine(r.id, r.who, r.text))].join("\n")]),
          role,
        ].join("\n\n"),
      }
    }
    const unread = inboxOf(me, snaps, now, office.org).length
    const nudge = unread > 0 ? w().tool.unread(unread) : ""
    if (input.action === "claim")
      return { result: `${await claim($, input.memo ?? "", input.agentId)}${nudge}` }
    if (input.action === "post") {
      if (!input.text) return { result: w().tool.empty }
      const to = input.to?.trim() || w().chairman
      const target = targetOf(to)
      const one = target === undefined ? undefined : oneSessionOf(target, me, snaps, now)
      if (one !== undefined) {
        const peer = peerOf(await readJsonDir<unknown>($, office.sessions), one.sessionId)
        return { result: `${w().tool.oneSession(to, peer?.name)}${nudge}` }
      }
      const reach = target === undefined ? [] : recipientsOf(target, me, snaps, now).map(whoOf)
      if (target !== undefined && reach.length === 0)
        return { result: `${w().tool.nobody(to, names)}${nudge}` }
      messageSent(me, input.agentId, to, input.text, now)
      changed($)
      const heard = target === undefined ? w().tool.heardByChairman : w().tool.heardBy(reach)
      return { result: `${w().tool.written(heard)}${nudge}` }
    }
    if (input.action === "meet" || input.action === "close") return { result: `${await meet($, input, me, now)}${nudge}` }
    if (input.action === "ask" || input.action === "settle") return { result: `${await decide($, input, me, now)}${nudge}` }
    return { result: `${await manage($, input, me, now)}${nudge}` }
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
      if (e.agentId === undefined) {
        await refreshTalk($).catch(() => undefined)
        // Interrupted (Ctrl-C), refused or failed, the memo is not done.
        if (e.reason === "answer") await claimsDone($, Date.now()).catch(() => undefined)
      }
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
    if (arg === "theme" || arg.startsWith("theme ")) return { text: await chooseTheme($, args.slice(5)) }
    if (arg === "band") {
      office.isBandHidden = !office.isBandHidden
      $.ui.invalidate("ui.render")
      return {
        text: w().band(office.isBandHidden),
      }
    }
    if (arg.startsWith("say")) return { text: await say($, args.slice(3)) }
    if (arg === "text")
      return {
        text: officeText(
          companyNow(),
          rowsOf(office.pending, everyone(), office.titles),
          office.org.ceo === undefined ? [] : lineRowsOf(office.lines, everyone(), office.titles),
        ),
      }
    if (arg.startsWith("answer ") || arg.startsWith("settle ") || arg === "answer" || arg === "settle")
      return { text: await byCommand($, arg.startsWith("answer") ? "answer" : "settle", args.slice(6)) }
    for (const verb of ["tell", "btw", "card"] as const)
      if (arg === verb || arg.startsWith(`${verb} `)) return { text: await addressed($, verb, args.slice(verb.length)) }
    const appointing = parseAppoint(args)
    // A person appoints: the prompt box, or the person's own remote client.
    const isPerson = e.origin.kind === "composer" || e.origin.kind === "bridge"
    if (appointing !== undefined) return { text: isPerson ? await appoint($, appointing) : w().notByPerson }
    const failed = await openPane($)
    if (failed !== undefined) return { text: failed }
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

  // A card's appointment buttons, the chairman's: each toggles.
  on("ui.press", { element: /^office-appoint-/ }, async ($, e, next) => {
    const me = office.me
    const found = office.selected === null ? undefined : findCrab([...(me ? [me] : []), ...office.others], office.selected)
    if (found === undefined || found.crab.role !== "leader") return next(e)
    const kind = e.element === "office-appoint-ceo" ? "ceo" : "head"
    const id = found.snap.sessionId
    const isOff = kind === "ceo" ? office.org.ceo === id : office.org.heads[found.snap.project] === id
    $.ui.toast(await appoint($, { kind, name: null, isOff }, found.snap))
    return next(e)
  })

  on("ui.input", { element: /^office-answer-/ }, async ($, e, next) => {
    const d = office.pending.find((x) => `office-answer-${x.id}` === e.element)
    if (e.kind !== "submit" || d === undefined || e.value.trim() === "") return next(e)
    $.ui.toast(await answerItem($, d, e.value.trim()))
    return next(e)
  })

  on("ui.press", { element: /^office-settle-/ }, async ($, e, next) => {
    const d = office.pending.find((x) => `office-settle-${x.id}` === e.element)
    if (d !== undefined) await settle($, d, w().settledByChairman)
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
    const data = e.data as { select?: unknown; drawn?: unknown; board?: unknown; note?: unknown; ms?: unknown } | null
    // A drawing's frame time, kept in the snapshot beside its first frame.
    if (typeof data?.ms === "number") {
      if (office.me !== undefined) office.me.drawn = { ...office.me.drawn, [`${e.element}:ms`]: data.ms }
      return next(e)
    }
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
      const { Box, Text, Client, Input, Button } = $.ui.resolve(e)
      const now = Date.now()
      const me = office.me
      const snaps = me !== undefined ? [me, ...office.others] : office.others
      const company = companyNow(office.boardOlder)
      // Paged past the oldest line kept, the count comes back to where it shows.
      if (company.boardView !== undefined)
        office.boardOlder = company.boardView.total - company.boardView.last
      const note = company.board?.find((line) => line.key === office.note)
      const chosen =
        office.selected !== null ? findCrab(snaps, office.selected) : undefined
      // The rooms, then what waits on the chairman, then the board: the drawing
      // is cut into bands at the board's first row.
      const cols = e.props.bodyColumns
      const drawn = draw(company, cols, 0, office.selected)
      const boardTop = Math.min(boardTopOf(company, cols), drawn.rows)
      const bands = (from: number, to: number, name: string) =>
        slicesOf(drawn.cells.slice(from, to)).map(([a, b], i) => {
          const rows: [number, number] = [a + from, b + from]
          return (
            <Client
              key={`crab-office-${name}${i}`}
              module="./crabs.tsx"
              props={{ part: partOf(company, cols, rows), selected: office.selected, rows }}
              width={cols}
              height={rows[1] - rows[0]}
            />
          )
        })
      // With a CEO, its tracker sits under its office (at the top, where the
      // CEO's office is away at a meeting).
      const ceoRoom = company.rooms.findIndex((r) => r.title === w().ceoRoom)
      const ceoBottom = office.org.ceo === undefined ? 0 : Math.min(ceoRoom < 0 ? 0 : roomBottomOf(company, cols, ceoRoom), boardTop)
      return (
        <Box flexDirection="column">
          {bands(0, ceoBottom, "ceo-")}
          {office.org.ceo !== undefined && trackerCard({ Box, Text }, lineRowsOf(office.lines, snaps, office.titles))}
          {bands(ceoBottom, boardTop, "")}
          {chairmanCard({ Box, Text, Button, Input }, rowsOf(office.pending, snaps, office.titles))}
          {bands(boardTop, drawn.rows, "board-")}
          <Box flexDirection="column" borderStyle="round" borderColor="#5d7a66" paddingX={1}>
            <Input
              key={`office-say-${office.said}`}
              label={w().sayLabel}
              placeholder={w().sayPlaceholder}
              submitLabel={w().post}
              onSubmit={() => undefined}
            />
            {/* Whom a line can call, in one line: a tag for every team ran to three rows. */}
            <Text dimColor>{w().sayHint}</Text>
          </Box>
          {note !== undefined && noteCard({ Box, Text }, note)}
          {chosen !== undefined &&
            crabCard(
              { Box, Text, Input, Button },
              detailOf(chosen.crab, chosen.snap, now, snaps, office.org, office.jobs),
              office.chats.get(chosen.crab.id) ?? [],
              `office-btw-${office.asked}-${chosen.crab.id}`,
              chosen.crab.role === "leader" && chosen.snap.observe !== true
                ? {
                    key: `office-order-${office.asked}-${chosen.crab.id}`,
                    obeyed: chosen.snap.obeyed ?? [],
                    talk: chosen.snap.talk ?? [],
                  }
                : undefined,
              chosen.crab.role === "leader" && chosen.snap.observe !== true
                ? {
                    isCeo: office.org.ceo === chosen.snap.sessionId,
                    isHead: office.org.heads[chosen.snap.project] === chosen.snap.sessionId,
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
    const { Box, Text, Client, Input, Button } = $.ui.resolve(e)
    const now = Date.now()
    const band = bandOf(me, [me, ...office.others], now, office.org, office.titles)
    const chosen =
      office.selected !== null ? findCrab([me], office.selected) : undefined
    return (
      <Box flexDirection="column">
        <Client
          key="crab-band"
          module="./crabs.tsx"
          props={{ part: partOf(band, 0), selected: office.selected }}
          height={heightOf(band, 0)}
          flexGrow={1}
        />
        {chosen !== undefined &&
          crabCard(
            { Box, Text, Input, Button },
            detailOf(chosen.crab, chosen.snap, now, [me, ...office.others], office.org, office.jobs),
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
