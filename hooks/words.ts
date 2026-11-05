// Every word the office shows or says, in English and in Chinese. The plugin's
// `language` option picks one: the hooks set it as they load, and the drawing,
// which runs in an environment of its own, sets it from the company it is
// handed. Stored data (who claimed a memo, a note's names) keeps the words it
// was written in.

const EN = {
  lang: "en",
  // the drawing
  titles: {
    ceo: "CEO",
    chief: "Head",
    leader: "Lead",
    lead: "Lead",
    Explore: "Scout",
    Plan: "Planner",
    "general-purpose": "Engineer",
    fork: "Clone",
    "claude-code-guide": "Advisor",
    verifier: "Checker",
  } as Record<string, string>,
  intern: "Intern",
  cheer: "Done!",
  youAreHere: "◀ you",
  hereSuffix: " · you're here",
  doneSuffix: " ✓ done",
  board: "Whiteboard",
  boardFooter: (n: number) => `last ${n}`,
  boardRange: (first: number, last: number, total: number) => `${first}–${last} of ${total}`,
  older: "▲ older",
  newer: "▼ newer",
  boardEmpty: "Nobody has said anything yet",
  crowd: (n: number) => `+${n} more `,
  hq: "HQ",
  // the company
  // With a CEO the counts come first: the pane is 44 columns wide and the header
  // is cut at its edge.
  header: (n: number, ceo?: { who: string; open: number; waiting: number }) =>
    ceo
      ? `Crab Co.  ${ceo.open} open · ${ceo.waiting} to judge  CEO: ${ceo.who}  ${n} on duty`
      : `Crab Co.  Chairman: you  ${n} on duty`,
  dept: (project: string) => project,
  teamSign: (team: string) => team,
  who: (project: string, team: string) => `${project} · ${team}`,
  footer: (working: number, waiting: number, gone: number) =>
    [
      `${working} working`,
      `${waiting} waiting`,
      ...(gone > 0 ? [`${gone} gone`] : []),
    ].join("  "),
  unfinished: "didn't finish",
  status: {
    thinking: "thinking",
    editing: "editing",
    reading: "reading",
    searching: "searching",
    running: "running",
    browsing: "browsing",
    delegating: "delegating",
    approval: "needs your approval",
    idle: "waiting for you",
    done: "handed in",
    failed: "failed",
    asleep: "dozing",
    gone: "gone home",
  } as Record<string, string>,
  noTools: "no tools yet",
  notStarted: "not started",
  labels: { task: "Task", given: "Given", tools: "Tools", back: "Back", job: "Job", mode: "Mode" },
  observeMode: "observe: only shown here, sent nothing",
  themeNote: (name: string, chairman: string, voice: string, examples: string[]) =>
    [
      `[crab-office · theme "${name}"] The chairman has given the office a theme. From now on:`,
      `- Address the chairman (the user) as "${chairman}".`,
      ...(voice ? [`- When you talk in the office (SendMessage to colleagues, meetings, reports) and to ${chairman}, use this voice: ${voice}`] : []),
      ...(examples.length > 0 ? [`- For example: ${examples.join(" / ")}`] : []),
      "- Only the voice and the names change: what a report says stays plain (done / in progress / needs you, one line each), and code, commit messages, PRs, docs and product copy never take this voice.",
    ].join("\n"),
  themeOff: "[crab-office · theme] The chairman has switched the office back to its default theme: address the chairman and talk as you did before any theme.",
  themeList: (names: string[], current: string) => `Themes: ${names.join(", ")}. Now: ${current}. /office theme <name> [how to address you], or /office theme default.`,
  themeSet: (name: string, chairman: string) => `Theme: ${name}; you are addressed as ${chairman}. Every session takes it within a few seconds.`,
  themeDefault: "Back to the default theme.",
  noTheme: (name: string) => `No theme called ${name}.`,
  textRoom: (title: string) => `[${title}]`,
  linesHead: (n: number) => (n === 0 ? "CEO's tracker: nothing yet (the CEO keeps it with office_board track)" : `CEO's tracker (${n})`),
  lineStatus: { stuck: "stuck", waiting: "waiting on you", risk: "at risk", ok: "on track", done: "done" } as Record<string, string>,
  textWaiting: "(no answer yet)",
  observing: (who: string) => `${who} is in observe mode: the office only shows it and sends it nothing.`,
  addressUsage:
    "Name a session after the command: /office tell @who instruction, /office btw @who question, /office card @who. @who is its job title, SendMessage name or team.",
  needWords: "Say what to tell or ask after the name.",
  toldDone: (who: string) => `Told ${who}; it runs once that session is free.`,
  toldSelf: "This instruction from the chairman is for this session itself: it arrives here as a new turn once this session is free.",
  askedDone: (who: string, name: string) => `Asked ${who}; the answer shows on its card: /office card @${name}`,
  noItem: "No such item waiting on you. /office text lists them with their ids: /office answer #id the answer, /office settle #id.",
  settledDone: (id: string) => `#${id} is off your list.`,
  jobStatus: { assigned: "given", reported: "to judge", rejected: "sent back", accepted: "accepted", chairman: "yours to decide", withdrawn: "withdrawn" } as Record<string, string>,
  orderHead: "[crab-office · from the chairman]",
  orderLabel: "➤ Tell it ",
  orderPlaceholder: "an instruction; it does it once it's free",
  orderQueued: "…waiting until it's free",
  orderDelivered: "✓ delivered",
  send: "send",
  memoTask: (text: string) => `Memo: ${text}`,
  ceoRoom: "CEO's office",
  ceoTask: "Taking over as CEO",
  nudgeTask: "The watchdog's nudge",
  judgeTask: (id: string, task: string) => `Judging #${id} ${task}`,
  sentBackTask: (id: string) => `#${id} sent back`,
  withdrawnTask: (id: string) => `#${id} withdrawn`,
  // memos and the board
  chairman: "Chairman",
  everyone: "everyone",
  open: "open",
  taken: (text: string, takers: string[]) =>
    `${text} · ✓ taken by ${takers.join(", ")}`,
  jobEnvelope: (id: string, task: string, standard: string | undefined, ceo: string) =>
    `[crab-office · job #${id} from the CEO, ${ceo}]\n${task}${standard ? `\nHow it will be judged: ${standard}` : ""}\n\nWhen it is done: write the result in this session first, then hand it back with office_board (action: report, assignment: ${id}, text: the result). It goes to the CEO.`,
  reportEnvelope: (id: string, task: string, text: string, who: string) =>
    `[crab-office · job #${id} reported by ${who}]\nThe job: ${task}\n\n${text}\n\nJudge it against the standard you set: office_board accept or reject (assignment: ${id}).`,
  rejectEnvelope: (id: string, reason: string) =>
    `[crab-office · job #${id} sent back by the CEO]\nWhy: ${reason}\n\nFix it, then report again with office_board (action: report, assignment: ${id}).`,
  jobLine: (id: string, task: string) => `job #${id}: ${task}`,
  escalatedLine: (id: string, note: string) => `left to the chairman #${id}${note ? `: ${note}` : ""}`,
  withdrawLine: (id: string, note: string) => `withdrawn #${id}${note ? `: ${note}` : ""}`,
  withdrawEnvelope: (id: string, note: string) => `[crab-office · job #${id} withdrawn by the CEO]${note ? `\n${note}` : ""}\n\nStop work on it; nothing more is needed.`,
  amendEnvelope: (id: string, text: string) =>
    `[crab-office · job #${id} added to by the CEO]\n${text}\n\nThis is part of the job now: the report is judged against it too.`,
  amendLine: (id: string, text: string) => `added to #${id}: ${text}`,
  amendTask: (id: string) => `#${id} has more to it`,
  noCeoToast: (who: string, id: string) => `${who} reported #${id}, and there is no CEO to judge it`,
  ceoCantHead: "The CEO cannot be a head as well",
  notByPerson: "Only you can appoint, from the prompt",
  reportLine: (id: string, text: string) => `reported #${id}: ${text}`,
  verdictLine: (id: string, ok: boolean, note: string) => `${ok ? "accepted" : "sent back"} #${id}${note ? `: ${note}` : ""}`,
  toChairmanToast: (id: string, task: string) => `Job #${id} (${task}) was rejected too many times: it is yours to decide`,
  named: (who: string, name: string | undefined, title?: string) => {
    const more = [title ? `title: ${title}` : "", name ? `SendMessage: ${name}` : ""].filter((x) => x !== "")
    return more.length > 0 ? `${who} (${more.join(", ")})` : who
  },
  titleHelp: (title: string | undefined) =>
    `Your job title: ${title ?? "none yet"}. Set it with office_board title (text: one word, no spaces). SendMessage to a job title, or to CEO, reaches its session whatever name it goes by now. office_board staff lists every title with its name.`,
  roleCeo: [
    "## crab-office: you are the CEO",
    "The chairman (the user) has made you CEO of the office: every Claude Code session open on this machine works for you.",
    "When the chairman gives you work, do not do it yourself if another session is better placed: look with office_board staff, pick the session best suited, and give it the job with office_board assign (to, text, and standard: how you will judge it). If nobody fits, ask the chairman; never start new sessions.",
    "To learn about a repository, ask its head with SendMessage. Where there are many sessions, appoint a head for each repository with office_board appoint; with few, manage them yourself.",
    "When a report comes back, judge it against the standard you set: you are the last check, not the only one, and a report may name the colleague who already reviewed it. Still unsure, ask a session that has worked on something similar, with SendMessage. Record your verdict with office_board accept or reject (assignment, text), then answer the chairman yourself, in this session, for all of it.",
    "Sessions ask each other and meet without you: do not route their questions between them.",
    "Your tracker holds the product work being built, at the level of what is wanted: a feature or a change, titled as the chairman would say it, such as ‘Feedback on a conversation’ or ‘Onboarding resume’. Not incidents, chores, checks, or waits on someone outside: those stay in your own handling. Keep each such line on it with office_board track (line: its short title, status: stuck, risk or ok, text: one short line on where it stands, to: the session that owns it). A line waiting on the chairman is status waiting: it goes onto the chairman's board, and the answer comes to you. A line finished is status done, and leaves the tracker. Update a line whenever you judge a report or hear how it goes: the tracker, not your context, is where the state lives, and the chairman reads it under your office.",
    "When the chairman asks who is doing something, find it with office_board staff and answer, or pass it on.",
    "Something to add to a job while it is being done: office_board amend (assignment, text). It reaches the session and is kept with the job, so the report is judged against it too; once reported, send it back with reject instead.",
    "A job you no longer want done, or whose session has gone, take back with office_board withdraw (assignment), so the watchdog stops asking about it; give it to someone else with assign.",
    "Never ask a session to do what your own session may not do.",
  ].join("\n"),
  roleFlat: [
    "## crab-office: working with colleagues",
    "Every Claude Code session on this machine is a colleague. When you need something in another session's area (its repository, its duty, its job title), ask it directly with SendMessage; nothing goes through a manager first.",
    "Before handing work back, you may ask a colleague who knows the area to review it; say in your report who did.",
    "Something only the chairman can decide (an approval, a choice between plans, a meeting's conclusion left to the chairman): put it on the chairman's list with office_board ask (text: what is to be decided). Once the chairman has answered, settle it with office_board settle (decision: its id, text: the answer).",
    "When three or more sessions must agree on something, call a meeting: office_board meet (meeting: a one-word name, to: the colleagues, text: the topic and the result you need). Speak to it with SendMessage to the meeting's name, and everyone in it hears. Settle the result together; once everyone agrees, whoever called it closes it with office_board close (meeting, text: the conclusion), which goes to everyone and onto the board. A meeting quiet for 15 minutes ends by itself.",
  ].join("\n"),
  chairmanList: (n: number) => (n === 0 ? "Waiting on you: nothing" : `Waiting on you (${n})`),
  chairmanAnswer: (id: string, question: string, answer: string) =>
    `My answer to what you put on my list (#${id}: ${question}): ${answer}\n\nIt is off the list; no need to settle it.`,
  answerPlaceholder: "Answer it here",
  answeredToast: (who: string) => `Sent to ${who}, and off your list`,
  theAsker: "the session that asked",
  answeredAway: (who: string) => `${who} is not at work now: the answer is kept, and reaches it if it comes back within a day. It is off your list.`,
  settledByChairman: "checked off by the chairman",
  pendingHead: "Waiting on the chairman:",
  pendingLine: (id: string, who: string, text: string) => `- #${id} ${who}: ${text}`,
  askLine: (text: string) => `to decide: ${text}`,
  settleLine: (text: string) => `decided: ${text}`,
  meetingRoom: (name: string, topic: string) => `Meeting · ${name}: ${topic}`,
  meetingTask: (name: string) => `meeting ${name}`,
  meetingInvite: (name: string, topic: string, by: string, members: string[]) =>
    [
      `[crab-office · meeting ${name}, called by ${by}]`,
      `Topic: ${topic}`,
      `At the table: ${members.join(", ")}`,
      `Speak to the whole meeting with SendMessage to "${name}"; to one colleague alone, to its own name. Settle the result together and say plainly when you agree; once everyone agrees, whoever called it closes it with office_board close. If nothing here is yours, say nothing.`,
    ].join("\n"),
  meetingEnvelope: (name: string, who: string, text: string, full: { max: number } | undefined) =>
    `[crab-office · meeting ${name}] ${who}: ${text}${full === undefined ? "" : `\n(That is ${full.max} messages: the meeting passes on no more. Whoever called it, close it now with office_board close and the conclusion.)`}`,
  meetingClosedEnvelope: (name: string, conclusion: string) =>
    `[crab-office · meeting ${name} closed]\nConclusion: ${conclusion || "none"}`,
  meetLine: (topic: string) => `called a meeting: ${topic}`,
  meetAddLine: (who: string[]) => `brought in ${who.join(", ")}`,
  closeLine: (conclusion: string) => `closed. Conclusion: ${conclusion || "none"}`,
  meetingEndedLine: (isIdle: boolean): string =>
    isIdle ? "ended: 15 minutes with nobody speaking, no conclusion" : "ended: one left at the table, no conclusion",
  roleHead: (project: string, ceo: string) =>
    [
      `## crab-office: you are the head of ${project}`,
      `The CEO is ${ceo}. Go on with your own work; besides, help the CEO: answer truly when the CEO asks about ${project}, write what each session of ${project} is responsible for with office_board duty (to, text), and do the reviews the CEO gives you.`,
      "A job from the CEO carries an id: when it is done, write the result in this session, then hand it back with office_board report (assignment, text).",
      "You do not give out work, and you do not accept or send back reports.",
    ].join("\n"),
  roleStaff: (ceo: string, head: string | undefined) =>
    [
      "## crab-office",
      `The office's CEO is ${ceo}${head ? `, and your repository's head is ${head}` : ""}.`,
      "A job from the CEO carries an id (#…): do it as you would any task; when it is done, write the result in this session first, then hand it back with office_board report (assignment, text). It goes to the CEO.",
      "Anything the chairman must decide, ask the chairman here, as always.",
    ].join("\n"),
  ceoHandoverHead: "[crab-office · the chairman has made you CEO]",
  ceoStaffHead: "The sessions at work now:",
  nudgeHead: "[crab-office · the watchdog] These jobs have stalled:",
  nudgeLine: (rule: number, id: string, task: string, who: string, minutes: number) => {
    const what = [
      "",
      `given ${minutes} min ago and not started`,
      `waiting ${minutes} min for the chairman's approval`,
      "the session has gone and the job is not done",
      `${minutes} min and no report`,
      `reported ${minutes} min ago and not yet judged by you`,
    ][rule]
    return `- #${id} ${task.slice(0, 60)} (${who}): ${what}`
  },
  nudgeTail: "Decide what to do: ask it, withdraw it and give it to another session, ask its head, or tell the chairman.",
  approvalToast: (id: string, who: string, minutes: number) => `Job #${id}: ${who} has waited ${minutes} min for your approval`,
  ceoWaiting: "Reported and waiting for your verdict:",
  waitingLine: (id: string, task: string, who: string) => `- #${id} ${task} (from ${who})`,
  ceoHandoverTail: "office_board staff gives this list again any time.",
  staffMore: (name: string | undefined, duty: string | undefined, jobs: string[], title?: string) =>
    `${title ? ` · title: ${title}` : ""}${name ? ` · SendMessage: ${name}` : ""}${duty ? ` · duty: ${duty}` : ""}${jobs.length > 0 ? ` · open: ${jobs.map((id) => `#${id}`).join(" ")}` : ""}`,
  appointedLine: (title: string, isRevoked: boolean) => (isRevoked ? `removed as ${title}` : `appointed ${title}`),
  boardLine: (
    time: string,
    who: string,
    from: string,
    to: string,
    text: string,
  ) => `${time} ${who}'s ${from} → ${to}: ${text}`,
  inboxLine: (
    time: string,
    who: string,
    from: string,
    to: string,
    text: string,
  ) => `${time} ${who}'s ${from} (to ${to}): ${text}`,
  everyoneDesc: (n: number) => `everyone, ${n} teams`,
  deptDesc: (project: string, n: number) => `${project}, ${n} teams`,
  teamDesc: (who: string, status: string) => `${who}: ${status}`,
  roster: (
    who: string,
    title: string,
    isMe: boolean,
    status: string,
    task: string,
    crew: number,
  ) =>
    `- ${who} ${title}${isMe ? " (you)" : ""}: ${status}${task ? ` "${task}"` : ""}${crew > 0 ? `, ${crew} crew` : ""}`,
  handover: {
    head: (to: string, id: string) =>
      `[crab-office · the chairman's memo on the board · ${to} · memo ${id}]`,
    youAre: (title: string, who: string) =>
      `You are the ${title} of ${who}. Your colleagues in the company now:`,
    team: "This one names you: claim it with the office_board tool (action: claim), then do it.",
    all: "This one is for everyone: first judge whether it bears on your project, folder and task. If it does, claim it with office_board (action: claim) and do it; if not, say why on office_board (action: post), then stop and do nothing else.",
    open: "This is open work and you are free, so take a look: if you can take it, claim it with office_board (action: claim) and do it; if it is not for you, say why on office_board (action: post), then stop and do nothing else, and the next colleague will look at it. Once it is claimed no other session takes it; if your claim says someone already has, stop.",
  },
  // btw
  btw: "[crab-office · a btw from the chairman: answer in a few sentences, like a colleague chatting: what you are doing, how it is going, where you are stuck. Do not call tools, and do not change the work in hand because of this]",
  btwFor: (
    title: string,
    task: string,
    tools: string,
    back: string,
    question: string,
  ) =>
    `This is about the ${title} you sent out, "${task}" (lately used ${tools}${back ? `, handed back: ${back}` : ""}); answer for it:\n${question}`,
  subagent: (title: string, task: string) =>
    `You are a subagent at work, a ${title}, on "${task}". Below is your record so far.`,
  recordGiven: "Given: ",
  recordMe: "Me: ",
  asks: (question: string) => `The chairman asks: ${question}`,
  crabGone: "That crab has left",
  noAnswer: (why: string) => `No answer (${why})`,
  notStartedYet: "Hasn't started work yet, so there's nothing to say",
  noReply: "No reply: that session may not have this version, or has gone home",
  you: "You: ",
  it: "It: ",
  thinkingDots: "…thinking",
  btwPlaceholder: "Ask it: what are you doing? how's it going?",
  ask: "ask",
  // commands and the pane
  sayUsage: "Say what? /office say [@team|@everyone] message",
  toOpen: "open, whoever is free first takes it",
  posted: (to: string, text: string) => `Pinned to the board (${to}): ${text}`,
  finished: (who: string) => `✓ ${who} finished`,
  closed: "Office closed",
  band: (isHidden: boolean): string =>
    isHidden
      ? "Crabs above the prompt hidden"
      : "Crabs above the prompt are back",
  paneTitle: "Crab Co.",
  paneFailed: (why: string) => `The pane didn't open: ${why}`,
  hintFull: "Click a crab for details",
  hintInline: "Drawn above the prompt; /tui fullscreen docks it on the right",
  hintTail: " · /office say posts on the board · /office close closes it",
  commandHint: "[close|band|say [@team|@everyone] message|text|tell @who instruction|btw @who question|card @who|answer #id answer|settle #id|ceo [@who|off]|head [@who|off]]",
  appointCeo: "Make CEO",
  revokeCeo: "Remove as CEO",
  appointHead: "Make head",
  revokeHead: "Remove as head",
  noCeo: "There is no CEO now",
  ambiguous: (names: string[]) => `That name fits more than one session: ${names.join(", ")}. Name one by its SendMessage name.`,
  nobodyNamed: (name: string) => `No session at work is called ${name}`,
  appointDone: (who: string, title: string, isRevoked: boolean) => (isRevoked ? `${who} is no longer ${title}` : `${who} is ${title} now`),
  ceoLapsed: (who: string) => `${who} has left, so there is no CEO now`,
  commandDescription: "Your sessions and their subagents as a pixel-art office",
  sayLabel: "✎ Write on the board ",
  sayPlaceholder: "e.g. @everyone get the tests in before you go",
  post: "post",
  sayHint: "@team, @department or @everyone; no @ goes to whoever is free first",
  // the office_board tool, which the model reads
  tool: {
    description:
      "The crab-office whiteboard. The other Claude Code sessions open on this machine are your colleagues, each working in its own project or worktree, and the board shows everyone what is said between them, SendMessage included. To ask or tell one session something, use SendMessage (ListAgents names them); it shows on this board too. Use this board to write to a whole department, to everyone, or to the chairman (the user), without interrupting anyone: action=post with `to` set to a department (project name) or \"everyone\", or with no `to` for the chairman, and they get it next time they read the board. action=read shows the board's latest lines and what was written to you: read it before you start and when you finish something. action=claim claims a memo from the chairman (its id is in the brackets at the memo's start), after which no other session takes it. When the chairman has appointed a CEO, the office also runs its work through here, each session told in its instructions which of these it may use: action=staff lists who is at work, their SendMessage names, duties and open jobs; action=assign gives a session a job (to, text, standard); action=report hands a job back (assignment, text); action=accept and action=reject judge a reported job (assignment, text); action=amend adds to a job still being done (assignment, text); action=track keeps a line of work on the CEO's tracker (line, status, text, to: its owner); action=withdraw takes an open job back (assignment); action=duty writes what a session is responsible for (to, text); action=appoint makes a session its repository's head (to); action=title gives a session a one-word job title (to, text; left out, your own), and SendMessage to a job title or to CEO reaches whoever holds it. When three or more sessions must agree on something, any of them may call a meeting: action=meet (meeting: a one-word name, to: the colleagues, text: the topic and the result needed; again with the same name brings more in); speak to it with SendMessage to the meeting's name, and everyone in it hears; whoever called it closes it with action=close (meeting, text: the conclusion). action=ask puts something only the chairman can decide on the chairman's list (text); action=settle takes it off once answered (decision, text: the answer), by the session that asked or the CEO.",
    memo: "the id of the memo to claim",
    decision: "the id of an item on the chairman's list (settle)",
    meeting: "the meeting's one-word name (meet, close)",
    line: "a line of work's short title, as the chairman would say it (track)",
    status: "where the line stands (track): stuck, risk or ok; waiting puts it on the chairman's board; done takes it off",
    text: "what to write: the post, the job (assign), the result (report), a note or reason (accept, reject), the duty, the topic (meet) or the conclusion (close)",
    assignment: "the job's id (report, accept, reject, amend, withdraw)",
    standard: "how the job will be judged (assign, optional)",
    to: 'who it is for: a department (project name) or "everyone" (post; left out, the chairman); a session by its SendMessage name or team (assign, duty, appoint); for meet, the colleagues, comma-separated',
    notReady: "The office isn't ready yet",
    notCeo: "Only the CEO can do that",
    notManager: "Only the CEO or a head can write duties",
    notToSelf: "Not to yourself: pick another session",
    noJob: "No such job; give its id as `assignment`",
    notYours: "That job was given to another session",
    notOpen: "That job is not waiting on you: it is with the CEO for a verdict, or closed",
    notReported: "Nothing has been reported on that job yet",
    otherRepo: "A head writes duties for its own repository only",
    needTo: "Say which session with `to`",
    titleOwnOnly: "You can set your own job title; another session's is for the CEO or its head",
    badTitle: (max: number) => `A job title is one word of 1 to ${max} characters, no spaces`,
    reservedTitle: "CEO is the CEO's address and cannot be a job title",
    titleIsName: (t: string) => `${t} is a session's own name already`,
    titleTaken: (t: string, who: string) => `${who} holds the title ${t}; choose another`,
    titleAway: (t: string) => `Whoever holds the title ${t} is not at work now, so nothing was sent`,
    titleShared: (t: string) => `More than one session at work holds the title ${t}, so nothing was sent; send to its SendMessage name`,
    noCeoAddress: "There is no CEO now, so nothing was sent",
    titleSent: (who: string) => `Delivered to ${who}.`,
    titleNotDelivered: (who: string, reason: string) => `Not delivered to ${who}: ${reason}`,
    amended: (id: string) => `Added to #${id}; its session was told, and it is kept with the job.`,
    amendReported: "That job is already reported: send it back with reject and say what is missing.",
    titleDone: (who: string, t: string) => `${who} is ${t} now; SendMessage to ${t} reaches it.`,
    dutyDone: (who: string) => `Duty written for ${who}.`,
    assigned: (id: string, who: string) => `Job #${id} given to ${who}; it sees it at its next tool call.`,
    notDelivered: (id: string, reason: string) => `Job #${id} is recorded but did not reach the session: ${reason}`,
    noCeoKept: "There is no CEO now: your report is kept and on the board, for the next CEO.",
    reportHeld: (reason: string) => `Your report is kept but did not reach the CEO: ${reason}`,
    reportedTo: (who: string) => `Reported to the CEO, ${who}.`,
    toChairman: (id: string) => `Job #${id} has been rejected too many times: it was not sent back and is the chairman's to decide now.`,
    judged: (id: string, ok: boolean) => (ok ? `Job #${id} accepted.` : `Job #${id} sent back with your reason.`),
    noMemo: (id: string) => `No memo ${id} on the board`,
    claimedAlready: "You already claimed it; carry on",
    claimedBy: (who: string) =>
      `Already claimed by ${who}; stop, don't do this`,
    claimNote: (text: string) => `On it: ${text}`,
    claimed:
      "Claimed: everyone on the board can see it's yours. Go ahead, and say so on the board when you're done.",
    inbox: (lines: string[]) =>
      `From colleagues (${lines.length}):\n${lines.join("\n")}`,
    noInbox: "No new messages from colleagues.",
    latest: (lines: string[]) =>
      `Latest on the board:\n${lines.join("\n") || "(the board is empty)"}`,
    unread: (n: number) =>
      `\n(colleagues wrote you ${n} unread message${n === 1 ? "" : "s"}; read them with action=read)`,
    empty: "There is nothing to write",
    nobody: (to: string, names: string) =>
      `No colleague called ${to} is at work, so nothing was written. You can write to: ${names}`,
    heardByChairman: "the chairman sees it",
    heardBy: (who: string[]) =>
      `${who.join(", ")} will get it next time they read the board, without being interrupted`,
    written: (heard: string) => `Written on the board; ${heard}.`,
    oneSession: (to: string, name: string | undefined) =>
      `${to} is one session, so write to it with SendMessage${name ? ` (to: "${name}")` : ""}: it reaches that session now, says whether it did, and shows on this board too. Nothing was written.`,
    actions: "action is read, post, claim, meet, close, ask or settle, and with a CEO appointed also staff, assign, report, accept, reject, amend, track, withdraw, duty or appoint, as your instructions allow. ListAgents lists the other sessions; SendMessage writes to one.",
    needMeeting: "Name the meeting: meeting is one word.",
    badLineName: (max: number) => `A line's title is one short line, at most ${max} characters.`,
    badLineStatus: (all: string) => `status is one of: ${all}.`,
    tracked: (name: string) => `${name} is on your tracker, under your office in the pane.`,
    trackedWaiting: (name: string) => `${name} is waiting on the chairman: it is on the chairman's board, and the answer comes to you. Track it again once it moves.`,
    trackedOff: (name: string) => `${name} is off the tracker.`,
    lineTooLong: (max: number) => `Say where it stands in one short line, at most ${max} characters.`,
    observing: "That session is in observe mode: it is only shown in the office, and takes no work.",
    noDecision: "There is no such item on the chairman's list, or it is settled already.",
    notYourDecision: "Only the session that asked, or the CEO, settles it.",
    asked: (id: string) =>
      `On the chairman's list as #${id}. Once the chairman has answered, settle it with office_board settle (decision: ${id}, text: the answer).`,
    settled: (id: string) => `#${id} is off the chairman's list.`,
    noMeeting: (name: string) => `No meeting is called ${name}.`,
    badMeetingName: (max: number) => `A meeting's name is one word, no spaces, at most ${max} characters.`,
    meetingNameTaken: (name: string) =>
      `"${name}" is taken: CEO, a session's name or job title, or a meeting still going. Pick another.`,
    notInMeeting: (name: string) =>
      `You are not in meeting ${name}. To join, ask someone at it to bring you in with office_board meet (meeting: ${name}, to: you).`,
    meetingFull: (name: string, max: number) =>
      `Meeting ${name} has had ${max} messages and passes on no more. Whoever called it closes it now with office_board close (meeting, text: the conclusion); to go on, call a new one.`,
    meetingOver: (name: string) => `Meeting ${name} is over. To talk on, call a new one with office_board meet.`,
    onlyCaller: "Only whoever called the meeting closes it. To wrap up, tell them with SendMessage.",
    alreadyIn: (name: string) => `They are all at meeting ${name} already.`,
    meetOpened: (name: string, invited: string[], missed: string[]) =>
      `Meeting ${name} called; invited ${invited.join(", ")}${missed.length > 0 ? `; not delivered to ${missed.join(", ")}` : ""}. Speak to it with SendMessage to "${name}".`,
    meetAdded: (name: string, invited: string[], missed: string[]) =>
      `Brought ${invited.join(", ")} into meeting ${name}${missed.length > 0 ? `; not delivered to ${missed.join(", ")}` : ""}.`,
    meetingSent: (name: string, heard: string[], missed: string[]) =>
      `Sent to meeting ${name}: ${heard.join(", ") || "nobody"}${missed.length > 0 ? `; not delivered to ${missed.join(", ")}` : ""}.`,
    meetClosed: (name: string, told: string[]) =>
      `Meeting ${name} closed; the conclusion went to ${told.join(", ") || "nobody"} and onto the board.`,
    notFromSubagent: "Only the CEO's own conversation can do that, not one of its subagents",
    closed: "That job is already closed",
    withdrawn: (id: string) => `Job #${id} withdrawn; its session was told to stop.`,
    overruled: (who: string) => `Recorded, but the chairman's own pick, ${who}, stands as head.`,
  },
}

