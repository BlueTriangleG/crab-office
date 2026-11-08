import { w } from "./words.ts"

// herdr, the terminal the sessions may run in, as far as the office touches
// it: a session's tab, named by its job title; marked while the chairman has to
// come to it in person; and a job given to it done in a worktree of its own.
// Not its agent state: herdr takes a Claude pane's state from its screen, and
// refuses one reported by any source but its own Claude integration, whose
// reports it keeps to the session's identity (0.8.0 to 0.9.5 alike), so a tab
// label is what the chairman can see. Outside herdr none of this runs.
export type HerdrPlace = { tab: string }

export function herdrPlaceOf(env: { HERDR_ENV?: string; HERDR_TAB_ID?: string }): HerdrPlace | undefined {
  if (env.HERDR_ENV !== "1" || env.HERDR_TAB_ID === undefined || env.HERDR_TAB_ID === "") return undefined
  return { tab: env.HERDR_TAB_ID }
}

// `had`: the label the tab carried when the session started, kept while it has
// no job title.
export function tabLabelOf(title: string | undefined, isWaiting: boolean, had: string): string {
  const label = title ?? had
  return isWaiting ? w().herdrWaiting(label) : label
}

export function withWorktree(envelope: string, isInHerdr: boolean): string {
  return isInHerdr ? `${envelope}\n\n${w().herdrWorktree}` : envelope
}
