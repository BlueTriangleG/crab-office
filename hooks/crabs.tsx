import type { ClientModule } from "claude-code"

import { SEAT_COLS, SEAT_ROWS, drawPart, runsOf } from "./pixels.ts"
import { setLanguage } from "./words.ts"
import type { Part } from "./pixels.ts"

// The drawing surface: the hooks hand it its share of the office, laid out, and
// it owns the animation tick and the clicks, so a frame never waits on a hook.

// `rows`, when the pane splits the office across several Clients: the band of
// the drawing this one shows, so no one tree runs past the serialized bound;
// `part` then holds only what is on those rows (partOf).
export type CrabsProps = { part: Part; selected: string | null; rows?: [number, number] }

type State = { t: number }

const TICK_MS = 250

const Crabs: ClientModule<CrabsProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const state: State = surface.state ?? { t: 0 }

  if (surface.state === undefined) {
    surface.setState(state)
    surface.post({ drawn: true })
    surface.every(TICK_MS, () =>
      surface.setState({ t: (surface.state ?? state).t + 1 }),
    )
  }

  // A reload can hand the new module the previous version's props for one
  // frame, before the hook draws again; the first live reload threw on that.
  const columns = surface.columns
  if (columns <= 0 || props.part === undefined)
    return <Text dimColor>…</Text>

  // The wall clock, not the instance's own count, so the bands of one office
  // move in step: a crab cut across two of them stays whole. The count stands
  // in where a surface has no clock to read.
  const t = typeof Date === "undefined" ? state.t : Math.floor(Date.now() / TICK_MS)
  setLanguage(props.part.lang)
  const started = typeof Date === "undefined" ? 0 : Date.now()
  const drawn = drawPart(props.part, columns, t, props.selected, props.rows)
  const [from, to] = props.rows ?? [0, drawn.rows]
  const lines = drawn.cells.slice(from, to).map((line) => runsOf(line))
  // How long a frame takes where it runs, reported now and then, since the
  // budget there is a second and a local run cannot say how near it comes.
  if (started > 0 && state.t % 40 === 0) surface.post({ ms: Date.now() - started })

  surface.onPointer((event) => {
    if (event.type !== "down") return
    const y = event.y + from
    const pager = drawn.pagers.find((p) => y === p.cy && event.x >= p.cx && event.x < p.cx + p.w)
    if (pager !== undefined) {
      surface.post({ board: pager.dir })
      return
    }
    // A desk names a crab; a line on the board names the crab who said it and
    // the line itself, which the pane then shows whole.
    const seat = drawn.seats.find(
      (s) => event.x >= s.cx && event.x < s.cx + SEAT_COLS && y >= s.cy && y < s.cy + SEAT_ROWS,
    )
    const line = seat === undefined ? drawn.lines.find((l) => y === l.cy || y === l.cy + 1) : undefined
    const id = seat?.id ?? line?.id
    surface.post({
      select: id === undefined || id === props.selected ? null : id,
      note: line?.key ?? null,
    })
  })

  return (
    <Box flexDirection="column">
      {lines.map((runs) => (
        <Box flexDirection="row">
          {runs.map((run) => (
            <Text color={run.fg} backgroundColor={run.bg} bold={run.bold}>
              {run.ch}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export default Crabs
