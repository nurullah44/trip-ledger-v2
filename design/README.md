# Design source — "Clay receipt"

This folder is the **source of truth** for Trip Ledger's visual design. The app's
`src/styles.css` maps these tokens onto the shadcn CSS variables, so every UI
component inherits the look.

## `clay/`

Vendored from the **OpenDesign** `clay` design system
([nexu-io/open-design](https://github.com/nexu-io/open-design), Apache-2.0),
`design-systems/clay/`. Files:

- `DESIGN.md` — visual intent, palette roles, typography, component recipes, do's/don'ts.
- `tokens.css` — the canonical token block (warm clay palette, radii, shadows). **The
  single source of colour truth** — don't hard-code hex in components; add tokens here
  (mirrored into `src/styles.css`) instead.
- `components.html` — reference component markup + CSS (panels, buttons, inputs, eyebrow, status).
- `USAGE.md` — the OpenDesign package contract.

### How it's applied

`src/styles.css` translates the clay tokens into shadcn's semantic variables
(`--primary` ← clay `--accent` `#b46a46`, `--card` ← `--surface`, success/danger
for balance semantics, etc.), adds Inter + Space Mono, and defines the `.clay-raised`,
`.eyebrow`, and `.figure` utilities. To evolve the theme, edit the tokens here and in
`src/styles.css` together.

## Attribution

The `clay/` files are © their respective OpenDesign authors, distributed under the
Apache License 2.0. They are included here as design reference for this project.
