---
colors:
  canvas: "#161618"
  surface: "#1f1f22"
  surface-raised: "#242427"
  bubble-other: "#38383c"
  bubble-self: "#2a2a2e"
  hairline: "rgba(255,255,255,0.08)"
  hairline-strong: "rgba(255,255,255,0.16)"
  ink-primary: "#f4f4f5"
  ink-secondary: "#b8b8bf"
  ink-tertiary: "#8b8b92"
  accent-teal: "#22d3ee"
  status-lime: "#84cc16"
  avatar-violet: "#7c3aed"
  danger-red: "#ef4444"
typography:
  display:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "34px"
    fontWeight: 500
    letterSpacing: "-0.02em"
    lineHeight: 1.1
  title:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "32px"
    fontWeight: 500
    letterSpacing: "-0.01em"
    lineHeight: 1.2
  section-heading:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  card: "14px"
  row: "10px"
  control: "8px"
  pill: "9999px"
spacing:
  page: "24px 32px 110px 32px"
  content-column: "760px"
  row-gap: "12px"
  chip-gap: "8px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "#131315"
    rounded: "{rounded.pill}"
    padding: "7px 16px"
    typography: "{colors.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
    size: "border 1px {colors.hairline}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    size: "30x30"
    height: "border 1px {colors.hairline}"
  note-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.row}"
    padding: "10px 12px"
  transcript-bubble:
    backgroundColor: "{colors.bubble-other}"
    textColor: "{colors.ink-secondary}"
    rounded: "12px"
---

# Design System: Flow — Granola Notetaker

## Overview

Creative North Star: **"The quiet notebook."** The interface reproduces Granola's dark, near-black editorial world — a serif display voice over a sans body, chrome that recedes so the note itself is the product. Every surface is a muted charcoal layer on a #161618 canvas; color is rationed to one teal accent, two status signals, and the speaker palette inside the transcript.

Key Characteristics:
- Near-black canvas with two-step tonal surfaces; no pure black, no pure gray.
- Serif (EB Garamond) reserved exclusively for titles and headings; Figtree carries all UI text.
- Single accent (teal) for focus, selection, and "enhanced" states; everything else stays neutral.
- Pills for anything you click, soft cards for anything you read.

**The Receding Chrome Rule.** If an element draws the eye before the note content does, it is too loud. Buttons are transparent with hairline borders until hovered; only the one primary action per view gets a filled shape.

## Colors

The palette is a flat neutral ramp with three chromatic exceptions. Neutrals are warm-leaning near-blacks; text is an off-white ramp, never #fff in body copy.

