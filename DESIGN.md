---
name: PumpOff
description: A warm, thumb-first coach app where the one bright colour is always something you can press.
colors:
  cream-ground: "#f5f0e8"
  card-white: "#ffffff"
  oat-fill: "#ede5da"
  oat-fill-strong: "#ddd2c4"
  warm-hairline: "#e3d9cc"
  espresso-ink: "#2a2420"
  walnut-ink-2: "#665b52"
  ok-green: "#2f7a3e"
  warn-amber: "#8a5a00"
  hud-glass: "rgba(255, 255, 255, 0.94)"
  stage-dark: "#2c2622"
  dark-ground: "#181512"
  dark-card: "#221e1a"
  dark-fill: "#2e2924"
  dark-fill-strong: "#443d36"
  dark-hairline: "#3a332d"
  dark-ink: "#f3ede5"
  dark-ink-2: "#b5aa9d"
  dark-ok-green: "#7cc98a"
  dark-warn-amber: "#f0a24b"
  dark-hud-glass: "rgba(34, 30, 26, 0.94)"
  dark-stage: "#0f0d0b"
  contrast-ground: "#000000"
  contrast-fill: "#1c1c1c"
  contrast-fill-strong: "#5c5c5c"
  contrast-line: "#ffffff"
  contrast-ink: "#ffffff"
  contrast-ink-2: "#ebebeb"
  contrast-ok-green: "#8ef5a0"
  contrast-warn-amber: "#ffc46b"
  act-tomato: "#c2421b"
  act-teal: "#0f766e"
  act-blue: "#2156c9"
  act-berry: "#b0306a"
  dark-act-tomato: "#f2845e"
  dark-act-teal: "#45c7b8"
  dark-act-blue: "#86aefc"
  dark-act-berry: "#f28ab5"
  contrast-act-tomato: "#ff9a76"
  contrast-act-teal: "#5eead4"
  contrast-act-blue: "#a5c4ff"
  contrast-act-berry: "#ffa3c9"
  on-act-light: "#ffffff"
  dark-on-act-tomato: "#1f0d05"
  dark-on-act-teal: "#04201d"
  dark-on-act-blue: "#0a1630"
  dark-on-act-berry: "#2a0716"
  contrast-on-act: "#000000"
typography:
  hud-count:
    fontFamily: "Gabarito Variable, Gabarito, sans-serif"
    fontSize: "clamp(5rem, 26vw, 8rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
  hud-count-focus:
    fontFamily: "Gabarito Variable, Gabarito, sans-serif"
    fontSize: "clamp(6rem, 34vw, 10rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
  countdown:
    fontFamily: "Gabarito Variable, Gabarito, sans-serif"
    fontSize: "clamp(8rem, 45vw, 15rem)"
    fontWeight: 900
    lineHeight: 1
  stat:
    fontFamily: "Gabarito Variable, Gabarito, sans-serif"
    fontSize: "clamp(2.2rem, 9vw, 3rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Gabarito Variable, Gabarito, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 800
    lineHeight: 1.05
  headline:
    fontFamily: "Gabarito Variable, Gabarito, sans-serif"
    fontSize: "clamp(1.9rem, 6vw, 2.4rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  brand:
    fontFamily: "Gabarito Variable, Gabarito, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 900
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Gabarito Variable, Gabarito, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 800
    lineHeight: 1.2
  coach-line:
    fontFamily: "Figtree Variable, Figtree, sans-serif"
    fontSize: "clamp(1.05rem, 4.6vw, 1.35rem)"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Figtree Variable, Figtree, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  button:
    fontFamily: "Figtree Variable, Figtree, sans-serif"
    fontSize: "1rem"
    fontWeight: 650
  meta:
    fontFamily: "Figtree Variable, Figtree, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Figtree Variable, Figtree, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
rounded:
  sm: "12px"
  md: "16px"
  lg: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.act-tomato}"
    textColor: "{colors.on-act-light}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    height: "48px"
  button-primary-disabled:
    backgroundColor: "{colors.oat-fill-strong}"
    textColor: "{colors.espresso-ink}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.espresso-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.warn-amber}"
    rounded: "{rounded.md}"
    height: "48px"
  icon-button:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.pill}"
    width: "44px"
    height: "44px"
  chip:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.espresso-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.espresso-ink}"
    textColor: "{colors.cream-ground}"
    rounded: "{rounded.pill}"
  tag:
    backgroundColor: "{colors.oat-fill}"
    textColor: "{colors.espresso-ink}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  panel:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    padding: "18px"
  option:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "44px"
  option-selected:
    backgroundColor: "{colors.oat-fill}"
    textColor: "{colors.espresso-ink}"
  tab-bar:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.walnut-ink-2}"
    typography: "{typography.label}"
    height: "68px"
  tab-active:
    textColor: "{colors.act-tomato}"
  camera-stage:
    backgroundColor: "{colors.stage-dark}"
    rounded: "{rounded.lg}"
  hud-pill:
    backgroundColor: "{colors.hud-glass}"
    textColor: "{colors.espresso-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  hud-message:
    backgroundColor: "{colors.hud-glass}"
    textColor: "{colors.espresso-ink}"
    typography: "{typography.coach-line}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

