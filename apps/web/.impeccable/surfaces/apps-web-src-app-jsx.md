---
version: 1
slug: "apps-web-src-app-jsx"
primary_target: "apps/web/src/App.jsx"
related_targets: ["apps/web/src/RepCounterScreen.jsx","apps/web/src/HistoryScreen.jsx","apps/web/src/ProgressScreen.jsx"]
---

# Web app shell (Workout, History, Progress)

Scope: the whole web app in `apps/web`. Visitor mode: Operate. Phone first (375 px), desktop secondary.

Job: count a set from 2 m away, save it, then read history and progress up close.

## Direction contract

THESIS: A friendly, thumb-first training app where the one bright colour is always something you can press. Refuses the dark-ground, neon-accent gym-app default and the grey-tiles dashboard.

OWN-WORLD: Warm tinted neutral ramp (cream ground, white cards with 1 px warm hairlines, no shadows), dark and high-contrast variants of the same ramp. Gabarito for headings and big numerals, Figtree for text, tabular numbers. One action colour (tomato by default, user-pickable) on buttons, active tab and selected chip only. State colours (ok green, warn amber) are separate from the action colour. Lucide line icons, one stroke weight.

STORY: The person props the phone up, reads a huge count and a plain coaching line from across the room, taps one clear button between sets, and later sees honest history and progress.

FIRST VIEWPORT: Workout. Screen title, exercise chips, then a rounded camera card owning most of the screen: count in a large white pill top-left, tracking pill top-right, coach message card along the bottom edge. Save set as the single action-coloured button below; secondary buttons are white. Bottom tab bar (Workout, History, Progress) within thumb reach on phones; top bar on wide screens. Appearance (theme and accent) behind one icon button in the header.

FORM: Warm consumer app surface (challenger `digital-design-canon-warm-consumer-app-surface`, chosen by the user over the assigned Games grid and the Judges' lights pick). seed:7d371fb6e10b3cf8

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
