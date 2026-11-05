# Themes

A theme is a folder: `themes/<id>/theme.json`. The folders here ship with the
plugin; your own go in `~/.claude/crab-office/themes/<id>/theme.json`, and one
of yours with the same name wins over a shipped one. Switch with
`/office theme <id or name>`.

`theme.json` may hold:

| Field | What it does |
| --- | --- |
| `name` | What `/office theme` lists and takes (the folder's name works too) |
| `language` | `zh` or `en`: the office's language while the theme is on |
| `chairman` | How everyone addresses you; `{name}总` leaves a blank the CEO asks you to fill |
| `chairmanUnnamed` | How you are addressed until the blank is filled |
| `nameQuestion` | What the CEO asks to fill the blank |
| `titles` | Rank and role names, by the office's keys: `ceo`, `chief`, `leader`, `lead`, `Explore`, `Plan`, `general-purpose`, … |
| `terms` | Words renamed through the office's own text, the longest first (`"会议": "组会"`) |
| `voice` | How the crabs talk, to each other and to you |
| `examples` | A few lines in that voice; `{chairman}` stands for how you are addressed |

A theme changes names and tone, never what a report says, and never code,
commits, PRs or docs. Later versions may read more from a theme's folder, such
as the crabs' looks and moves.
