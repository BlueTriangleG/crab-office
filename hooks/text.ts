import { clip } from "./office.ts"
import type { Detail, Talk } from "./office.ts"
import { titleOf } from "./pixels.ts"
import type { Company, SeatData } from "./pixels.ts"
import { w } from "./words.ts"

// The office as text, for a terminal where the pane will not open or a click
// will not land: `/office text`, `/office card @who`, and answering what waits
// on the chairman by command. Built from what the drawing is built from, so the
// two never say different things.

const BOARD_LINES = 10
// The pane cuts a task and a board line to its width; text has none, and a
// line of a few hundred characters buried the rest.
const TASK_MAX = 60
const LINE_MAX = 140

function seatLine(seat: SeatData, indent: string, sign: string | null | undefined): string {
  const mark = seat.asking ? "?" : seat.look === "approval" ? "!" : seat.letter ? "✉" : " "
  const name = seat.post ?? titleOf(seat.role)
  const status = w().status[seat.look] ?? seat.look
  return `${indent}${mark} ${name}${sign ? ` [${sign}]` : ""}  ${status}${seat.task ? ` · ${clip(seat.task, TASK_MAX)}` : ""}`
}

export function officeText(company: Company, waiting: { id: string; who: string; text: string }[]): string {
  const rooms = company.rooms.flatMap((room) => [
    w().textRoom(room.title),
    ...room.teams.flatMap((team, i) => {
      const [manager, ...crew] = team
      if (manager === undefined) return []
      return [seatLine(manager, "  ", room.signs?.[i]), ...crew.map((seat) => seatLine(seat, "      ", undefined))]
    }),
  ])
  const board = (company.board ?? []).slice(-BOARD_LINES)
  return [
    ...(company.header ? [company.header, ""] : []),
    ...rooms,
    "",
    w().chairmanList(waiting.length),
    ...waiting.map((d) => `  #${d.id} ${d.who}：${d.text}`),
    "",
    w().board,
    ...board.map((line) => `  ${line.time} ${line.from.name} → ${line.to.name}：${clip(line.text, LINE_MAX)}`),
  ].join("\n")
}

export function cardText(
  detail: Detail,
  talk: Talk[],
  orders: { text: string; isDelivered: boolean }[],
  asked: { question: string; answer?: string }[],
): string {
  return [
    `${detail.title} · ${detail.where} · ${detail.state}`,
    ...detail.rows.map((row) => `${row.label}：${row.text}`),
    ...(talk.length > 0 ? ["", ...talk.map((line) => `  ${line.role === "user" ? w().you : w().it}${line.text}`)] : []),
    ...(orders.length > 0 ? ["", ...orders.map((o) => `  ➤ ${o.text}  ${o.isDelivered ? w().orderDelivered : w().orderQueued}`)] : []),
    ...(asked.length > 0 ? ["", ...asked.map((a) => `  btw ${a.question} → ${a.answer ?? w().textWaiting}`)] : []),
  ].join("\n")
}