# Design System: PumpOff

## Overview

**Creative North Star: "The Kitchen-Table Coach"**

PumpOff looks like a friendly training notebook left open on a warm table: cream paper, white cards edged with a thin warm hairline, chunky rounded numerals, and exactly one bright colour that always means "press here". It refuses the dark-ground, neon-accent gym-app default and the grey-tiles dashboard. The mood is warm, plain and direct, like the coach's voice in PRODUCT.md.

Density follows distance. On the Workout screen the camera card owns most of the phone and the count sits in a huge pill readable from 2 m; History and Progress are read up close, so they tighten into panels of tabular figures. Depth comes from tone and hairlines, never shadows. Three themes (light, dark, high contrast) share one warm neutral ramp structure, and the person picks one of four action colours (tomato by default, teal, blue, berry) that is re-tuned per theme for contrast.

Everything is thumb-first: 44–56 px targets, a bottom tab bar on phones, and one action-coloured button per moment. Motion is short, eased out, and only acknowledges a state change.

**Key Characteristics:**
- Warm single-tint neutral ramp per theme; no cool greys.
- One user-picked action colour on pressable things; state colours (ok green, warn amber) kept separate.
- Gabarito for headings and big numerals, Figtree for everything else, tabular numbers everywhere.
- Flat surfaces separated by 1 px warm hairlines (2 px in high contrast); no drop shadows.
- Generous, soft radii (12 / 16 / 22 px) and full pills for chips, tabs and HUD.
- Lucide line icons at one stroke weight (2, 2.4 for the active tab).

## Colors

A warm cream-to-espresso neutral ramp carries the page; a single action colour, chosen by the person, marks what can be pressed.

### Primary
- **Action colour** (`act-tomato` default; `act-teal`, `act-blue`, `act-berry` alternates): fills the primary button, colours the active phone tab and the active desktop tab icon, the focus ring, text selection, caret, native control accent, and the underline on text links. Each accent has a lighter dark-theme value with a dark ink on it (`dark-on-act-*`) and a still-lighter high-contrast value with black on it. The swatch in the Appearance menu shows the current theme's value.

### Neutral
- **Cream Ground** (`cream-ground`): the page and top bar background in light theme.
- **Card White** (`card-white`): panels, secondary buttons, the phone tab bar, the appearance panel.
- **Oat Fill / Oat Fill Strong** (`oat-fill`, `oat-fill-strong`): selected option backgrounds, tags, the offline banner; the strong step is the hover border, idle tracking dot, past chart bars, scrollbar thumb and the disabled primary fill.
- **Warm Hairline** (`warm-hairline`): every border and divider (stat columns, best cards, table rows).
- **Espresso Ink** (`espresso-ink`): primary text, the selected exercise chip fill, the current-week chart bar, and the tooltip ground.
- **Walnut Ink 2** (`walnut-ink-2`): secondary text, labels under figures, idle tab labels, chart axes.
- **HUD Glass** (`hud-glass`): near-opaque card colour for the count, pills and coach message over the camera feed.
- **Stage Dark** (`stage-dark`): the camera card behind the video. Text on the empty stage is fixed light cream because the stage is dark in every theme.
- Dark theme mirrors each role on a deep brown-black (`dark-*`); high contrast uses pure black ground, white 2 px lines and white ink (`contrast-*`).

### State
- **Ok Green** (`ok-green`) and **Warn Amber** (`warn-amber`), with dark and contrast variants: tracking-ready dot, counted/ok coach icon, rejection and error text, the danger button. Never used as the action colour, and the action colour is never used for state.

### Named Rules
**The Press-Here Rule.** The action colour appears only on things you can press or are pressing (primary button, active tab, focus ring, link underline, selection). It is never a heading colour, chart colour or decoration.

**The One Bright Button Rule.** Each moment has at most one action-coloured button; every other button is card-white with a hairline border.

**The Separate State Rule.** Ok and warn are their own colours. A counted rep is green, a rejected rep is amber; neither borrows the accent.

**The Ink Selection Rule.** Selected choices that are not an action (the active exercise chip, a checked appearance option) are marked in ink, not accent: chips fill with espresso ink, options get an ink border plus oat fill.

## Typography

