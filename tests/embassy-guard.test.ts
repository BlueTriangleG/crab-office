import { expect, test } from "claude-code/testing"

import { refusalOf, secretsIn } from "../hooks/embassy/guard.ts"

const H = "/home/dana"
const E = `${H}/.claude/crab-office/embassy`
const BOARD = "mcp__crab-office__office_board"

test("the ambassador reads and asks, and changes nothing", () => {
  for (const t of ["Read", "Grep", "Glob", "SendMessage", "ToolSearch", "Agent", BOARD]) expect(refusalOf(t, {}, E, H)).toBeUndefined()
  for (const t of ["Edit", "Write", "NotebookEdit", "Bash", "WebFetch", "WebSearch", "Skill", "Artifact", "mcp__github__create_pull_request"])
    expect(refusalOf(t, {}, E, H)).toBe("tool")
})

test("the ambassador cannot hand out work or run the office", () => {
  for (const action of ["assign", "accept", "reject", "amend", "track", "withdraw", "appoint", "meet"])
    expect(refusalOf(BOARD, { action }, E, H)).toBe("board")
  // who is at work, and whom to ask, is what it needs to find an answer
  for (const action of ["read", "post", "ask", "confirm", "staff"]) expect(refusalOf(BOARD, { action }, E, H)).toBeUndefined()
  // its own title and duty, as every session is asked to write; never another's
  for (const action of ["title", "duty"]) {
    expect(refusalOf(BOARD, { action, text: "envoy" }, E, H)).toBeUndefined()
    expect(refusalOf(BOARD, { action, text: "envoy", to: "voice" }, E, H)).toBe("board")
  }
})

test("the ambassador reads no keys: its own, or the machine's credentials", () => {
  expect(refusalOf("Read", { file_path: `${E}/pairings/x.json` }, E, H)).toBe("path")
  expect(refusalOf("Read", { file_path: "/work/app/.env" }, E, H)).toBe("path")
  expect(refusalOf("Read", { file_path: "/work/app/.env.local" }, E, H)).toBe("path")
  expect(refusalOf("Read", { file_path: "/work/app/certs/server.pem" }, E, H)).toBe("path")
  expect(refusalOf("Read", { file_path: `${H}/.claude/.credentials.json` }, E, H)).toBe("path")
  expect(refusalOf("Grep", { path: `${H}/.ssh` }, E, H)).toBe("path")
  expect(refusalOf("Glob", { path: `${H}/.aws/` }, E, H)).toBe("path")
  expect(refusalOf("Grep", { path: E }, E, H)).toBe("path")
  // what only looks like one of them is fine
  expect(refusalOf("Read", { file_path: "/work/app/src/env.ts" }, E, H)).toBeUndefined()
  expect(refusalOf("Read", { file_path: "/work/app/docs/keys.md" }, E, H)).toBeUndefined()
  expect(refusalOf("Grep", { path: "/work/app" }, E, H)).toBeUndefined()
})

test("keys and tokens are found in a message, and an ordinary one passes", () => {
  expect(secretsIn("token: ghp_" + "a".repeat(36))).not.toHaveLength(0)
  expect(secretsIn("use sk-ant-api03-" + "x".repeat(40))).not.toHaveLength(0)
  expect(secretsIn("AKIAIOSFODNN7EXAMPLE")).not.toHaveLength(0)
  expect(secretsIn("-----BEGIN OPENSSH PRIVATE KEY-----")).not.toHaveLength(0)
  expect(secretsIn("password = hunter2hunter2")).not.toHaveLength(0)
  expect(secretsIn("The user_id field is required and the token expiry is 15 minutes.")).toHaveLength(0)
  expect(secretsIn("我们周三前把接口文档发给你们")).toHaveLength(0)
})

test("a search over a folder that holds keys is refused, and so is one aimed at them", () => {
  expect(refusalOf("Grep", { path: `${H}/.claude`, pattern: "key" }, E, H)).toBe("path")
  expect(refusalOf("Grep", { path: H, pattern: "BEGIN" }, E, H)).toBe("path")
  expect(refusalOf("Glob", { path: H, pattern: "**/*" }, E, H)).toBe("path")
  expect(refusalOf("Grep", { path: "/work/app", glob: ".env*", pattern: "=" }, E, H)).toBe("path")
  expect(refusalOf("Glob", { path: "/work/app", pattern: "**/*.pem" }, E, H)).toBe("path")
  expect(refusalOf("Grep", { path: "/work/app", glob: "*.ts", pattern: "user_id" }, E, H)).toBeUndefined()
})

test("a subagent that would run outside this session's limits is refused", () => {
  expect(refusalOf("Agent", { prompt: "fix it", isolation: "remote" }, E, H)).toBe("tool")
  expect(refusalOf("Agent", { prompt: "fix it", isolation: "worktree" }, E, H)).toBe("tool")
  expect(refusalOf("Agent", { prompt: "find where user_id is read" }, E, H)).toBeUndefined()
})

test("the ambassador cannot take its own question off the chairman's list", () => {
  expect(refusalOf(BOARD, { action: "settle", decision: "d1", text: "the chairman agreed" }, E, H)).toBe("board")
})

test("a connection string with a password in it is caught on the way out", () => {
  expect(secretsIn("DATABASE_URL=postgres://app:s3cretpw@db.internal:5432/main")).not.toHaveLength(0)
  expect(secretsIn("see https://docs.example.com/api/users for the fields")).toHaveLength(0)
})