- **Canvas / surface / raised** (#161618 → #1f1f22 → #242427): the only three background levels. Elevation is expressed by stepping up this ramp, not by shadows.
- **Hairlines** (rgba(255,255,255,0.08), strong 0.16): translucent white borders replace opaque grays so lines adapt over any surface step.
- **Ink ramp**: primary #f4f4f5, secondary #b8b8bf, tertiary #8b8b92. Tertiary carries metadata, timestamps, and gutter marks.
- **Accent teal** #22d3ee: focus rings, text selection (at 28% alpha), and the enhanced-summary chip (tinted 8%/14% fills, 25% border).
- **Status**: lime #84cc16 for confirmations, red #ef4444 for destructive, violet #7c3aed only as the avatar block fill.
- **Speaker palette**: six assigned hues (#e07a5f, #a3e635, #38bdf8, #f472b6, #bbf236, …) allocated by first-appearance order and cached per speaker; used nowhere else.

**The One Accent Rule.** Teal is the only interactive color. A second chromatic hue in chrome (not transcript) is a defect, not a variety.

**The Bubble Is Not a Surface Rule.** Transcript bubbles (#38383c others, #2a2a2e self) exist only in the transcript; they never become page backgrounds.

## Typography

Two families, a strict division of labor: EB Garamond (variable, loaded wght 100–900 with italics) is display-only; Figtree (variable) is everything else.

- **Page title** (display token): EB Garamond 34px / 500, -0.02em, line-height 1.1.
- **Note title** (title token): EB Garamond 32px / 500, -0.01em, line-height 1.2 — the editable heading of an open note.
- **Section heading** (inside notes): EB Garamond 21px / 600.
- **Body**: Figtree 15px, line-height 1.65, ink secondary.
- **Labels / metadata**: Figtree 12–13px, ink tertiary, tabular numerals via a `tnum` utility for every timestamp, duration, and attendee count.

**The Serif Is Silence Rule.** Serif type marks content a user reads; sans marks controls a user operates. A serif button label or a sans page title is out of world.

**The Tabular Numbers Rule.** Any number that changes (timers, dates, counts) uses font-variant-numeric: tabular-nums so the layout never jitters.

## Layout

One scrolling column, max-width 760px, centered in a page inset of 24px top / 32px sides / 110px bottom. The generous bottom inset clears the floating dock. Views enter with a 0.18s fade and 4px rise — the only page-level motion.

- **List rows**: flex, 12px gap, 10px 12px padding, 10px radius, hover steps one surface level.
- **Badges and pills**: flex with 8px gaps, wrapping allowed.
- **Note body gutter**: a reserved 30px left lane (52px for bullets) where markers (# and •) sit at left 2px and left 34px respectively.

**The Fixed Dock Rule.** The bottom dock is position:fixed at bottom 18px with pointer-events none on the container and auto on the pill itself — the page scrolls beneath it, never through it.

## Elevation & Depth

No drop shadows. Depth is tonal: canvas → surface → surface-raised, plus translucent hairlines. Hover almost always means "one step up the ramp," never "lift." The scroll layer under the fixed dock is hinted only by the 110px bottom padding.

**The Flat By Default Rule.** If it doesn't move or stack, it has no elevation. Shadow is not available as a decoration in this world.

## Shapes

Four radii only: cards 14px, list rows 10px, icon buttons/avatars 8px, pills 9999px. Anything clickable with text is a pill; anything that contains content is a card. No other radii appear.

## Components

- **Primary button**: ink-primary fill, #131315 text, 7px 16px, pill, weight 600. One per view ("New Note").
- **Ghost/invite button**: transparent, hairline border, 7px 14px, pill; hover paints surface-raised.
- **Icon button**: 30×30, 1px hairline, 8px radius; hover paints surface-raised.
- **Note row**: full-width flex — 32px violet avatar block (8px radius), title (13.5px, ellipsis), 12px tertiary meta line, optional customer pill on the right.
- **Customer pill**: 4px 10px, hairline border, surface-raised fill; lime check or tertiary × as the state glyph.
- **Badge chip**: 5px 12px, hairline border, surface fill, 12.5px secondary text. The enhanced variant swaps to the teal system (teal text, 25% teal border, 8% teal fill, 14% on hover).
- **Transcript bubble**: grouped per speaker; others on bubble-other, the current user ("Você") on bubble-self, with the speaker's palette color as the name/initial mark. Time dividers and a scroll-to-latest control live in the same drawer.
- **Selection & focus**: ::selection at 28% teal; :focus-visible is a 2px teal ring, 2px offset, 4px radius. Scrollbars are 6px transparent tracks with 12%-white thumbs.

**The Hover Is A Surface Rule.** Interactive hover feedback is a background step on the tonal ramp (or a text-color lift), never a border-color change, transform, or shadow.

## Do's and Don'ts

- Do keep every heading inside a note serif and every control sans.
- Do render time, date, and count text in tabular numerals.
- Do confine color to teal-in-chrome and the speaker palette-in-transcript.
- Don't introduce new radii; the set is 14 / 10 / 8 / pill, closed.
- Don't use shadows or gradients for elevation — step the surface ramp.
- Don't promote bubble colors or the violet avatar fill to general backgrounds.
- Don't fill more than one button per view; the rest stay ghost or icon-only.