**Display Font:** Gabarito Variable (with Gabarito, sans-serif)
**Body Font:** Figtree Variable (with Figtree, sans-serif)

**Character:** Gabarito is round, heavy and friendly, built for numbers you read from across a room; Figtree is a clean, warm geometric text face that keeps coaching lines and labels plain. Both are free and self-hosted through Fontsource.

### Hierarchy
- **HUD count** (900, clamp(5rem, 26vw, 8rem), 1, -0.03em): the live rep count in the camera card. Grows to clamp(6rem, 34vw, 10rem) in focus mode (camera running).
- **Countdown** (900, clamp(8rem, 45vw, 15rem), 1): the 3-2-1 before a timed set, white, centred over a 38% black scrim on the camera card. The largest thing in the product, shown for three seconds.
- **Stat** (900, clamp(2.2rem, 9vw, 3rem), 1, -0.02em): streak, weekly total and clean-rate on Progress.
- **Figure** (800, 2.4rem / 1.9rem, 1.05): set results and history totals; 2rem for the HUD timer, 1.45rem for personal bests.
- **Headline** (800, clamp(1.9rem, 6vw, 2.4rem), 1.05, -0.02em): screen titles (h1), balanced wrapping.
- **Title** (800, 1.2rem, 1.2): panel headings (h2); h3 at 1.05rem.
- **Coach line** (Figtree 700, clamp(1.05rem, 4.6vw, 1.35rem), 1.25): the coach message on the camera card.
- **Body** (Figtree 400, 1rem, 1.45): running text; intro copy capped at 65ch.
- **Button** (Figtree 650, 1rem): all buttons; primary steps up to 750.
- **Meta** (Figtree 400, 0.875rem): secondary notes in ink-2.
- **Label** (Figtree 600, 0.8–0.9rem): tab labels, pills, tags, figure captions under numbers. Sentence case, no tracking.

### Named Rules
**The Tabular Rule.** `font-variant-numeric: tabular-nums` is set on the root and on chart axes; every number lines up and can be compared.

**The Caption-Below Rule.** Figures lead and their label sits beneath in smaller ink-2 text (the markup keeps dt before dd; layout reverses the order).

**The Sentence-Case Rule.** No uppercase labels and no wide tracking anywhere; letter-spacing is only ever negative, on Gabarito display sizes.

## Layout

Phone first at 375 px. Content sits in a single column with 16 px side padding, 20 px top and 16 px gaps between panels; from 760 px the page widens to 24 px padding and 20 px gaps, capped at 1120 px and centred. Spacing steps are 4 / 8 / 12 / 16 / 24 px, with 18 px panel padding.

- **Below 760 px:** a fixed bottom tab bar (68 px plus safe-area) holds Workout, History, Progress with icon over label. Exercise chips become one horizontally scrolling row bleeding to the screen edge; the camera card takes the remaining height (clamp(300px, 100dvh − 350px, 560px)) so the Save button stays above the tab bar.
- **760 px and up:** tabs move into the sticky top bar as pill buttons; controls sit in a three-column grid with the primary spanning two; history becomes an auto-fill grid of 320 px cards; Progress becomes two columns.
- **Focus mode (camera running, all widths):** the Workout title and exercise chips fold away behind a bar with the exercise name and a "Change exercise" link; on phones the camera card grows to clamp(320px, 100dvh − 296px, 680px), still keeping Save set above the tab bar.
- **1040 px and up:** Workout splits into camera (1.7fr) and a sticky side column (min 300px); Progress puts chart and mistakes left, bests right.
- Safe-area insets are respected top and bottom; the stage aspect ratio steps 4:5 → 4:3 → 16:10 with width.

## Elevation & Depth

Flat. Surfaces never cast shadows; depth is tonal (cream ground, white card, oat fill) and every container is outlined by a 1 px warm hairline (2 px in high contrast, through the border-width token). Over the camera feed the HUD uses near-opaque card-coloured glass (94%) with the same hairline, not blur or shadow. The only `box-shadow` in the system is an inset ring that thickens a selection border: 1 px ink on a checked option, and a hairline ring on the active desktop tab.

### Named Rules
**The Hairline Rule.** Separate with a 1 px warm line or a tone step, never a drop shadow.

## Shapes

Soft and friendly. Three radii: 12 px for small options, 16 px for buttons, the appearance panel and the coach message, 22 px for panels and the camera card. Rep ticks are the one exception: 5 px bars with 2 px (counted, 16 px tall, ink) or 1 px (not counted, 8 px tall, dashed warn) corners, so the two read apart by shape, not colour. A set that holds a personal best gets an ink-filled pill tag with a Lucide trophy (the action colour stays reserved for buttons). Chips, tabs on desktop, tags, HUD pills, icon buttons, swatches and dots are full pills. Borders are always the same width token and the same warm line colour, so shape reads by radius, not by stroke weight.