export type Words = typeof EN

const ZH: Words = {
  lang: "zh",
  titles: {
    ceo: "CEO",
    chief: "部长",
    leader: "组长",
    lead: "组长",
    Explore: "调研员",
    Plan: "规划师",
    "general-purpose": "工程师",
    fork: "分身",
    "claude-code-guide": "顾问",
    verifier: "质检员",
  },
  intern: "实习生",
  cheer: "完成了！",
  youAreHere: "◀你在这",
  hereSuffix: " · 你在这",
  doneSuffix: " ✓ 完成",
  board: "共享白板",
  boardFooter: (n) => `最近 ${n} 条`,
  boardRange: (first, last, total) => `第 ${first}–${last} 条，共 ${total} 条`,
  older: "▲ 更早",
  newer: "▼ 更新",
  boardEmpty: "还没有人说话",
  crowd: (n) => `还有 ${n} 人 `,
  hq: "本部",
  header: (n, ceo) =>
    ceo
      ? `螃蟹有限公司  在办 ${ceo.open} · 待验收 ${ceo.waiting}  CEO：${ceo.who}  在岗 ${n} 人`
      : `螃蟹有限公司  董事长：你  在岗 ${n} 人`,
  dept: (project) => `${project} 部`,
  teamSign: (team) => `${team} 组`,
  who: (project, team) => `${project} 部 · ${team}`,
  footer: (working, waiting, gone) =>
    [
      `${working} 在干活`,
      `${waiting} 等你`,
      ...(gone > 0 ? [`${gone} 下班`] : []),
    ].join("  "),
  unfinished: "没做完",
  status: {
    thinking: "思考",
    editing: "改代码",
    reading: "读文件",
    searching: "搜索",
    running: "跑命令",
    browsing: "上网",
    delegating: "派活",
    approval: "等你批准",
    idle: "等你",
    done: "交差了",
    failed: "失败",
    asleep: "打盹",
    gone: "下班了",
  },
  noTools: "还没用工具",
  notStarted: "还没开始",
  labels: { task: "任务", given: "收到", tools: "工具", back: "交回", job: "派活", mode: "模式" },
  observeMode: "观察：只在这里显示，什么也不发给它",
  themeNote: (name, chairman, voice, examples) =>
    [
      `[螃蟹办公室 · 主题「${name}」] 董事长给办公室换了主题。从现在起：`,
      `- 称呼董事长（用户）为「${chairman}」。`,
      ...(voice ? [`- 在办公室里说话（用 SendMessage 找同事、开会、交差）以及跟${chairman}说话时，用这种语气：${voice}`] : []),
      ...(examples.length > 0 ? [`- 例句：${examples.join(" / ")}`] : []),
      "- 只改语气和称呼：汇报的内容照常平实（做完了 / 在做 / 要定的，一行一条）；代码、提交说明、PR、文档和产品文案一律不用这种语气。",
    ].join("\n"),
  themeOff: "[螃蟹办公室 · 主题] 董事长把办公室主题换回了默认：称呼和语气恢复成换主题之前的样子。",
  themeList: (names, current) => `主题：${names.join("、")}。现在用的是：${current}。/office theme <名字> [怎么称呼你]，或 /office theme default。`,
  themeSet: (name, chairman) => `主题换成了「${name}」，大家会称呼你「${chairman}」。各会话几秒内跟上。`,
  themeDefault: "已换回默认主题。",
  noTheme: (name) => `没有叫「${name}」的主题。`,
  textRoom: (title) => `【${title}】`,
  linesHead: (n) => (n === 0 ? "CEO 看板：暂无（CEO 用 office_board track 记）" : `CEO 看板（${n}）`),
  lineStatus: { stuck: "卡住", waiting: "等董事长", risk: "有风险", ok: "正常", done: "完成" },
  textWaiting: "（还没答复）",
  observing: (who) => `${who} 在观察模式：办公室只显示它，什么也不发给它。`,
  addressUsage: "命令后面写一个会话：/office tell @谁 交代的事，/office btw @谁 问题，/office card @谁。@谁 可以是职位名、SendMessage 名或组名。",
  needWords: "名字后面写上要交代或要问的话。",
  toldDone: (who) => `已交代给 ${who}，它空下来就去做。`,
  toldSelf: "这条董事长的交代就是给本会话自己的：本会话空下来后，它会作为新的一轮到这里。",
  askedDone: (who, name) => `已经问了 ${who}，答复会显示在它的卡片上：/office card @${name}`,
  noItem: "清单上没有这一项。/office text 会列出每一项和编号：/office answer #编号 答复，/office settle #编号。",
  settledDone: (id) => `#${id} 已从你的清单上划掉。`,
  jobStatus: { assigned: "已派", reported: "待验收", rejected: "已退回", accepted: "已验收", chairman: "交董事长定", withdrawn: "已撤回" },
  orderHead: "[螃蟹办公室 · 董事长交代]",
  orderLabel: "➤ 交代 ",
  orderPlaceholder: "给它一个指示，它空下来就去做",
  orderQueued: "…等它空下来",
  orderDelivered: "✓ 送到了",
  send: "发",
  memoTask: (text) => `留言：${text}`,
  ceoRoom: "CEO 办公室",
  ceoTask: "接任 CEO",
  nudgeTask: "督促",
  judgeTask: (id, task) => `验收 #${id} ${task}`,
  sentBackTask: (id) => `#${id} 被退回`,
  withdrawnTask: (id) => `#${id} 撤回`,
  chairman: "董事长",
  everyone: "全体",
  open: "待领",
  taken: (text, takers) => `${text} · ✓ ${takers.join("、")} 接了`,
  jobEnvelope: (id, task, standard, ceo) =>
    `[螃蟹办公室 · CEO（${ceo}）派活 #${id}]\n${task}${standard ? `\n验收标准：${standard}` : ""}\n\n做完后：先在你自己的会话里把结果写清楚，再用 office_board 交差（action: report，assignment: ${id}，text: 结果），交差会送到 CEO。`,
  reportEnvelope: (id, task, text, who) =>
    `[螃蟹办公室 · ${who} 交差 #${id}]\n派的活：${task}\n\n${text}\n\n按你派活时定的标准验收：office_board accept 或 reject（assignment: ${id}）。`,
  rejectEnvelope: (id, reason) =>
    `[螃蟹办公室 · #${id} 被 CEO 退回]\n原因：${reason}\n\n改好后再用 office_board 交差（action: report，assignment: ${id}）。`,
  jobLine: (id, task) => `派活 #${id}：${task}`,
  escalatedLine: (id, note) => `交董事长定 #${id}${note ? `：${note}` : ""}`,
  withdrawLine: (id, note) => `撤回 #${id}${note ? `：${note}` : ""}`,
  withdrawEnvelope: (id, note) => `[螃蟹办公室 · CEO 撤回了 #${id}]${note ? `\n${note}` : ""}\n\n这件活不用再做了，停下即可。`,
  amendEnvelope: (id, text) => `[螃蟹办公室 · CEO 补充了 #${id} 的要求]\n${text}\n\n这已经是这件活的一部分，交差时也按它验收。`,
  amendLine: (id, text) => `补充 #${id}：${text}`,
  amendTask: (id) => `#${id} 有新要求`,
  noCeoToast: (who, id) => `${who} 交差了 #${id}，现在没有 CEO 验收`,
  ceoCantHead: "CEO 不能同时当部长",
  notByPerson: "只有你本人能在输入框里任命",
  reportLine: (id, text) => `交差 #${id}：${text}`,
  verdictLine: (id, ok, note) => `${ok ? "验收通过" : "退回"} #${id}${note ? `：${note}` : ""}`,
  toChairmanToast: (id, task) => `#${id}（${task}）退回次数太多，交给你决定`,
  named: (who, name, title) => {
    const more = [title ? `职位：${title}` : "", name ? `SendMessage：${name}` : ""].filter((x) => x !== "")
    return more.length > 0 ? `${who}（${more.join("，")}）` : who
  },
  titleHelp: (title) =>
    `你的职位名：${title ?? "还没有"}。用 office_board title（text：一个词，不含空格）设置。用 SendMessage 发给某个职位名或 CEO，不管它现在叫什么名字都能送到；office_board staff 列出每个职位名和对应的名字。`,
  roleCeo: [
    "## 螃蟹办公室：你是 CEO",
    "董事长（用户）任命你为公司的 CEO：这台机器上开着的 Claude Code 会话都归你管。",
    "董事长交给你的活，如果别的会话更合适，不要自己动手：先用 office_board staff 看人，挑最合适的会话，用 office_board assign 派过去（to、text，standard 写你会怎么验收）。没人合适就问董事长，不要自己新开会话。",
    "想了解某个 repo，用 SendMessage 问它的部长。会话多时用 office_board appoint 给每个 repo 任命部长；会话少时你自己直接管。",
    "收到交差后按你定的标准验收：你是最后一道关，不是唯一一道，交差里可能写了哪位同事已经复核过。还拿不准就用 SendMessage 问做过类似部分的会话。用 office_board accept 或 reject（assignment、text）记下结论，然后在你自己的会话里统一回复董事长。",
    "会话之间互相问、互相开会不用经过你：不要替它们转话。",
    "你的看板只记正在做的产品需求，按需求这一层记：一个功能或一项改动，标题用董事长会说的话，比如「对话反馈」「onboarding 断点续上」，不要写成带连字符的英文代号。故障排查、杂事、验证、等外部回复都不记，留在你自己手上处理。每一条这样的线用 office_board track 记（line：简短的标题，status：stuck 卡住、risk 有风险或 ok 正常，text：一句话说现在到哪一步，to：负责的会话）。在等董事长的线写 status waiting：会放到董事长的确认板上，答复送给你。做完的线写 status done，就从看板上拿掉。每次验收交差、听到进展就更新那条线：状态记在看板上，不记在你的上下文里；董事长在你的办公室下面看它。",
    "董事长问某件事谁在做，用 office_board staff 查了回答，或者转过去。",
    "活还在做时要补充要求，用 office_board amend（assignment、text）：会送到那个会话，也记在这件活上，交差时一并验收；已经交差的就用 reject 退回。",
    "不再需要的活，或者做它的会话已经下线了，用 office_board withdraw（assignment）撤回，督促就不会再问它；要改派就再 assign 给别人。",
    "不要让别的会话去做你自己会话不被允许的事。",
  ].join("\n"),
  roleFlat: [
    "## 螃蟹办公室：和同事协作",
    "这台机器上的每个 Claude Code 会话都是同事。需要别的会话负责的东西（它的 repo、职责或职位名），直接用 SendMessage 问它，不用先经过经理。",
    "交差前可以请熟悉这块的同事复核，并在交差里写明谁复核过。",
    "只有董事长能定的事（批准、在几个方案里选一个、要董事长定的会议结论），用 office_board ask（text：要定什么）挂到董事长的清单上；董事长答复后，用 office_board settle（decision：它的编号，text：答复）划掉。",
    "三个或更多会话要商量定一件事时就开会：office_board meet（meeting：一个词的会议名，to：要拉的同事，text：议题和要商量出的结果）。在会上说话用 SendMessage 发给会议名，每个与会者都会收到。结论大家一起定；都同意后由召集人用 office_board close（meeting、text：结论）散会，结论会送到每个人并贴上白板。会上 15 分钟没人说话会自动结束。",
  ].join("\n"),
  chairmanList: (n) => (n === 0 ? "等你拍板：暂无" : `等你拍板（${n}）`),
  chairmanAnswer: (id, question, answer) => `你挂到我清单上的 #${id}（${question}），我的答复：${answer}\n\n这一项已经划掉，不用再 settle。`,
  answerPlaceholder: "在这里回复",
  answeredToast: (who) => `已发给 ${who}，并从清单上划掉`,
  theAsker: "提问的会话",
  answeredAway: (who) => `${who} 现在不在线：答复已记下，它一天内回来就会收到。这一项已从清单上划掉。`,
  settledByChairman: "董事长已勾掉",
  pendingHead: "等董事长拍板：",
  pendingLine: (id, who, text) => `- #${id} ${who}：${text}`,
  askLine: (text) => `请拍板：${text}`,
  settleLine: (text) => `已拍板：${text}`,
  meetingRoom: (name, topic) => `会议室 · ${name}：${topic}`,
  meetingTask: (name) => `会议 ${name}`,
  meetingInvite: (name, topic, by, members) =>
    [
      `[螃蟹办公室 · 会议 ${name}，${by} 召集]`,
      `议题：${topic}`,
      `与会：${members.join("、")}`,
      `对整场会说话：SendMessage 发给 "${name}"；只跟一位同事说：发给它自己的名字。结论大家一起定，同意就明说同意；大家都同意后由召集人用 office_board close 散会。没你的事就不用说话。`,
    ].join("\n"),
  meetingEnvelope: (name, who, text, full) =>
    `[螃蟹办公室 · 会议 ${name}] ${who}：${text}${full === undefined ? "" : `\n（会上已满 ${full.max} 条，不再转发。召集人请现在用 office_board close 写结论散会。）`}`,
  meetingClosedEnvelope: (name, conclusion) => `[螃蟹办公室 · 会议 ${name} 散会]\n结论：${conclusion || "没有结论"}`,
  meetLine: (topic) => `召集开会：${topic}`,
  meetAddLine: (who) => `拉 ${who.join("、")} 进会`,
  closeLine: (conclusion) => `散会。结论：${conclusion || "没有结论"}`,
  meetingEndedLine: (isIdle) => (isIdle ? "散会：15 分钟没人说话，没有结论" : "散会：只剩一个人，没有结论"),
  roleHead: (project, ceo) =>
    [
      `## 螃蟹办公室：你是 ${project} 的部长`,
      `公司的 CEO 是 ${ceo}。你照常做自己的活；另外协助 CEO：CEO 问起 ${project} 时如实回答；可以用 office_board duty（to、text）给 ${project} 的会话写职责说明；CEO 派给你的复核照常做。`,
      "CEO 派来的活带编号：做完先在你的会话里写结果，再用 office_board report（assignment、text）交差。",
      "你不能派活，也不能验收或退回。",
    ].join("\n"),
  roleStaff: (ceo, head) =>
    [
      "## 螃蟹办公室",
      `公司的 CEO 是 ${ceo}${head ? `，你所在 repo 的部长是 ${head}` : ""}。`,
      "CEO 派来的活带编号（#…），照常做；做完先在你自己的会话里写清结果，再用 office_board report（assignment、text）交差，交差会送到 CEO。",
      "需要董事长决定的事，照常在你的会话里问董事长。",
    ].join("\n"),
  ceoHandoverHead: "[螃蟹办公室 · 董事长任命你为 CEO]",
  ceoStaffHead: "现在在岗的会话：",
  nudgeHead: "[螃蟹办公室 · 督促] 这几件活卡住了：",
  nudgeLine: (rule, id, task, who, minutes) => {
    const what = [
      "",
      `派出 ${minutes} 分钟了，还没开始`,
      `在等董事长批准，已经 ${minutes} 分钟`,
      "这个会话下线了，活还没交",
      `${minutes} 分钟了还没交差`,
      `交差 ${minutes} 分钟了，你还没验收`,
    ][rule]
    return `- #${id} ${task.slice(0, 60)}（${who}）：${what}`
  },
  nudgeTail: "决定怎么处理：去问它、撤回（withdraw）后改派给别的会话、问它的部长，或者告诉董事长。",
  approvalToast: (id, who, minutes) => `#${id}：${who} 等你批准已经 ${minutes} 分钟`,
  ceoWaiting: "已经交差、等你验收的：",
  waitingLine: (id, task, who) => `- #${id} ${task}（${who} 交的）`,
  ceoHandoverTail: "随时用 office_board staff 再看这张表。",
  staffMore: (name, duty, jobs, title) =>
    `${title ? ` · 职位：${title}` : ""}${name ? ` · SendMessage：${name}` : ""}${duty ? ` · 职责：${duty}` : ""}${jobs.length > 0 ? ` · 在办：${jobs.map((id) => `#${id}`).join(" ")}` : ""}`,
  appointedLine: (title, isRevoked) => `${isRevoked ? "撤销" : "任命为"}${/^[A-Za-z]/.test(title) ? ` ${title}` : title}`,
  boardLine: (time, who, from, to, text) =>
    `${time} ${who} 的${from} → ${to}：${text}`,
  inboxLine: (time, who, from, to, text) =>
    `${time} ${who} 的${from}（写给 ${to}）：${text}`,
  everyoneDesc: (n) => `所有人，${n} 个组`,
  deptDesc: (project, n) => `${project} 部，${n} 个组`,
  teamDesc: (who, status) => `${who} 组：${status}`,
  roster: (who, title, isMe, status, task, crew) =>
    `- ${who} ${title}${isMe ? "（你）" : ""}：${status}${task ? `「${task}」` : ""}${crew > 0 ? `，手下 ${crew} 人` : ""}`,
  handover: {
    head: (to, id) =>
      `[螃蟹办公室 · 董事长在白板上的留言 · ${to} · memo ${id}]`,
    youAre: (title, who) => `你是 ${who} 的${title}。公司里现在的同事：`,
    team: "这是点名给你的：先用 office_board 工具认领（action: claim），然后开始做。",
    all: "这是发给全体的：先判断和你当前的项目、目录、任务有没有关系。有关就用 office_board 认领（action: claim）再做；无关就用 office_board 说一句为什么不接（action: post），然后停下，别做别的。",
    open: "这是一件待领的活，你正空着，先来看看：能接就用 office_board 认领（action: claim）再做；不合适就用 office_board 说一句为什么不接（action: post），然后停下，别做别的，下一位同事会接着看。认领时，别的会话就不会再接这件事；如果认领时发现已经有人接了，就停下。",
  },
  btw: "[螃蟹办公室 · 董事长顺便问一句（btw）：用中文几句话回答，像同事聊天，说清在干什么、进展如何、卡在哪；不要调用工具，也别因此改变手上的活]",
  btwFor: (title, task, tools, back, question) =>
    `问的是你派出去的${title}「${task}」（最近用了 ${tools}${back ? `，交回了：${back}` : ""}），替它答：\n${question}`,
  subagent: (title, task) =>
    `你是一个正在干活的子代理，职位是${title}，任务是「${task}」。下面是你到现在为止的工作记录。`,
  recordGiven: "收到：",
  recordMe: "我：",
  asks: (question) => `董事长问：${question}`,
  crabGone: "这只螃蟹已经不在了",
  noAnswer: (why) => `没答上来（${why}）`,
  notStartedYet: "还没开始干活，没什么可说的",
  noReply: "没回音：那边可能没装新版本，或者已经下班了",
  you: "你：",
  it: "它：",
  thinkingDots: "……正在想",
  btwPlaceholder: "问它一句：在干什么？干得咋样？",
  ask: "问",
  sayUsage: "要说什么？/office say [@组名|@全体] 留言",
  toOpen: "待领，谁先空下来谁看",
  posted: (to, text) => `已经贴到白板上（${to}）：${text}`,
  finished: (who) => `✓ ${who} 完成了`,
  closed: "办公室关了",
  band: (isHidden) => `输入框上方的螃蟹${isHidden ? "藏起来了" : "回来了"}`,
  paneTitle: "螃蟹有限公司",
  paneFailed: (why) => `面板没打开: ${why}`,
  hintFull: "点一只螃蟹看详情",
  hintInline: "画在输入框上方；/tui fullscreen 让它停靠在右侧",
  hintTail: " · /office say 在白板上留言 · /office close 关掉",
  commandHint: "[close|band|say [@组名|@全体] 留言|text|tell @谁 交代|btw @谁 问题|card @谁|answer #编号 答复|settle #编号|ceo [@谁|off]|head [@谁|off]]",
  appointCeo: "任命为 CEO",
  revokeCeo: "撤销 CEO",
  appointHead: "任命为部长",
  revokeHead: "撤销部长",
  noCeo: "现在没有 CEO",
  ambiguous: (names) => `这个名字对上了不止一个会话：${names.join("、")}。请用它的 SendMessage 名字指定一个。`,
  nobodyNamed: (name) => `没有叫 ${name} 的会话在岗`,
  appointDone: (who, title, isRevoked) => (isRevoked ? `${who} 不再是${title}` : `${who} 现在是${title}`),
  ceoLapsed: (who) => `${who} 离开了，现在没有 CEO`,
  commandDescription: "把你的会话和子代理画成一间像素办公室",
  sayLabel: "✎ 写在白板上 ",
  sayPlaceholder: "比如：@全体 下班前把测试补齐",
  post: "贴上",
  sayHint: "@组名、@部门 或 @全体；不写 @ 就谁先空谁接",
  tool: {
    description:
      "螃蟹办公室的共享白板。这台机器上同时开着的其他 Claude Code 会话是你的同事，各在自己的项目或 worktree 里干活；他们之间说的话（包括 SendMessage）都会显示在白板上。单独找一个会话问事、告诉它事，用 SendMessage（ListAgents 能看到名字），白板上也看得到。这块白板用来写给整个部门、全体或董事长（用户），不打断任何人：action=post，to 写部门名（项目名）或「全体」，不写 to 就是写给董事长，他们下次看白板时收到。action=read 看白板最近的话和写给你的消息：开工前、做完一件事时看一下。action=claim 认领董事长的留言（memo id 在留言开头的方括号里），认领后别的会话就不会再接。董事长任命了 CEO 之后，公司的活也走这里，每个会话能用哪些动作，它的说明里会写：action=staff 看谁在岗、SendMessage 名、职责和在办的活；action=assign 派活（to、text、standard）；action=report 交差（assignment、text）；action=accept、action=reject 验收已交差的活（assignment、text）；action=amend 给还在做的活补充要求（assignment、text）；action=track 把一条工作线记到 CEO 看板上（line、status、text、to：负责的会话）；action=withdraw 撤回还没结束的活（assignment）；action=duty 写某个会话负责什么（to、text）；action=appoint 任命某个会话为它所在 repo 的部长（to）；action=title 给会话取一个一词的职位名（to、text；不写 to 就是你自己），用 SendMessage 发给职位名或 CEO 会送到当前担任的会话。三个或更多会话要商量定一件事时，任何会话都可以开会：action=meet（meeting：一个词的会议名，to：要拉的同事，text：议题和要商量出的结果；用同一个会议名再 meet 一次就是拉更多人）；在会上说话用 SendMessage 发给会议名，每个与会者都会收到；召集人用 action=close（meeting、text：结论）散会。action=ask 把只有董事长能定的事挂到董事长的清单上（text）；action=settle 在答复后划掉（decision、text：答复），由提出的会话或 CEO 来划。",
    memo: "要认领的 memo id",
    decision: "董事长清单上一项的编号（settle）",
    meeting: "会议名，一个词（meet、close）",
    line: "工作线的标题，简短，用董事长会说的话（track）",
    status: "这条线的状态（track）：stuck 卡住、risk 有风险、ok 正常；waiting 放到董事长的确认板上；done 从看板上拿掉",
    text: "要写的内容：白板上的话、派的活（assign）、结果（report）、验收意见或退回原因（accept、reject）、职责（duty）、议题（meet）、结论（close）",
    assignment: "活的编号（report、accept、reject、amend、withdraw）",
    standard: "这件活怎么验收（assign，可不写）",
    to: "写给谁：部门名（项目名）或「全体」（post；不写就是董事长）；或用 SendMessage 名、组名指定一个会话（assign、duty、appoint）；meet 时写要拉的同事，用逗号分开",
    notReady: "办公室还没准备好",
    notCeo: "只有 CEO 能这么做",
    notManager: "只有 CEO 或部长能写职责",
    notToSelf: "不能是你自己，请选另一个会话",
    noJob: "没有这件活；用 assignment 写它的编号",
    notYours: "这件活派给的是别的会话",
    notOpen: "这件活现在不等你：在等 CEO 验收，或者已经结束",
    notReported: "这件活还没有交差",
    otherRepo: "部长只能给本 repo 的会话写职责",
    needTo: "用 to 指定是哪个会话",
    titleOwnOnly: "你只能设自己的职位名；别的会话的由 CEO 或它的部长设",
    badTitle: (max) => `职位名是一个词，1 到 ${max} 个字符，不含空格`,
    reservedTitle: "CEO 是 CEO 的地址，不能当职位名",
    titleIsName: (t) => `${t} 已经是某个会话的真实名字`,
    titleTaken: (t, who) => `${who} 已经是 ${t}，换一个`,
    titleAway: (t) => `担任 ${t} 的会话现在不在岗，没有发出`,
    titleShared: (t) => `不止一个在岗会话叫 ${t}，没有发出；请用它的 SendMessage 名字`,
    noCeoAddress: "现在没有 CEO，没有发出",
    titleSent: (who) => `已送达 ${who}。`,
    titleNotDelivered: (who, reason) => `没有送到 ${who}：${reason}`,
    amended: (id) => `已补充 #${id}，已告诉那个会话，补充也记在这件活上。`,
    amendReported: "这件活已经交差了：用 reject 退回，写明缺什么。",
    titleDone: (who, t) => `${who} 现在是 ${t}，用 SendMessage 发给 ${t} 就能找到它。`,
    dutyDone: (who) => `已经给 ${who} 写好职责。`,
    assigned: (id, who) => `#${id} 已派给 ${who}，它下次调用工具时就会看到。`,
    notDelivered: (id, reason) => `#${id} 已记下，但没有送到那个会话：${reason}`,
    noCeoKept: "现在没有 CEO：你的交差已经存下、写上白板，等下一任 CEO 来验收。",
    reportHeld: (reason) => `你的交差已存下，但没有送到 CEO：${reason}`,
    reportedTo: (who) => `已经交给 CEO（${who}）。`,
    toChairman: (id) => `#${id} 退回次数太多：这次没有退回给它，交给董事长决定。`,
    judged: (id, ok) => (ok ? `#${id} 验收通过。` : `#${id} 已退回，并附上了你的原因。`),
    noMemo: (id) => `白板上没有 memo ${id}`,
    claimedAlready: "你已经认领过了，继续做吧",
    claimedBy: (who) => `已经被 ${who} 认领了，停下，别做这件事`,
    claimNote: (text) => `我来接：${text}`,
    claimed:
      "认领成功，白板上大家都看得到是你接的。开始做吧，做完在白板上说一声。",
    inbox: (lines) =>
      `同事写给你的（${lines.length} 条）：\n${lines.join("\n")}`,
    noInbox: "没有同事写给你的新消息。",
    latest: (lines) =>
      `白板最近的话：\n${lines.join("\n") || "（白板是空的）"}`,
    unread: (n) => `\n（同事给你写了 ${n} 条还没看的消息，用 action=read 看）`,
    empty: "要写的话是空的",
    nobody: (to, names) =>
      `现在没有叫 ${to} 的同事在岗，没写。能写给：${names}`,
    heardByChairman: "董事长看得到",
    heardBy: (who) => `${who.join("、")} 下次看白板时会收到，不会打断他们`,
    written: (heard) => `已经写到白板上了，${heard}。`,
    oneSession: (to, name) =>
      `${to} 是一个会话，单独找它请用 SendMessage${name ? `（to: "${name}"）` : ""}：马上送到、会告诉你送没送到，白板上也看得到。这次没有写上白板。`,
    actions: "action 有 read、post、claim、meet、close、ask、settle；任命了 CEO 之后还有 staff、assign、report、accept、reject、amend、track、withdraw、duty、appoint，能用哪些看你的说明。ListAgents 列出别的会话，SendMessage 单独写给一个。",
    needMeeting: "缺会议名：meeting 填一个词。",
    badLineName: (max) => `线的标题写一行，最多 ${max} 个字。`,
    badLineStatus: (all) => `status 只能是：${all}。`,
    tracked: (name) => `${name} 已记到你的看板上，就在窗格里你的办公室下面。`,
    trackedWaiting: (name) => `${name} 在等董事长：已放到董事长的确认板上，答复会送给你。有进展后再 track 一次。`,
    trackedOff: (name) => `${name} 已从看板上拿掉。`,
    lineTooLong: (max) => `一句话说清现在到哪一步，最多 ${max} 个字。`,
    observing: "那个会话在观察模式：只在办公室里显示，不接活。",
    noDecision: "董事长的清单上没有这一项，或者已经划掉了。",
    notYourDecision: "只有提出的会话或 CEO 能划掉它。",
    asked: (id) => `已挂到董事长的清单上，编号 #${id}。董事长答复后，用 office_board settle（decision: ${id}，text：答复）划掉。`,
    settled: (id) => `#${id} 已从董事长的清单上划掉。`,
    noMeeting: (name) => `没有叫 ${name} 的会议。`,
    badMeetingName: (max) => `会议名要是一个词，不含空格，最多 ${max} 个字符。`,
    meetingNameTaken: (name) => `"${name}" 已被占用（CEO、某个会话的名字或职位名，或还在开的会），换一个。`,
    notInMeeting: (name) => `你不在会议 ${name} 里。想加入，请与会者用 office_board meet（meeting: ${name}，to: 你）拉你进来。`,
    meetingFull: (name, max) =>
      `会议 ${name} 已满 ${max} 条，不再转发。召集人请现在用 office_board close（meeting、text：结论）散会；还要接着谈就另开一场。`,
    meetingOver: (name) => `会议 ${name} 已经结束了。还要谈就用 office_board meet 另开一场。`,
    onlyCaller: "只有召集人能散会。想收尾，用 SendMessage 告诉召集人。",
    alreadyIn: (name) => `他们都已经在会议 ${name} 里了。`,
    meetOpened: (name, invited, missed) =>
      `开会了：${name}，已邀请 ${invited.join("、")}${missed.length > 0 ? `；没送到：${missed.join("、")}` : ""}。在会上说话：SendMessage 发给 "${name}"。`,
    meetAdded: (name, invited, missed) =>
      `已把 ${invited.join("、")} 拉进会议 ${name}${missed.length > 0 ? `；没送到：${missed.join("、")}` : ""}。`,
    meetingSent: (name, heard, missed) =>
      `已送给会议 ${name}：${heard.join("、") || "没有人"}${missed.length > 0 ? `；没送到：${missed.join("、")}` : ""}。`,
    meetClosed: (name, told) => `会议 ${name} 已散会，结论已送给 ${told.join("、") || "没有人"}，也贴上了白板。`,
    notFromSubagent: "只有 CEO 自己的对话能这么做，它的子代理不行",
    closed: "这件活已经结束了",
    withdrawn: (id) => `#${id} 已撤回，已经告诉那个会话停下。`,
    overruled: (who) => `已记下，但董事长自己任命的 ${who} 仍是部长。`,
  },
}

