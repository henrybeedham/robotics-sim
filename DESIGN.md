# Drape design notes

**What it is.** A browser simulation of a robotic composite layup cell. A rail-mounted
six-axis arm uses a conformal vacuum gripper to drape carbon plies onto a curved mould.
**Who looks at it.** Engineers and hiring managers at automation companies, on a laptop, for
a few minutes. **Feeling.** A working process sheet pinned beside a machine: exact, calm,
legible at a glance. **Reference.** Engineering drawings and the printed traveller sheets
that go round a composites shop with each part.

## Decisions

- **Type.** Bricolage Grotesque for the voice (wordmark, phase name, section titles).
  IBM Plex Sans for reading. IBM Plex Mono for every figure and every small uppercase label
  (`label` and `figures` utilities in `layout.css`).
- **Palette.** Light mode is warm drafting paper (`oklch(0.972 0.008 85)`) with near-black
  ink. Dark mode is a graphite shop floor, designed separately rather than inverted. There
  is one accent, signal amber, which marks the robot, live state and the primary action.
  Destructive red is only for failed plies.
- **Shape.** Radius 0 everywhere. Hairline borders group things; there are no cards and no
  shadows, except shadows inside the 3D scene.
- **Layout.** On desktop the 3D cell is the hero (left, full height) and a dense,
  scrollable process sheet sits on the right. On phones they stack. Below the fold the
  write-up and results table are left aligned on a two-column grid.
- **Data.** Tables for lists, tabular numerals, units in muted ink after each value.
  Inspection bars are single-ink, and failures are marked with red plus a ×, never colour
  alone.
- **Motion.** The robot does the moving. UI transitions are 150 ms colour changes only, and
  `prefers-reduced-motion` turns them off.
- **Copy.** British English, plain sentences, no exclamation marks, no emoji.

## 3D scene

Modelled Z-up in metres to match the kinematics, then turned Y-up by one group in
`Scene.svelte`. Materials are shared single instances in `scene/materials.ts`. The robot
is painted amber, fixtures are steel and graphite, and plies use one tileable tow texture
whose UVs are rotated to each ply's fibre angle.
