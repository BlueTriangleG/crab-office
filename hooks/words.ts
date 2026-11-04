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
  labels: { task: "Task", given: "Given", tools: "Tools", back: "Back", job: "Job" },
  jobStatus: { assigned: "given", reported: "to judge", rejected: "sent back", accepted: "accepted", chairman: "yours to decide" } as Record<string, string>,
  orderHead: "[crab-office · from the chairman]",
  orderLabel: "➤ Tell it ",
  orderPlaceholder: "an instruction; it does it once it's free",
  orderQueued: "…waiting until it's free",
  orderDelivered: "✓ delivered",
  send: "send",
  memoTask: (text: string) => `Memo: ${text}`,
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
  reportLine: (id: string, text: string) => `reported #${id}: ${text}`,
  verdictLine: (id: string, ok: boolean, note: string) => `${ok ? "accepted" : "sent back"} #${id}${note ? `: ${note}` : ""}`,
  toChairmanToast: (id: string, task: string) => `Job #${id} (${task}) was rejected too many times: it is yours to decide`,
  named: (who: string, name: string | undefined) => (name ? `${who} (SendMessage: ${name})` : who),
  roleCeo: [
    "## crab-office: you are the CEO",
    "The chairman (the user) has made you CEO of the office: every Claude Code session open on this machine works for you.",
    "When the chairman gives you work, do not do it yourself if another session is better placed: look with office_board staff, pick the session best suited, and give it the job with office_board assign (to, text, and standard: how you will judge it). If nobody fits, ask the chairman; never start new sessions.",
    "To learn about a repository, ask its head with SendMessage. Where there are many sessions, appoint a head for each repository with office_board appoint; with few, manage them yourself.",
    "When a report comes back, judge it against the standard you set; if unsure, assign a review to a session that has worked on something similar. Record your verdict with office_board accept or reject (assignment, text), then answer the chairman yourself, in this session, for all of it.",
    "When the chairman asks who is doing something, find it with office_board staff and answer, or pass it on.",
    "Never ask a session to do what your own session may not do.",
  ].join("\n"),
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
  ceoHandoverHead: "[crab-office · the chairman has made you CEO]\nThe sessions at work now:",
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
  nudgeTail: "Decide what to do: ask it, give the job to another session, ask its head, or tell the chairman.",
  approvalToast: (id: string, who: string, minutes: number) => `Job #${id}: ${who} has waited ${minutes} min for your approval`,
  ceoWaiting: "Reported and waiting for your verdict:",
  waitingLine: (id: string, task: string, who: string) => `- #${id} ${task} (from ${who})`,
  ceoHandoverTail: "Your instructions say what a CEO does; office_board staff gives this list again any time.",
  staffMore: (name: string | undefined, duty: string | undefined, jobs: string[]) =>
    `${name ? ` · SendMessage: ${name}` : ""}${duty ? ` · duty: ${duty}` : ""}${jobs.length > 0 ? ` · open: ${jobs.map((id) => `#${id}`).join(" ")}` : ""}`,
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
  commandHint: "[close|band|say [@team|@everyone] message|ceo [@who|off]|head [@who|off]]",
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
  call: "Call",
  uncalled: "· no @ and whoever is free takes it",
  // the office_board tool, which the model reads
  tool: {
    description:
      "The crab-office whiteboard. The other Claude Code sessions open on this machine are your colleagues, each working in its own project or worktree, and the board shows everyone what is said between them, SendMessage included. To ask or tell one session something, use SendMessage (ListAgents names them); it shows on this board too. Use this board to write to a whole department, to everyone, or to the chairman (the user), without interrupting anyone: action=post with `to` set to a department (project name) or \"everyone\", or with no `to` for the chairman, and they get it next time they read the board. action=read shows the board's latest lines and what was written to you: read it before you start and when you finish something. action=claim claims a memo from the chairman (its id is in the brackets at the memo's start), after which no other session takes it. When the chairman has appointed a CEO, the office also runs its work through here, each session told in its instructions which of these it may use: action=staff lists who is at work, their SendMessage names, duties and open jobs; action=assign gives a session a job (to, text, standard); action=report hands a job back (assignment, text); action=accept and action=reject judge a reported job (assignment, text); action=duty writes what a session is responsible for (to, text); action=appoint makes a session its repository's head (to).",
    memo: "the id of the memo to claim",
    text: "what to write: the post, the job (assign), the result (report), a note or reason (accept, reject), or the duty",
    assignment: "the job's id (report, accept, reject)",
    standard: "how the job will be judged (assign, optional)",
    to: 'who it is for: a department (project name) or "everyone" (post; left out, the chairman); a session by its SendMessage name or team (assign, duty, appoint)',
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
    actions: "action is read, post or claim. ListAgents lists the other sessions; SendMessage writes to one.",
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
  labels: { task: "任务", given: "收到", tools: "工具", back: "交回", job: "派活" },
  jobStatus: { assigned: "已派", reported: "待验收", rejected: "已退回", accepted: "已验收", chairman: "交董事长定" },
  orderHead: "[螃蟹办公室 · 董事长交代]",
  orderLabel: "➤ 交代 ",
  orderPlaceholder: "给它一个指示，它空下来就去做",
  orderQueued: "…等它空下来",
  orderDelivered: "✓ 送到了",
  send: "发",
  memoTask: (text) => `留言：${text}`,
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
  reportLine: (id, text) => `交差 #${id}：${text}`,
  verdictLine: (id, ok, note) => `${ok ? "验收通过" : "退回"} #${id}${note ? `：${note}` : ""}`,
  toChairmanToast: (id, task) => `#${id}（${task}）退回次数太多，交给你决定`,
  named: (who, name) => (name ? `${who}（SendMessage：${name}）` : who),
  roleCeo: [
    "## 螃蟹办公室：你是 CEO",
    "董事长（用户）任命你为公司的 CEO：这台机器上开着的 Claude Code 会话都归你管。",
    "董事长交给你的活，如果别的会话更合适，不要自己动手：先用 office_board staff 看人，挑最合适的会话，用 office_board assign 派过去（to、text，standard 写你会怎么验收）。没人合适就问董事长，不要自己新开会话。",
    "想了解某个 repo，用 SendMessage 问它的部长。会话多时用 office_board appoint 给每个 repo 任命部长；会话少时你自己直接管。",
    "收到交差后按你定的标准验收；拿不准就 assign 一个复核给做过类似部分的会话。用 office_board accept 或 reject（assignment、text）记下结论，然后在你自己的会话里统一回复董事长。",
    "董事长问某件事谁在做，用 office_board staff 查了回答，或者转过去。",
    "不要让别的会话去做你自己会话不被允许的事。",
  ].join("\n"),
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
  ceoHandoverHead: "[螃蟹办公室 · 董事长任命你为 CEO]\n现在在岗的会话：",
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
  nudgeTail: "决定怎么处理：去问它、改派给别的会话、问它的部长，或者告诉董事长。",
  approvalToast: (id, who, minutes) => `#${id}：${who} 等你批准已经 ${minutes} 分钟`,
  ceoWaiting: "已经交差、等你验收的：",
  waitingLine: (id, task, who) => `- #${id} ${task}（${who} 交的）`,
  ceoHandoverTail: "CEO 该做什么写在你的说明里；随时用 office_board staff 再看这张表。",
  staffMore: (name, duty, jobs) =>
    `${name ? ` · SendMessage：${name}` : ""}${duty ? ` · 职责：${duty}` : ""}${jobs.length > 0 ? ` · 在办：${jobs.map((id) => `#${id}`).join(" ")}` : ""}`,
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
  commandHint: "[close|band|say [@组名|@全体] 留言|ceo [@谁|off]|head [@谁|off]]",
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
  call: "点名",
  uncalled: "· 不点名就谁有空谁接",
  tool: {
    description:
      "螃蟹办公室的共享白板。这台机器上同时开着的其他 Claude Code 会话是你的同事，各在自己的项目或 worktree 里干活；他们之间说的话（包括 SendMessage）都会显示在白板上。单独找一个会话问事、告诉它事，用 SendMessage（ListAgents 能看到名字），白板上也看得到。这块白板用来写给整个部门、全体或董事长（用户），不打断任何人：action=post，to 写部门名（项目名）或「全体」，不写 to 就是写给董事长，他们下次看白板时收到。action=read 看白板最近的话和写给你的消息：开工前、做完一件事时看一下。action=claim 认领董事长的留言（memo id 在留言开头的方括号里），认领后别的会话就不会再接。董事长任命了 CEO 之后，公司的活也走这里，每个会话能用哪些动作，它的说明里会写：action=staff 看谁在岗、SendMessage 名、职责和在办的活；action=assign 派活（to、text、standard）；action=report 交差（assignment、text）；action=accept、action=reject 验收已交差的活（assignment、text）；action=duty 写某个会话负责什么（to、text）；action=appoint 任命某个会话为它所在 repo 的部长（to）。",
    memo: "要认领的 memo id",
    text: "要写的内容：白板上的话、派的活（assign）、结果（report）、验收意见或退回原因（accept、reject）、职责（duty）",
    assignment: "活的编号（report、accept、reject）",
    standard: "这件活怎么验收（assign，可不写）",
    to: "写给谁：部门名（项目名）或「全体」（post；不写就是董事长）；或用 SendMessage 名、组名指定一个会话（assign、duty、appoint）",
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
    actions: "action 只有 read、post、claim。ListAgents 列出别的会话，SendMessage 单独写给一个。",
  },
}

let words: Words = EN

export function setLanguage(lang: string | undefined) {
  words = lang === "zh" ? ZH : EN
}

export function w(): Words {
  return words
}

// Names that stand for the chairman, or for a checkout's own team, whichever
// language a session wrote them in.
export const CHAIRMAN_NAMES = new Set([EN.chairman, ZH.chairman])
export const HQ_NAMES = new Set([EN.hq.toLowerCase(), ZH.hq])