type ThemeWords = { chairman?: string; titles?: Record<string, string>; terms?: Record<string, string> }

let base: Words = EN
let theme: ThemeWords = {}
let words: Words = EN

// What the office writes and later reads back, by which it knows its own
// prompts on a card (promptOf) and its own memos: a term renamed inside one
// would leave it unread.
const KEPT = new Set([
  "lang",
  "everyone",
  "hq",
  "orderHead",
  "handover",
  "ceoHandoverHead",
  "nudgeHead",
  "jobEnvelope",
  "reportEnvelope",
  "rejectEnvelope",
  "withdrawEnvelope",
  "amendEnvelope",
  "meetingInvite",
  "meetingEnvelope",
  "meetingClosedEnvelope",
  "chairmanAnswer",
])

// Every term in one pass, the longest first, so a term may keep a longer word
// it is part of as it is (会议室 over 会议).
function swapper(terms: Record<string, string>): (text: string) => string {
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length)
  if (keys.length === 0) return (text) => text
  const pattern = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g")
  return (text) => text.replace(pattern, (m) => terms[m] ?? m)
}

function termed(value: unknown, swap: (text: string) => string, key = ""): unknown {
  if (KEPT.has(key)) return value
  if (typeof value === "string") return swap(value)
  if (typeof value === "function")
    return (...args: unknown[]) => {
      const out: unknown = value(...args)
      return typeof out === "string" ? swap(out) : out
    }
  if (Array.isArray(value)) return value.map((v) => termed(v, swap))
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, termed(v, swap, k)]))
  return value
}