## Components

### Buttons
Tactile and plain: tall, rounded, with a slight press-in.
- **Shape:** gently rounded (16 px), minimum 48 px tall, 10 px × 18 px padding, 8 px icon gap.
- **Primary:** action colour fill and border, on-act text at weight 750. In the Workout controls it spans the full row on phones (56 px tall) or two of three columns on wide screens (52 px).
- **Hover / Active:** secondary hover shifts the border to oat-fill-strong; primary hover brightens 6%; every enabled button scales to 0.97 on press (120 ms). Focus is a 3 px action-colour outline at 2 px offset.
- **Secondary:** card-white with a hairline border and ink text.
- **Danger:** card-white, warn-amber text and border.
- **Disabled:** 45% opacity; a disabled primary drops to oat-fill-strong with ink text so it no longer looks pressable.
- **Link:** borderless text button (40 px min height); standalone text links are ink with an action-colour underline at 3 px offset.
- **Icon button:** 44 px circle, used for the appearance (palette) control.

### Chips
- **Style:** pill, card-white, hairline border, 44 px tall, 8 px × 16 px padding, 0.95rem weight 600. Chart range chips are 40 px.
- **State:** the active chip fills with espresso ink and cream text, and stays fully opaque while the set is running.

### Cards / Containers
- **Corner Style:** 22 px.
- **Background:** card-white; a quiet variant is transparent with only the hairline.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** hairline token.
- **Internal Padding:** 18 px, 12 px internal gap; headers baseline-align title and tag.
- Expandable panels use a 44 px summary row with a chevron that rotates 180° on open.

### Inputs / Fields
- **Style:** choices are radio inputs wrapped in labelled option tiles: 12 px radius, hairline border, 44 px tall, two per row.
- **Focus:** the tile takes the 3 px action-colour outline when its hidden input is keyboard-focused.
- **Selected:** ink border plus a 1 px inset ink ring and oat fill.

### Navigation
- **Phone:** fixed bottom bar, card-white with a top hairline, three equal columns, 24 px Lucide icon over a 0.8rem label in ink-2; the active tab turns action colour, weight 700, icon stroke 2.4.
- **Wide:** tabs join the sticky top bar after the Gabarito 900 wordmark as 44 px pills; the active tab becomes a card-white pill with a hairline ring, ink text and an action-colour icon.
- The appearance menu opens from the header as a 300 px card panel (16 px radius) that fades and drops 4 px in.

### Camera Stage (signature)
The rounded dark camera card that owns the Workout screen.
- **Count:** a big card-glass block top-left with the Gabarito 900 count and an ink-2 caption; each new number pops in from 88% scale (260 ms).
- **Tracking pill:** top-right pill with a 10 px dot that turns ok green when the body is tracked.
- **Timer pill:** Gabarito 800 2rem in a pill for timed sets and plank holds.
- **Coach message:** a full-width glass card along the bottom edge with a 26 px state-coloured icon (ok, warn, or ink-2 for info) and the coach line; it slides up 6 px on change.

### Weekly Chart
SVG bars in oat-fill-strong with the current week in espresso ink, hairline gridlines, ink-2 tabular axis labels, an ink tooltip with cream text (10 px radius), and an accessible table beneath with right-aligned numbers.

## Do's and Don'ts

### Do:
- **Do** keep the action colour on pressable things only, one action-coloured button per moment.
- **Do** take every surface colour from the theme tokens so light, dark and high contrast all work; check new UI in all three and with all four accents.
- **Do** set big live numbers in Gabarito 800–900 on a near-opaque glass card over the camera feed, readable from 2 m.
- **Do** use Lucide line icons at stroke 2 (24 px in tabs, 20 px inline).
- **Do** keep touch targets at least 44 px (48 px for buttons).
- **Do** animate only state changes with the shared ease-out curve (cubic-bezier(0.16, 1, 0.3, 1)) in 120–260 ms, and drop all motion under reduced-motion.
- **Do** write labels and headings in sentence case.

### Don't:
- **Don't** use Inter, Roboto, Arial or default system stacks; the pairing is Gabarito plus Figtree.
- **Don't** use purple-to-indigo gradients, cool greys, or more than one accent on a screen.
- **Don't** add drop shadows, shadow-heavy cards, glows, blobs or glowing orbs.
- **Don't** use emoji as icons, or mix icon sets and stroke weights.
- **Don't** add wide-tracked ALL-CAPS micro-labels.
- **Don't** use `transition-all` or bouncy, looping animation.
- **Don't** build the generic hero → 3 cards → testimonials layout or a grey-tile dashboard.
- **Don't** colour state (counted, rejected, error) with the action colour, or decorate with it.
