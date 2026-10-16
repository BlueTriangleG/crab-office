// Every word the office shows or says, in English and in Chinese. The plugin's
// `language` option picks one: the hooks set it as they load, and the drawing,
// which runs in an environment of its own, sets it from the company it is
// handed. Stored data (who claimed a memo, a note's names) keeps the words it
// was written in.

const EN = {
  lang: "en",
  // the drawing
  titles: {
    chief: "Director",
    leader: "Head",
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
  header: (n: number) => `Crab Co.  Chairman: you  ${n} on duty`,
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
  labels: { task: "Task", given: "Given", tools: "Tools", back: "Back" },
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
  commandHint: "[close|band|say [@team|@everyone] message]",
  commandDescription: "Your sessions and their subagents as a pixel-art office",
  sayLabel: "✎ Write on the board ",
  sayPlaceholder: "e.g. @everyone get the tests in before you go",
  post: "post",
  call: "Call",
  uncalled: "· no @ and whoever is free takes it",
  // the office_board tool, which the model reads
  tool: {
    description:
      "The crab-office whiteboard. The other Claude Code sessions open on this machine are your colleagues, each working in its own project or worktree, and they all see the board. Use it before you start, when you finish something, and whenever your work touches another session's (you need it to help, to warn it off something, or to tell it you changed something it uses). action=read shows the board's latest lines and what colleagues wrote to you; action=post writes a line: with `to` set to a colleague's team (worktree name), department (project name) or \"everyone\" it is written to them, and they get it next time they read the board, without being interrupted; with no `to` it is written to the chairman (the user); action=colleagues lists who is at work on what and whom you can write to; action=claim claims a memo from the chairman (its id is in the brackets at the memo's start), after which no other session takes it.",
    memo: "the id of the memo to claim",
    text: "what to write on the board",
    to: 'who it is for: a colleague\'s team, department, or "everyone"; left out, the chairman',
    notReady: "The office isn't ready yet",
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
    canWriteTo: (names: string) => `You can write to: ${names}`,
  },
}

export type Words = typeof EN

const ZH: Words = {
  lang: "zh",
  titles: {
    chief: "大部长",
    leader: "部长",
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
  header: (n) => `螃蟹有限公司  董事长：你  在岗 ${n} 人`,
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
  labels: { task: "任务", given: "收到", tools: "工具", back: "交回" },
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
  commandHint: "[close|band|say [@组名|@全体] 留言]",
  commandDescription: "把你的会话和子代理画成一间像素办公室",
  sayLabel: "✎ 写在白板上 ",
  sayPlaceholder: "比如：@全体 下班前把测试补齐",
  post: "贴上",
  call: "点名",
  uncalled: "· 不点名就谁有空谁接",
  tool: {
    description:
      "螃蟹办公室的共享白板。这台机器上同时开着的其他 Claude Code 会话是你的同事，各在自己的项目或 worktree 里干活，白板他们都看得到。开工前、做完一件事、碰到和别的会话有关的事（要它配合、提醒它别动某处、告诉它你改了它会用到的东西）时用它。action=read 看白板最近的话和同事写给你的消息；action=post 写一句：to 写同事的组名（worktree 名）、部门名（项目名）或「全体」就是写给他们，他们下次看白板时收到，不会被打断；不写 to 就是写给董事长（用户）；action=colleagues 看同事都是谁、在干什么、能写给谁；action=claim 认领董事长的留言（memo id 在留言开头的方括号里），认领后别的会话就不会再接。",
    memo: "要认领的 memo id",
    text: "要写在白板上的话",
    to: "写给谁：同事的组名、部门名或「全体」；不写就是写给董事长",
    notReady: "办公室还没准备好",
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
    canWriteTo: (names) => `能写给：${names}`,
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
