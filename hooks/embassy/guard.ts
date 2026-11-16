// What the ambassador's session may use. Words from another company reach it,
// and a colleague's Claude can pass on words someone else planted, so it gets a
// list of what it may do rather than a list of what it may not: anything the
// list does not name, from a tool added next month to an MCP server's, is out.

export const AMBASSADOR_TOOLS: ReadonlySet<string> = new Set([
  "Read",
  "Grep",
  "Glob",
  "SendMessage",
  // SendMessage is a deferred tool, loaded through ToolSearch.
  "ToolSearch",
  // A subagent it starts is held to this same list.
  "Agent",
  "TodoWrite",
  "mcp__crab-office__office_board",
])

// Asking and answering, and seeing who is at work to ask; never handing out
// work or running the office.
// No settle: what it asked the chairman comes off the list by the chairman's
// answer or the CEO, so "decided" is something the code can see, whatever an
// outside message claims.
export const AMBASSADOR_BOARD: ReadonlySet<string> = new Set(["read", "post", "ask", "confirm", "staff"])
// Its own title and duty, which every session is asked to write; never another's.
const OWN_ONLY: ReadonlySet<string> = new Set(["title", "duty"])

const BOARD = "mcp__crab-office__office_board"

export type Refusal = "tool" | "board" | "path"

// What it may not read even with Read: the keys of its own pairings, and the
// usual homes of the machine's credentials. Grep across a repository can still
// meet a key in a file named otherwise; secretsIn stops it on the way out.
function fencedDirs(embassyDir: string, home: string): string[] {
  return [embassyDir, `${home}/.ssh`, `${home}/.aws`, `${home}/.config/gh`, `${home}/Library/Keychains`, `${home}/.netrc`, `${home}/.claude/.credentials.json`]
}

// A search names its files by pattern: one aimed at keys is refused wherever it looks.
const KEY_NAMES = /\.env|\.pem\b|\.key\b|id_(rsa|ed25519|ecdsa)|credentials/i

function isFenced(path: string, embassyDir: string, home: string): boolean {
  const p = path.replace(/\/+$/, "")
  const under = (dir: string) => p === dir || p.startsWith(`${dir}/`)
  const name = p.slice(p.lastIndexOf("/") + 1)
  return (
    under(embassyDir) ||
    under(`${home}/.ssh`) ||
    under(`${home}/.aws`) ||
    under(`${home}/.config/gh`) ||
    under(`${home}/Library/Keychains`) ||
    p === `${home}/.netrc` ||
    p === `${home}/.claude/.credentials.json` ||
    name === ".env" ||
    name.startsWith(".env.") ||
    name.endsWith(".pem") ||
    name.endsWith(".key")
  )
}

export function refusalOf(tool: string, input: Record<string, unknown>, embassyDir: string, home: string): Refusal | undefined {
  if (!AMBASSADOR_TOOLS.has(tool)) return "tool"
  // An isolated subagent runs outside this session, and outside this list.
  if (tool === "Agent") return typeof input.isolation === "string" && input.isolation !== "" ? "tool" : undefined
  if (tool === BOARD) {
    const action = typeof input.action === "string" ? input.action : ""
    if (OWN_ONLY.has(action)) return typeof input.to === "string" && input.to.trim() !== "" ? "board" : undefined
    return action !== "" && !AMBASSADOR_BOARD.has(action) ? "board" : undefined
  }
  if (tool === "Read") return typeof input.file_path === "string" && isFenced(input.file_path, embassyDir, home) ? "path" : undefined
  if (tool !== "Grep" && tool !== "Glob") return undefined
  // A search reads everything under its folder: one over a folder that holds
  // keys reads them too.
  const path = typeof input.path === "string" ? input.path.replace(/\/+$/, "") : undefined
  const holds = path !== undefined && fencedDirs(embassyDir, home).some((dir) => dir.startsWith(`${path}/`))
  const aimed = [tool === "Grep" ? input.glob : input.pattern].some((g) => typeof g === "string" && KEY_NAMES.test(g))
  return (path !== undefined && isFenced(path, embassyDir, home)) || holds || aimed ? "path" : undefined
}

const SECRETS: [string, RegExp][] = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Anthropic key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["API key", /sk-[A-Za-z0-9]{32,}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,}/],
  ["Slack token", /xox[abprs]-[A-Za-z0-9-]{10,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Stripe key", /[sr]k_live_[0-9a-zA-Z]{20,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["JWT", /eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/],
  ["password or token", /(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S{8,}/i],
  ["password in a connection string", /[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/i],
]

export function secretsIn(text: string): string[] {
  return SECRETS.filter(([, re]) => re.test(text)).map(([name]) => name)
}