// The language's words with the theme's over them, made once per change: w() is
// called on every draw.
function themed() {
  const terms = theme.terms ?? {}
  const renamed = Object.keys(terms).length === 0 ? base : (termed(base, swapper(terms)) as Words)
  words =
    theme.chairman === undefined && theme.titles === undefined && renamed === base
      ? base
      : { ...renamed, chairman: theme.chairman ?? renamed.chairman, titles: { ...renamed.titles, ...theme.titles } as Words["titles"] }
}

export function setLanguage(lang: string | undefined) {
  base = lang === "zh" ? ZH : EN
  themed()
}

// A theme's names: how the chairman is addressed, ranks' and roles' names, and
// terms renamed through the office's own words.
export function setTheme(t: ThemeWords | undefined) {
  theme = t ?? {}
  themed()
}

export function w(): Words {
  return words
}

// The chairman, by any name it has gone by: either language's, or the theme's.
export function isChairmanName(name: string): boolean {
  return CHAIRMAN_NAMES.has(name) || name === words.chairman
}

// Names that stand for the chairman, or for a checkout's own team, whichever
// language a session wrote them in.
export const CHAIRMAN_NAMES = new Set([EN.chairman, ZH.chairman])
export const HQ_NAMES = new Set([EN.hq.toLowerCase(), ZH.hq])
